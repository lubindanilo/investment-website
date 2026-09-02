/**
 * screenerDrain — vide les files `error` retentables et `pending` du screener, HORS Vercel.
 *
 * POURQUOI UN CHEMIN SÉPARÉ DE `tick()` :
 *   1. Famine. `pickDueTickers` sert d'abord les titres déjà notés dont la date de résultats est
 *      passée (~2 600 candidats en permanence, la file ne se vide jamais car un échec y remet le
 *      titre 12 h plus tard). Les 25 places de chaque appel partent donc toutes en phase earnings
 *      et les `pending` ne sont JAMAIS piochés : les 22 577 titres semés le 30/07/2026 avaient
 *      encore `attempts = 0` cinq jours plus tard. Ici on pioche les `pending` et RIEN d'autre :
 *      deux jobs, deux files, plus d'arbitrage.
 *   2. Les timeouts. Toute la mécanique de budgets de `tick()` (10 s/titre US, 20 s non-US,
 *      deadline 15-30 s) n'existe que parce que le scoring tourne dans une lambda de 60 s derrière
 *      un appel HTTP de 30 s. Résultat mesuré le 04/08/2026 : 255 titres tentés, 6 notés, le reste
 *      en timeout. Sur un runner GitHub il n'y a ni lambda ni appel HTTP, donc pas de deadline
 *      artificielle, et surtout un SEUL process : les limiters Bottleneck (Yahoo 30 req/min)
 *      redeviennent honnêtes au lieu d'être multipliés par le nombre d'instances Vercel, ce qui
 *      était la cause du throttle Yahoo (cf. PR #147, réussite ~80 % hors Vercel).
 *
 * Le coût Neon n'est pas le nombre de requêtes mais le TEMPS D'ÉVEIL de la base : le run est donc
 * borné par un budget en CU-heures (cf. neonBudget), vérifié en cours de route.
 */
import { prisma } from '../db/client.js';
import { scoreOne } from './screener.js';

/** Issue d'un scoring, dérivée de la source pour ne pas dupliquer l'union de types. */
type ScoreOutcome = Awaited<ReturnType<typeof scoreOne>>;

/**
 * Plafond par titre. MESURÉ au canari du 04/08/2026 : à 90 s, 22 titres sur 25 dépassaient. La cause
 * n'est pas Yahoo qui nous bloque mais NOTRE PROPRE limiter (`yahooLimiter` : 30 req/min partagées,
 * cf. lib/limiter.ts). Un titre non-US neuf demande ~8 requêtes Yahoo plus l'accumulation historique
 * stockanalysis à 1 req/s : le seul temps de file dépasse la minute dès que plusieurs titres se
 * partagent le réservoir. Il n'y a plus de lambda de 60 s ici, donc rien ne justifie un plafond
 * serré : il ne sert qu'à écarter un fetch réellement pendu.
 */
const DEFAULT_PER_TICKER_MS = 240_000;
/** Fréquence de relecture de la consommation Neon en cours de run. */
const DEFAULT_POLL_MS = 10 * 60_000;
/** Combien de tickers déjà tentés on exclut des piochés suivants (cf. pickDue). */
const EXCLUDE_WINDOW = 1_000;
/** Même borne que le cron HTTP : après 5 échecs, le titre relève de `requeueAbandoned`. */
const MAX_ATTEMPTS = 5;
/**
 * Délai minimum entre deux PASSAGES du scoreur sur un titre à résultats échus (cf. pickDue).
 * 3 jours : assez court pour rattraper une publication, assez long pour ne pas repasser toutes les
 * nuits sur les titres dont le fournisseur tarde à publier la date du trimestre suivant.
 */
const EARNINGS_RESCORE_COOLDOWN_MS = 3 * 24 * 3600 * 1000;

/**
 * Clause d'éligibilité de la file « résultats tombés », partagée par `pickDue` (ce qu'on pioche) et
 * par le compteur `earningsLeft` du rapport de fin de run (ce qu'il reste). Les deux DOIVENT lire le
 * même critère : quand ils divergeaient, le rapport affichait une file qui ne bougeait pas alors que
 * le run notait 762 titres, ce qui a masqué le bug ci-dessous pendant trois nuits.
 *
 * LE COOLDOWN PORTE SUR `lastAttemptAt`, JAMAIS SUR `lastScoredAt` (10/08/2026). `lastScoredAt`
 * n'est écrit QUE si l'empreinte des fondamentaux a changé (cf. la garde « fraîcheur honnête » de
 * screener.ts, qui protège le `lastmod` du sitemap), et le schéma le dit explicitement :
 * « ⚠️ Pour la CADENCE de re-scoring, utiliser `lastAttemptAt`, jamais ce champ ». Fonder
 * l'éligibilité sur `lastScoredAt` rendait donc le cooldown INOPÉRANT dans le cas normal : un titre
 * re-noté dont le trimestre n'est pas encore publié ressortait avec `lastScoredAt` inchangé, donc
 * immédiatement re-éligible. Mesure sur les logs des nuits du 08, 09 et 10/08/2026 : sur les 762
 * titres notés le 10/08, 264 (35 % du run) l'avaient déjà été 24 h plus tôt et 111 trois nuits
 * d'affilée — les plus grosses capis, que le tri par capitalisation remonte en tête chaque nuit
 * (Asahi, Takeda, Sony, NTT…). Un tiers du budget Neon partait en re-scorings de moins de 24 h,
 * pendant que la file `pending` restait figée à 19 840 titres, deux nuits de suite au titre près.
 */
function earningsDueWhere(today: string, cooldownBefore: Date) {
  return {
    status: 'scored',
    nextEarningsDate: { lte: today },
    // `{ lt: … }` seul exclurait les lignes à null : une ligne notée sans tentative enregistrée
    // (héritage d'avant la séparation des deux champs) doit rester éligible.
    OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: cooldownBefore } }],
  };
}

export type StopReason = 'queue-empty' | 'time' | 'max-tickers' | 'neon-budget';

export interface DrainOptions {
  /** US | EU | INTL, ou undefined = univers entier (ordre naturel : priorité région puis ancienneté). */
  region?: string;
  /** Plafond de durée du run (minutes). */
  maxMinutes: number;
  /** Plafond de titres tentés — garde-fou contre une boucle qui partirait en vrille. */
  maxTickers: number;
  /**
   * Titres scorés de front. ATTENTION, ce n'est PAS un levier de débit : le réservoir Yahoo est
   * partagé par le process, donc N workers ne vont pas N fois plus vite, ils se répartissent le même
   * débit. Pire, chacun attend alors N fois plus longtemps et dépasse son plafond par titre : au
   * canari du 04/08, concurrence 6 donnait 1 titre noté sur 25 tentés (22 dépassements). Une
   * concurrence basse (1-2) laisse chaque titre avancer et sortir de la file.
   */
  concurrency: number;
  /** Plafond par titre (ms). Défaut DEFAULT_PER_TICKER_MS. */
  perTickerMs?: number;
  /** Taille d'un lot pioché en base. */
  batchSize: number;
  /** Budget compute de ce run en CU-heures. Ignoré sans `readUsage`. */
  allowanceCuH?: number;
  /** Lit la consommation compute cumulée du mois (CU-h). Injecté pour rester testable sans réseau. */
  readUsage?: () => Promise<number>;
  pollMs?: number;
  log?: (line: string) => void;
  /** Horloge injectable (tests). */
  now?: () => number;
}

export interface DrainResult {
  attempted: number;
  scored: number;
  nodata: number;
  error: number;
  timeout: number;
  batches: number;
  elapsedMs: number;
  stopReason: StopReason;
  /** CU-heures consommées par le run (delta mesuré), null si non mesurable. */
  cuHoursSpent: number | null;
  /** Titres encore `pending` après le run (même filtre région). */
  pendingLeft: number;
  /** Titres à résultats échus restant à re-noter après le run (hors cooldown, même filtre région). */
  earningsLeft: number;
}

/**
 * Pioche le prochain lot, EARNINGS ÉCHUS D'ABORD, puis erreurs retentables, puis `pending`.
 * `exclude` écarte les titres déjà tentés dans CE run : un scoring qui part en timeout peut laisser
 * la ligne dans son état initial, elle serait donc repiochée en boucle par le lot suivant.
 *
 * POURQUOI LES EARNINGS ICI (07/08/2026). Le drain ne prenait que `status: 'pending'`, donc le
 * rafraîchissement d'après résultats n'était servi QUE par le cron HTTP de 06:00. Or celui-ci
 * tourne derrière une lambda avec 30 s par appel et 20 s de budget par titre non-US : il expirait
 * sur tout ce qui n'était pas américain. Mesure sur la file au 07/08 : 3 632 titres à résultats
 * échus, dont 325 seulement réellement re-notés depuis 7 jours et 647 dont la dernière vraie note
 * datait de plus de 60 jours. Le drain, lui, tourne sur un runner sans lambda avec 240 s par titre
 * et a noté 868 titres sur 900 tentés dans la nuit du 06/08, sans un seul timeout. C'est donc lui
 * qui doit porter cette file.
 *
 * L'ordre compte : une fiche fausse nuit plus qu'une fiche absente, donc le rafraîchissement passe
 * AVANT l'élargissement de couverture. Le budget Neon étant le vrai plafond, le backfill `pending`
 * consomme ce qui reste du lot.
 */
export async function pickDue(limit: number, region: string | undefined, exclude: string[]): Promise<string[]> {
  const today = new Date().toISOString().slice(0, 10);
  const common = {
    ...(region ? { region } : {}),
    ...(exclude.length ? { ticker: { notIn: exclude } } : {}),
  };

  // 1. Résultats tombés : re-noter, les plus grosses capis d'abord.
  //
  //    Le cooldown n'est PAS une optimisation, c'est ce qui empêche la file de tourner en rond.
  //    `nextEarningsDate <= today` reste vrai tant que le fournisseur n'a pas publié la date du
  //    trimestre suivant, et ce délai va de quelques jours à quelques semaines (mesure au 07/08 :
  //    1 921 titres dont la date est dépassée depuis plus de 7 jours, dont 326 pourtant re-notés
  //    dans la semaine). Sans cooldown EFFECTIF, ces titres sont repêchés CHAQUE nuit après avoir
  //    déjà été rafraîchis, affamant le backfill `pending` et brûlant du compute Neon pour rien —
  //    c'est exactement ce qui s'est produit jusqu'au 10/08/2026, cf. `earningsDueWhere`.
  //
  //    Le TRI, lui, reste sur `lastScoredAt` : l'éligibilité est une question de cadence (« quand
  //    est-on passé ? » → `lastAttemptAt`), l'ordre une question de péremption (« quelle note est la
  //    plus vieille ? » → `lastScoredAt`). Un titre qui a échoué dix fois a un `lastAttemptAt`
  //    récent mais une note toujours périmée : il doit passer devant.
  const earningsCooldown = new Date(Date.now() - EARNINGS_RESCORE_COOLDOWN_MS);
  const earnings = await prisma.screenerTicker.findMany({
    where: { ...common, ...earningsDueWhere(today, earningsCooldown) },
    orderBy: [{ marketCapUsd: { sort: 'desc', nulls: 'last' } }, { lastScoredAt: { sort: 'asc', nulls: 'first' } }],
    take: limit,
    select: { ticker: true },
  });
  if (earnings.length >= limit) return earnings.map(r => r.ticker);

  // 2. Réparation des échecs transitoires. Indispensable pour les titres non-US : le cron HTTP
  // planifié tourne avec `fast=1` et exclut donc les symboles suffixés (.PA, .L, .DE…). Sans cette
  // file, un GTT.PA passé une fois en `error` n'était repris ni par le cron, ni par le drain.
  const errors = await prisma.screenerTicker.findMany({
    where: { ...common, status: 'error', attempts: { lt: MAX_ATTEMPTS } },
    orderBy: [{ priority: 'asc' }, { lastAttemptAt: { sort: 'asc', nulls: 'first' } }],
    take: limit - earnings.length,
    select: { ticker: true },
  });
  if (earnings.length + errors.length >= limit) {
    return [...earnings, ...errors].map(r => r.ticker);
  }

  // 3. Le reste du lot : élargissement de couverture, ordre historique.
  const pending = await prisma.screenerTicker.findMany({
    where: { ...common, status: 'pending' },
    orderBy: [{ priority: 'asc' }, { lastAttemptAt: { sort: 'asc', nulls: 'first' } }],
    take: limit - earnings.length - errors.length,
    select: { ticker: true },
  });
  return [...earnings, ...errors, ...pending].map(r => r.ticker);
}

const TIMEOUT = Symbol('timeout');

export async function drainPending(opts: DrainOptions): Promise<DrainResult> {
  const log = opts.log ?? (() => {});
  const now = opts.now ?? (() => Date.now());
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
  const perTickerMs = opts.perTickerMs ?? DEFAULT_PER_TICKER_MS;
  const start = now();
  const deadline = start + opts.maxMinutes * 60_000;

  const attempted = new Set<string>();
  let scored = 0, nodata = 0, error = 0, timeout = 0, batches = 0;
  let stopReason: StopReason = 'queue-empty';

  // Mesure du coût : on borne le run à sa part de CU-heures, relue périodiquement. La conso Neon
  // est mise à jour côté control plane avec quelques minutes de retard, ce qui est sans effet ici
  // (on compare un cumul de début de run à un cumul courant sur un run qui dure des heures).
  const trackBudget = opts.readUsage != null && opts.allowanceCuH != null && opts.allowanceCuH > 0;
  const usageStart = trackBudget ? await opts.readUsage!().catch(() => null) : null;
  let lastPoll = start;
  let cuHoursSpent: number | null = null;

  const overBudget = async (): Promise<boolean> => {
    if (!trackBudget || usageStart == null) return false;
    const cur = await opts.readUsage!().catch((e: Error) => {
      log(`[drain] conso Neon illisible (${e.message}) — on continue sur le plafond de durée seul.`);
      return null;
    });
    if (cur == null) return false;
    cuHoursSpent = Math.max(0, cur - usageStart);
    return cuHoursSpent >= opts.allowanceCuH!;
  };

  for (;;) {
    if (now() >= deadline) { stopReason = 'time'; break; }
    if (attempted.size >= opts.maxTickers) { stopReason = 'max-tickers'; break; }

    const batch = await pickDue(
      Math.min(opts.batchSize, opts.maxTickers - attempted.size),
      opts.region,
      [...attempted].slice(-EXCLUDE_WINDOW),
    );
    if (!batch.length) { stopReason = 'queue-empty'; break; }
    batches++;

    // Pool de workers tirant dans le lot. Chaque worker s'arrête net à l'échéance : un lot n'a pas
    // à être terminé, les titres non traités restent `pending` et repartent la nuit suivante.
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < batch.length && now() < deadline && attempted.size < opts.maxTickers) {
        const ticker = batch[next++]!;
        attempted.add(ticker);
        // Le timer est ANNULÉ dès que le scoring gagne la course : un setTimeout de plusieurs
        // minutes laissé en vol garde la boucle Node vivante d'autant, et un cron doit se terminer.
        let handle: ReturnType<typeof setTimeout> | undefined;
        const timer = new Promise<typeof TIMEOUT>(res => { handle = setTimeout(() => res(TIMEOUT), perTickerMs); });
        const outcome = await Promise.race([scoreOne(ticker), timer]);
        if (handle) clearTimeout(handle);
        if (outcome === TIMEOUT) timeout++;
        else if (outcome === 'scored') scored++;
        else if (outcome === 'nodata') nodata++;
        else error++;
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, opts.concurrency) }, () => worker()));

    const mins = ((now() - start) / 60_000).toFixed(0);
    log(`[drain] lot ${batches} : tentés=${attempted.size} notés=${scored} nodata=${nodata} error=${error} timeout=${timeout} (${mins} min)`);

    if (now() - lastPoll >= pollMs) {
      lastPoll = now();
      if (await overBudget()) { stopReason = 'neon-budget'; break; }
    }
  }

  // Mesure finale (même quand l'arrêt vient de la durée) pour alimenter le calibrage de la nuit suivante.
  if (trackBudget && usageStart != null) await overBudget();

  const regionWhere = opts.region ? { region: opts.region } : {};
  const pendingLeft = await prisma.screenerTicker.count({
    where: { status: 'pending', ...regionWhere },
  }).catch(() => -1);
  const earningsLeft = await prisma.screenerTicker.count({
    where: {
      ...regionWhere,
      ...earningsDueWhere(
        new Date().toISOString().slice(0, 10),
        new Date(Date.now() - EARNINGS_RESCORE_COOLDOWN_MS),
      ),
    },
  }).catch(() => -1);

  return {
    attempted: attempted.size, scored, nodata, error, timeout, batches,
    elapsedMs: now() - start, stopReason, cuHoursSpent, pendingLeft, earningsLeft,
  };
}

/**
 * Remet en file les titres définitivement abandonnés. `pickDueTickers` ignore les `error` dès
 * `attempts >= MAX_ATTEMPTS` (5) : les titres tombés uniquement à cause des timeouts Vercel en
 * sortaient donc pour de bon. Un `error` n'a par construction jamais de note valide (garde
 * anti-dégradation de `markScoreFailure`, PR #152), donc les repasser en `pending` ne détruit
 * aucune donnée affichée.
 */
export async function requeueAbandoned(maxAttempts = 5): Promise<number> {
  const { count } = await prisma.screenerTicker.updateMany({
    where: { status: 'error', attempts: { gte: maxAttempts } },
    data: { status: 'pending', attempts: 0 },
  });
  return count;
}
