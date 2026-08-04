/**
 * screenerDrain — vide la file des titres `pending` du screener, HORS Vercel.
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
/** Combien de tickers déjà tentés on exclut des piochés suivants (cf. pickPending). */
const EXCLUDE_WINDOW = 1_000;

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
}

/**
 * Pioche des `pending`, du plus prioritaire au plus ancien. `exclude` écarte les titres déjà tentés
 * dans CE run : un scoring qui part en timeout laisse la ligne en `pending` (aucun statut écrit),
 * elle serait donc repiochée en boucle par le lot suivant.
 */
async function pickPending(limit: number, region: string | undefined, exclude: string[]): Promise<string[]> {
  const rows = await prisma.screenerTicker.findMany({
    where: {
      status: 'pending',
      ...(region ? { region } : {}),
      ...(exclude.length ? { ticker: { notIn: exclude } } : {}),
    },
    orderBy: [{ priority: 'asc' }, { lastAttemptAt: { sort: 'asc', nulls: 'first' } }],
    take: limit,
    select: { ticker: true },
  });
  return rows.map(r => r.ticker);
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

    const batch = await pickPending(
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

  const pendingLeft = await prisma.screenerTicker.count({
    where: { status: 'pending', ...(opts.region ? { region: opts.region } : {}) },
  }).catch(() => -1);

  return {
    attempted: attempted.size, scored, nodata, error, timeout, batches,
    elapsedMs: now() - start, stopReason, cuHoursSpent, pendingLeft,
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
