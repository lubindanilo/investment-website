/**
 * Screener — veille quantitative automatique de l'univers des actions.
 *
 * Principe :
 *   1. seed : ingère la liste des tickers d'un/des exchange(s) dans ScreenerTicker (pending).
 *   2. tick : pioche les N tickers "dus" (jamais notés, ou earnings atteint) et calcule
 *      leur note /10 (quanti only, via buildAndCacheQuantSnapshot). Appelé en boucle par
 *      un cron (GitHub Actions) sous la limite Finnhub.
 *   3. top  : lit les meilleures notes pour la vue screener (tri instantané, indexé).
 *
 * Cadence de fraîcheur = la date du prochain earnings : tant qu'elle est future, le score
 * reste en cache ; dès qu'elle est atteinte, le ticker redevient "dû" et est re-noté
 * (ce qui récupère la nouvelle date). Fallback TTL pour les dates inconnues.
 */
import { prisma } from '../db/client.js';
import { getStockSymbols } from './finnhub.js';
import { buildAndCacheQuantSnapshot } from './scoreSnapshot.js';
import { getSparkSeries } from './priceSeries.js';
import { warmChartCacheForTicker } from './chartWarm.js';
import { getPfcfHistory, pfcfPercentile, pfcfDecileThreshold, isOpportunity, PFCF_OPP_MIN_SCORE10, PFCF_OPP_MAX } from './pfcfHistory.js';
import { getYahooBatchQuotes } from './yahoo.js';
import { ttlUntilNextEarnings } from './earnings.js';
import * as chartCache from '../lib/timeseriesCache.js';
import { EU_LARGE_CAPS } from '../data/euLargeCaps.js';
import { INTL_LARGE_CAPS } from '../data/intlLargeCaps.js';

/**
 * Couverture progressive : US d'abord (priority 0), puis EU (1), puis le reste du monde (2).
 * US : liste Finnhub (filtrée bourses primaires). EU/INTL : listes curées (Finnhub free ne
 * fournit pas les symboles hors US), scorées via le fallback Yahoo.
 */
const US_PRIORITY = 0;
const EU_PRIORITY = 1;
const INTL_PRIORITY = 2;

/** Types Finnhub qu'on garde (on écarte ETF, warrants, droits, fonds, etc.). */
const KEPT_TYPES = new Set(['Common Stock', 'ADR', 'REIT', '']);
/** Symbole compatible avec le reste de l'app (TickerSchema). */
const VALID_SYMBOL = /^[A-Z0-9.\-]{1,15}$/;
/**
 * Bourses US "réelles" : Nasdaq (XNAS), NYSE (XNYS), NYSE American/AMEX (XASE).
 * On EXCLUT l'OTC/pink-sheets (OOTC) — ~17 600 tickers obscurs souvent sans données,
 * qui gaspillent les cycles et polluent les résultats (faux 10/10 sur données fantômes).
 * Les vraies ADR de sociétés étrangères restent couvertes par le seed EU (bourse d'origine).
 */
const US_PRIMARY_MICS = new Set(['XNAS', 'XNYS', 'XASE']);

const MAX_ATTEMPTS = 5;
// Re-note les titres à date d'earnings INCONNUE assez vite : Finnhub free tier a souvent un
// trou de couverture transitoire (vide juste après une publication, puis la date apparaît
// quelques jours/semaines plus tard chez Finnhub ou Yahoo). 90j laissait `nextEarningsDate`
// nul trop longtemps ; 14j permet de rattraper la date dès qu'une source la publie.
const RESCORE_TTL_MS = 14 * 24 * 3600 * 1000;
/**
 * Cooldown anti-churn : un ticker fraîchement noté n'est PAS re-pioché avant ce délai, même si
 * son earnings est "dû". Indispensable car le fournisseur ne fait pas avancer la date du
 * prochain earnings le jour J : elle reste = aujourd'hui (parfois plusieurs jours) après
 * l'échéance. Sans cooldown, un tel titre redevient dû à CHAQUE tick, monopolise la file
 * (priority 0 servie en premier) et affame tout le reste de l'univers (EU/INTL pending) — le
 * compteur d'avancement se fige alors qu'on re-note en boucle une poignée de titres.
 */
const RESCORE_COOLDOWN_MS = 12 * 3600 * 1000; // au plus ~2 re-notations/jour par ticker

export interface SeedResult { region: string; fetched: number; inserted: number }

type SeedRow = { ticker: string; exchange: string | null; name: string | null; currency: string | null; region: string; priority: number };

/** Insère les lignes en lot, idempotent (skipDuplicates : préserve les déjà notées). */
async function insertRows(region: string, rows: SeedRow[]): Promise<number> {
  let inserted = 0;
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const res = await prisma.screenerTicker.createMany({ data: rows.slice(i, i + CHUNK), skipDuplicates: true });
    inserted += res.count;
  }
  console.log(`[screener seed ${region}] ${rows.length} tickers valides → ${inserted} nouveaux insérés`);
  return inserted;
}

/** Ingère l'univers d'une région dans la file. US = Finnhub (bourses primaires), EU/INTL = listes curées. */
export async function seedRegion(region: string): Promise<SeedResult> {
  if (region === 'US') return seedUs();
  if (region === 'EU') return seedEu();
  if (region === 'INTL') return seedIntl();
  throw new Error(`Région inconnue : ${region} (dispo : US, EU, INTL)`);
}

/** INTL : grandes capitalisations curées hors US/EU (Canada, Australie, Nordiques, Asie). */
async function seedIntl(): Promise<SeedResult> {
  const seen = new Set<string>();
  const rows: SeedRow[] = [];
  for (const raw of INTL_LARGE_CAPS) {
    const ticker = raw.toUpperCase();
    if (seen.has(ticker) || !VALID_SYMBOL.test(ticker)) continue;
    seen.add(ticker);
    const ex = ticker.includes('.') ? ticker.slice(ticker.lastIndexOf('.') + 1) : null;
    rows.push({ ticker, exchange: ex, name: null, currency: null, region: 'INTL', priority: INTL_PRIORITY });
  }
  return { region: 'INTL', fetched: rows.length, inserted: await insertRows('INTL', rows) };
}

/** US : liste Finnhub /stock/symbol?exchange=US, filtrée aux bourses primaires (pas d'OTC). */
async function seedUs(): Promise<SeedResult> {
  const symbols = await getStockSymbols('US').catch(() => [] as Awaited<ReturnType<typeof getStockSymbols>>);
  const rows: SeedRow[] = [];
  const seen = new Set<string>();
  for (const s of symbols) {
    const ticker = (s.symbol ?? '').toUpperCase();
    if (!ticker || seen.has(ticker)) continue;
    if (!VALID_SYMBOL.test(ticker)) continue;
    if (!KEPT_TYPES.has(s.type ?? '')) continue;
    if (!US_PRIMARY_MICS.has(s.mic ?? '')) continue; // pas d'OTC/pink-sheets
    seen.add(ticker);
    rows.push({ ticker, exchange: s.mic ?? 'US', name: s.description ?? null, currency: s.currency ?? null, region: 'US', priority: US_PRIORITY });
  }
  return { region: 'US', fetched: rows.length, inserted: await insertRows('US', rows) };
}

/** EU : liste curée des grandes capitalisations (Finnhub free ne liste pas l'EU). */
async function seedEu(): Promise<SeedResult> {
  const seen = new Set<string>();
  const rows: SeedRow[] = [];
  for (const raw of EU_LARGE_CAPS) {
    const ticker = raw.toUpperCase();
    if (seen.has(ticker) || !VALID_SYMBOL.test(ticker)) continue;
    seen.add(ticker);
    const ex = ticker.includes('.') ? ticker.slice(ticker.lastIndexOf('.') + 1) : null;
    rows.push({ ticker, exchange: ex, name: null, currency: null, region: 'EU', priority: EU_PRIORITY });
  }
  return { region: 'EU', fetched: rows.length, inserted: await insertRows('EU', rows) };
}

/**
 * Sélectionne les prochains tickers à (re)noter, en DEUX phases :
 *   1. Résultats fraîchement tombés (earnings atteint) → re-scoré EN PRIORITÉ, avant tout le
 *      reste. Ainsi le cache est rafraîchi vite après l'annonce, idéalement avant qu'un
 *      utilisateur ne re-clique (sinon il déclenche un recompute à la volée).
 *   2. Le reste : jamais noté (front de progression), dates inconnues (TTL), erreurs — par
 *      priorité de région puis ancienneté.
 */
async function pickDueTickers(limit: number): Promise<{ ticker: string }[]> {
  const today = new Date().toISOString().slice(0, 10);
  const ttlCutoff = new Date(Date.now() - RESCORE_TTL_MS);
  const cooldownCutoff = new Date(Date.now() - RESCORE_COOLDOWN_MS);

  // Phase 1 — earnings atteint (au plus une fois par cooldown si la date ne progresse pas).
  const earningsDue = await prisma.screenerTicker.findMany({
    where: { status: 'scored', nextEarningsDate: { lte: today }, lastScoredAt: { lt: cooldownCutoff } },
    orderBy: [{ nextEarningsDate: 'asc' }, { lastScoredAt: { sort: 'asc', nulls: 'first' } }],
    take: limit,
    select: { ticker: true },
  });
  if (earningsDue.length >= limit) return earningsDue;

  // Phase 2 — comble le reste du lot.
  const rest = await prisma.screenerTicker.findMany({
    where: {
      OR: [
        { status: 'pending' },
        { status: 'scored', nextEarningsDate: null, lastScoredAt: { lt: ttlCutoff } },
        { status: 'error', attempts: { lt: MAX_ATTEMPTS }, lastScoredAt: { lt: cooldownCutoff } },
        // Auto-réparation : titre noté mais sans cours (échec transitoire Finnhub/Yahoo au
        // scoring de masse) → on le re-note pour récupérer cours / secteur / variation / spark.
        { status: 'scored', price: null, lastScoredAt: { lt: cooldownCutoff } },
      ],
    },
    orderBy: [{ priority: 'asc' }, { lastScoredAt: { sort: 'asc', nulls: 'first' } }],
    take: limit - earningsDue.length,
    select: { ticker: true },
  });
  return [...earningsDue, ...rest];
}

type ScoreOutcome = 'scored' | 'nodata' | 'error';

/** Profondeur « All » du graphe P/FCF (cf. PERIOD_YEARS.All) — base du percentile d'opportunité. */
const OPP_YEARS = 50;
/** Borne P/FCF au-delà de laquelle on ne calcule même pas le seuil décile (jamais une pépite). */
const OPP_DECILE_BAND = 35;

/**
 * « Opportunité du moment » au moment du scoring. Ne calcule l'historique P/FCF (coûteux) QUE
 * pour les candidats plausibles : note ≥ 8/10 ET 0 < P/FCF < 25 (les seuls qui peuvent qualifier).
 * Cache aussi la série |50 (sert le graphe « All » + le calcul live de la vue analyse).
 * Renvoie {opportunity, pfcfPercentile} ; best-effort (jamais throw).
 */
async function computeOpportunityAtScore(
  ticker: string,
  score10: number,
  pfcfTTM: number | null,
  nextEarningsDate: string | null,
): Promise<{ opportunity: boolean; pfcfPercentile: number | null; pfcfDecile10: number | null }> {
  // On calcule le seuil décile pour tout candidat note ≥ 8 dont le P/FCF est APPROCHABLE (< 35),
  // même s'il dépasse 25 aujourd'hui : ça permet de le flagger EN LIVE si son cours baisse plus tard
  // (le seuil ne bouge qu'aux earnings). Au-delà de 35, un titre ne deviendra jamais une pépite.
  if (score10 < PFCF_OPP_MIN_SCORE10 || pfcfTTM == null || pfcfTTM <= 0 || pfcfTTM >= OPP_DECILE_BAND) {
    return { opportunity: false, pfcfPercentile: null, pfcfDecile10: null };
  }
  const pts = await getPfcfHistory(ticker, OPP_YEARS).catch(() => [] as { date: string; pfcf: number }[]);
  if (!pts.length) return { opportunity: false, pfcfPercentile: null, pfcfDecile10: null };
  const ttl = ttlUntilNextEarnings(nextEarningsDate);
  await chartCache.set(chartCache.cacheKey(ticker, 'pfcf-history', 'computed-adj', OPP_YEARS), pts.map(p => ({ date: p.date, value: p.pfcf })), 'finnhub', ttl).catch(() => {});
  // On classe le P/FCF COURANT (cohérent, fourni par le caller) contre la distribution historique —
  // et non le dernier point de l'historique (close mensuel), pour que le gate < 25 et le percentile
  // utilisent la même valeur que ce qu'on affiche au prix du moment.
  const pct = pfcfPercentile(pts, pfcfTTM);
  // Seuil décile figé → permet la ré-évaluation LIVE (pfcf_live ≤ seuil) avec juste le prix du jour.
  const pfcfDecile10 = pfcfDecileThreshold(pts);
  return { opportunity: isOpportunity(pct, pfcfTTM, score10), pfcfPercentile: pct, pfcfDecile10 };
}

/** Fraîcheur du flag opportunity en LIVE : au-delà, on recalcule au prix du jour. */
const OPP_LIVE_TTL_MS = 10 * 60_000;

/**
 * Ré-évalue le flag « opportunité » EN LIVE (prix du jour) pour les candidats (note ≥ 8) dont
 * le seuil décile est connu et qui n'ont pas été rafraîchis depuis OPP_LIVE_TTL_MS.
 *
 * La pépite dépend du P/FCF courant, donc du cours, qui bouge chaque jour — la cadence earnings
 * ne suffit pas. On ne re-fetche PAS les fondamentaux : shares, adjFcfTtm (snapshot) et le seuil
 * décile (figé au scoring) sont en cache ; seul le PRIX est récupéré en live, en batch Yahoo
 * (~40 symboles/requête → tout l'univers candidat en quelques requêtes). Auto-throttlé via
 * oppRefreshedAt : la 1ʳᵉ requête après 10 min paie le batch (~qq s), les suivantes sont instantanées.
 *
 *   opportunité = note ≥ 8  ET  0 < pfcf_live < 25  ET  pfcf_live ≤ pfcfDecile10
 */
export async function refreshOpportunitiesLive(): Promise<{ refreshed: number; flipped: number }> {
  const cutoff = new Date(Date.now() - OPP_LIVE_TTL_MS);
  const cands = await prisma.screenerTicker.findMany({
    where: {
      status: 'scored',
      scoreRatio: { gte: 0.75 },           // score10 ≥ 8 ⟺ ratio ≥ 0.75
      pfcfDecile10: { not: null },
      OR: [{ oppRefreshedAt: null }, { oppRefreshedAt: { lt: cutoff } }],
    },
    select: { ticker: true, pfcfDecile10: true, opportunity: true },
  });
  if (cands.length === 0) return { refreshed: 0, flipped: 0 };

  const tickers = cands.map(c => c.ticker);
  // shares + adjFcfTtm depuis le snapshot (ne bougent qu'aux earnings).
  const snaps = await prisma.tickerQuantSnapshot.findMany({
    where: { ticker: { in: tickers } },
    select: { ticker: true, snapshot: true },
  });
  const fund = new Map<string, { shares: number | null; adjFcf: number | null }>();
  for (const s of snaps) {
    const snap = s.snapshot as { sharesOutstanding?: number | null; adjFcfTtm?: number | null } | null;
    fund.set(s.ticker, { shares: snap?.sharesOutstanding ?? null, adjFcf: snap?.adjFcfTtm ?? null });
  }
  // Prix du jour en batch (le ticker app = symbole Yahoo : US direct, non-US déjà suffixé .PA/.SW…).
  const prices = await getYahooBatchQuotes(tickers);

  const now = new Date();
  const priced: string[] = [];
  const updates: Promise<unknown>[] = [];
  let flipped = 0;
  for (const c of cands) {
    const f = fund.get(c.ticker);
    const price = prices.get(c.ticker.toUpperCase()) ?? null;
    if (price == null || price <= 0 || !f || f.shares == null || f.shares <= 0 || f.adjFcf == null || f.adjFcf === 0) {
      continue; // prix ou fondamentaux indispo → on ne touche rien (re-tenté au prochain passage)
    }
    const livePfcf = (price * f.shares) / f.adjFcf;
    const opportunity = livePfcf > 0 && livePfcf < PFCF_OPP_MAX && c.pfcfDecile10 != null && livePfcf <= c.pfcfDecile10;
    priced.push(c.ticker);
    if (opportunity !== c.opportunity) {
      flipped++;
      updates.push(prisma.screenerTicker.update({ where: { ticker: c.ticker }, data: { opportunity, oppRefreshedAt: now } }));
    }
  }
  await Promise.allSettled(updates);
  // Marque comme rafraîchis (10 min) tous les titres effectivement évalués (prix obtenu).
  if (priced.length) {
    await prisma.screenerTicker.updateMany({ where: { ticker: { in: priced } }, data: { oppRefreshedAt: now } }).catch(() => {});
  }
  console.log(`[screener opp-live] ${priced.length}/${cands.length} ré-évalués au prix du jour, ${flipped} basculés`);
  return { refreshed: priced.length, flipped };
}

/** Note un ticker (quanti only) et met à jour sa ligne ScreenerTicker. */
export async function scoreOne(ticker: string): Promise<ScoreOutcome> {
  try {
    const snap = await buildAndCacheQuantSnapshot(ticker, { includeEarnings: true });
    const hasScore = snap.scoreChiffresMax > 0;
    const status: ScoreOutcome = snap.fundamentalsAvailable && hasScore ? 'scored' : 'nodata';
    // Sparkline 1 an pour les titres notés (non bloquant si Yahoo échoue → []).
    const spark = hasScore ? await getSparkSeries(ticker).catch(() => []) : [];
    // « Opportunité du moment » (gated aux candidats note ≥ 8/10 & P/FCF < 25 pour borner le coût).
    // ⚠ COHÉRENCE : on classe le P/FCF courant sur la MÊME base que l'historique (prix × shares /
    // adjFcfTtm), pas sur metrics.pfcfTTM qui peut être sur une base marketCap Finnhub différente
    // (nb d'actions ≠) → sinon le percentile est biaisé et bascule les cas limites (ex DOCU).
    const score10 = hasScore ? Math.round((snap.scoreChiffres / snap.scoreChiffresMax) * 10) : 0;
    const pfcfConsistent = (snap.adjFcfTtm != null && snap.adjFcfTtm !== 0 && snap.sharesOutstanding != null && snap.metrics.price != null && snap.metrics.price > 0)
      ? (snap.metrics.price * snap.sharesOutstanding) / snap.adjFcfTtm
      : snap.metrics.pfcfTTM ?? null;
    const opp = hasScore
      ? await computeOpportunityAtScore(ticker, score10, pfcfConsistent, snap.nextEarningsDate ?? null)
      : { opportunity: false, pfcfPercentile: null, pfcfDecile10: null };
    await prisma.screenerTicker.update({
      where: { ticker },
      data: {
        status,
        name: snap.company,
        currency: snap.currency,
        fundamentalsSource: snap.fundamentalsSource,
        scoreChiffres: hasScore ? snap.scoreChiffres : null,
        scoreChiffresMax: hasScore ? snap.scoreChiffresMax : null,
        scoreRatio: hasScore ? snap.scoreChiffres / snap.scoreChiffresMax : null,
        pfcfTTM: snap.metrics.pfcfTTM ?? null,
        sector: snap.sector ?? null,
        price: snap.metrics.price ?? null,
        dayChangePct: snap.dayChangePct ?? null,
        spark: spark.length >= 2 ? spark : undefined,
        opportunity: opp.opportunity,
        pfcfPercentile: opp.pfcfPercentile,
        pfcfDecile10: opp.pfcfDecile10,
        // Le scoring vient de (ré)évaluer l'opportunité au prix du moment → marque la fraîcheur live.
        oppRefreshedAt: new Date(),
        nextEarningsDate: snap.nextEarningsDate ?? null,
        lastScoredAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    return status;
  } catch (e) {
    console.warn(`[screener score ${ticker}] échec : ${(e as Error).message}`);
    await prisma.screenerTicker.update({
      where: { ticker },
      data: { status: 'error', attempts: { increment: 1 }, lastScoredAt: new Date() },
    }).catch(() => {});
    return 'error';
  }
}

export interface TickResult { picked: number; scored: number; nodata: number; error: number; timeout: number; elapsedMs: number }

/**
 * Plafond de temps pour la notation d'UN ticker. Les titres internationaux passent par
 * Yahoo (résolution + fondamentaux + sparkline = plusieurs appels séquentiels) et Yahoo
 * peut throttler/bloquer les IP Vercel → un appel peut traîner 10-30s. Sans plafond, un
 * seul ticker lent fait dépasser la limite HTTP du cron (30s). Au-delà, on abandonne ce
 * ticker (marqué error → re-tenté plus tard, deprioritisé) et on passe au suivant.
 */
const PER_TICKER_MS = 10_000;

const TIMEOUT_SENTINEL = Symbol('timeout');

/** Marque un ticker abandonné (timeout) : incrémente attempts + lastScoredAt (le deprioritise). */
async function markTimedOut(ticker: string): Promise<void> {
  console.warn(`[screener score ${ticker}] timeout (> ${PER_TICKER_MS}ms) — abandonné, re-tenté plus tard`);
  await prisma.screenerTicker.update({
    where: { ticker },
    data: { status: 'error', attempts: { increment: 1 }, lastScoredAt: new Date() },
  }).catch(() => {});
}

/**
 * Traite un lot de tickers dus. Séquentiel (le finnhubLimiter gère la concurrence interne
 * à chaque ticker) avec un double garde-fou pour tenir SOUS la limite HTTP du cron (30s) :
 *   - timeout par ticker (PER_TICKER_MS) : aucun titre lent ne bloque le lot,
 *   - garde de budget : on ne démarre un nouveau ticker que s'il reste ≥ PER_TICKER_MS,
 *     pour que la réponse parte bien avant la coupure du cron.
 */
/** Fin de la phase scoring : on laisse de la marge pour la phase warm sous la limite cron (30s). */
const SCORE_DEADLINE_MS = 15_000;
/** Fin de la phase warm graphiques (laisse de la marge avant la coupure du cron à 30s,
 *  en comptant l'overhead lambda + le timeout du warm en cours). */
const WARM_DEADLINE_MS = 24_000;
/** Plafond par ticker pour le warm graphiques (best-effort, ne touche jamais au score). */
const CHART_WARM_MS = 6_000;
/** Combien de titres "jamais warmés" combler par tick, en plus des fraîchement scorés. */
const WARM_FILL = 6;

export async function tick(limit: number, softDeadlineMs = SCORE_DEADLINE_MS): Promise<TickResult> {
  const start = Date.now();
  const due = await pickDueTickers(limit);
  let scored = 0, nodata = 0, error = 0, timeout = 0;
  const justScored: string[] = [];
  for (const t of due) {
    // Pas assez de budget pour garantir un cycle complet → on s'arrête net.
    if (Date.now() - start + PER_TICKER_MS > softDeadlineMs) break;
    const timer = new Promise<typeof TIMEOUT_SENTINEL>((res) => setTimeout(() => res(TIMEOUT_SENTINEL), PER_TICKER_MS));
    // scoreOne ne rejette pas (catch interne) ; en cas de timeout il continue en arrière-plan
    // et finira par écrire sa ligne (la lambda tient 60s) — la donnée converge.
    const r = await Promise.race([scoreOne(t.ticker), timer]);
    if (r === TIMEOUT_SENTINEL) { await markTimedOut(t.ticker); timeout++; }
    else if (r === 'scored') { scored++; justScored.push(t.ticker); }
    else if (r === 'nodata') nodata++;
    else error++;
  }

  // ── Phase warm graphiques (best-effort, découplée du score) ──────────────────
  // La veille prérempli ChartCache pour TOUT l'univers, comme elle a scoré le screener.
  // 1) les titres fraîchement scorés (memo /financials-reported encore chaud → quasi gratuit),
  // 2) puis on comble des titres scorés jamais warmés (backfill progressif).
  const warmed = await warmChartsPhase(justScored, start);

  const elapsedMs = Date.now() - start;
  console.log(`[screener tick] picked=${due.length} scored=${scored} nodata=${nodata} error=${error} timeout=${timeout} warmed=${warmed} in ${elapsedMs}ms`);
  return { picked: due.length, scored, nodata, error, timeout, elapsedMs };
}

/** Préremplit les graphiques d'un lot de tickers dans le budget restant. Renvoie le nb warmé. */
async function warmChartsPhase(justScored: string[], start: number): Promise<number> {
  const queue = [...justScored];
  const fillN = Math.max(0, WARM_FILL - queue.length);
  if (fillN > 0) {
    const never = await prisma.screenerTicker.findMany({
      where: { status: 'scored', chartsWarmedAt: null, ticker: { notIn: queue.length ? queue : ['__none__'] } },
      orderBy: { scoreRatio: 'desc' },
      take: fillN,
      select: { ticker: true, nextEarningsDate: true },
    }).catch(() => [] as { ticker: string; nextEarningsDate: string | null }[]);
    queue.push(...never.map(n => n.ticker));
  }
  let warmed = 0;
  for (const ticker of queue) {
    if (Date.now() - start + CHART_WARM_MS > WARM_DEADLINE_MS) break;
    // nextEarningsDate : relu depuis la ligne (scoreOne vient de la mettre à jour).
    const row = await prisma.screenerTicker.findUnique({ where: { ticker }, select: { nextEarningsDate: true } }).catch(() => null);
    const ned = row?.nextEarningsDate ?? null;
    const timer = new Promise<typeof TIMEOUT_SENTINEL>((res) => setTimeout(() => res(TIMEOUT_SENTINEL), CHART_WARM_MS));
    await Promise.race([warmChartCacheForTicker(ticker, ned).catch(() => {}), timer]);
    await prisma.screenerTicker.update({ where: { ticker }, data: { chartsWarmedAt: new Date() } }).catch(() => {});
    warmed++;
  }
  return warmed;
}

export interface TopRow {
  ticker: string;
  name: string | null;
  scoreChiffres: number | null;
  scoreChiffresMax: number | null;
  pfcfTTM: number | null;
  currency: string | null;
  nextEarningsDate: string | null;
  sector: string | null;
  price: number | null;
  dayChangePct: number | null;
  spark: number[] | null;
  opportunity: boolean;
  pfcfPercentile: number | null;
}

/** Meilleures notes pour la vue screener. Tri par ratio décroissant, indexé. */
export async function getTop(opts: { minRatio?: number; maxPfcf?: number; minMax?: number; limit?: number; onlyOpportunities?: boolean; sectors?: string[] } = {}): Promise<TopRow[]> {
  const { minRatio = 0, maxPfcf, minMax = 8, limit = 100, onlyOpportunities = false, sectors } = opts;
  return prisma.screenerTicker.findMany({
    where: {
      status: 'scored',
      scoreChiffresMax: { gte: minMax },       // dénominateur significatif (évite 2/2 = 100%)
      scoreRatio: { gte: minRatio },
      ...(maxPfcf != null ? { pfcfTTM: { gt: 0, lte: maxPfcf } } : {}),
      ...(onlyOpportunities ? { opportunity: true } : {}),
      ...(sectors && sectors.length ? { sector: { in: sectors } } : {}),   // 1+ industries (valeurs canoniques anglaises)
    },
    orderBy: [{ scoreRatio: 'desc' }, { scoreChiffresMax: 'desc' }],
    take: Math.min(limit, 500),
    select: {
      ticker: true, name: true, scoreChiffres: true, scoreChiffresMax: true,
      pfcfTTM: true, currency: true, nextEarningsDate: true,
      sector: true, price: true, dayChangePct: true, spark: true,
      opportunity: true, pfcfPercentile: true,
    },
  }) as Promise<TopRow[]>;
}

/** Compteurs de progression de la veille. */
export async function getStats(): Promise<{ pending: number; scored: number; nodata: number; error: number; total: number }> {
  const grouped = await prisma.screenerTicker.groupBy({ by: ['status'], _count: { _all: true } });
  const out = { pending: 0, scored: 0, nodata: 0, error: 0, total: 0 };
  for (const g of grouped) {
    const c = g._count._all;
    if (g.status === 'pending' || g.status === 'scored' || g.status === 'nodata' || g.status === 'error') {
      out[g.status] = c;
    }
    out.total += c;
  }
  return out;
}

/**
 * Liste des industries (valeur `sector`) présentes parmi les titres notés, avec le nombre
 * de titres — alimente le menu déroulant du filtre par secteur du screener. Tri par count.
 * La valeur renvoyée est la chaîne canonique anglaise (la traduction est faite côté front).
 */
export async function getSectors(): Promise<{ sector: string; count: number }[]> {
  const grouped = await prisma.screenerTicker.groupBy({
    by: ['sector'],
    where: { status: 'scored', sector: { not: null }, scoreChiffresMax: { gte: 8 } },
    _count: { _all: true },
  });
  return grouped
    .filter((g): g is typeof g & { sector: string } => !!g.sector)
    .map(g => ({ sector: g.sector, count: g._count._all }))
    .sort((a, b) => b.count - a.count);
}

/** Nombre minimal de pairs cotés pour qu'une médiane sectorielle soit pertinente. */
const SECTOR_BENCH_MIN_PEERS = 5;

/**
 * Benchmark sectoriel du P/FCF : médiane (+ percentile du titre) parmi les sociétés cotées
 * suivies de la MÊME industrie. `tickerPfcf` situe le titre vs ses pairs (percentile bas = moins
 * cher). Renvoie null si l'industrie est inconnue ou compte trop peu de pairs valides.
 */
export async function getSectorPfcfBenchmark(
  sector: string | null,
  tickerPfcf: number | null,
): Promise<{ sector: string; medianPfcf: number; meanPfcf: number; count: number; percentile: number | null; peers: { ticker: string; name: string | null; pfcf: number }[] } | null> {
  if (!sector) return null;
  const rows = await prisma.screenerTicker.findMany({
    where: { status: 'scored', sector, pfcfTTM: { gt: 0 } },
    select: { ticker: true, name: true, pfcfTTM: true },
  });
  const peers = rows
    .filter(r => Number.isFinite(r.pfcfTTM) && r.pfcfTTM! > 0)
    .map(r => ({ ticker: r.ticker, name: r.name, pfcf: r.pfcfTTM! }))
    .sort((a, b) => a.pfcf - b.pfcf);
  if (peers.length < SECTOR_BENCH_MIN_PEERS) return null;
  const values = peers.map(p => p.pfcf);
  const median = values[Math.floor(values.length / 2)]!;
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  let percentile: number | null = null;
  if (tickerPfcf != null && tickerPfcf > 0) {
    const below = values.filter(v => v <= tickerPfcf).length;
    percentile = (below / values.length) * 100;
  }
  return { sector, medianPfcf: median, meanPfcf: mean, count: peers.length, percentile, peers };
}
