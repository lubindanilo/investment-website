/**
 * Moteur point-in-time — rejoue le score EXACT que l'app aurait calculé à une date `asOf`.
 *
 * On pose une ReplaySource sur @lubin/api (setReplaySource) qui sert les filings stockés
 * filtrés à la donnée DISPONIBLE à asOf (filedDate ≤ asOf), puis on rappelle les fonctions
 * fondamentales de l'app — qui deviennent point-in-time sans réécriture. Métriques assemblées
 * via computeDerivedMetrics (metric:null → chemin fallback /financials-reported, le seul
 * historiquement valide). Les 10 critères de qualité n'utilisent pas le prix → score exact.
 *
 * Market cap (pour P/FCF) : on réutilise la logique éprouvée de l'app — prix `close` (split-
 * ajusté à aujourd'hui, today-basis) × actions de getReportedTimeseries('shares') (today-basis,
 * restatements de splits gérés par splitAdjustWithDiscontinuity). Les deux dans la MÊME base →
 * market cap correct et robuste autour des splits. Les splits sont des métadonnées de base
 * (le ratio P/FCF est invariant par split) : on les fournit tous au replay, ce qui n'introduit
 * aucune information future sur la VALEUR.
 */
import {
  setReplaySource,
  getReportedTimeseries,
  getAdjustedFcfTtmSeries,
  computeFcfAdj,
  computeAdjustedFcfTtm,
  computeCapitalEmployedSnapshot,
  computeFcfPerShareCagrFromQuarterlies,
  computeRevenueGrowthFromQuarterlies,
  computeSharesGrowthFromQuarterlies,
  computeOperatingMarginTrendFromQuarterlies,
  type ReplaySource,
  type AdjustedFcfResult,
  type CapitalEmployedSnapshot,
} from '../../../api/src/services/finnhubFundamentals.js';
import { computeDerivedMetrics, buildQuantitativeCriteria } from '../../../api/src/services/derivedMetrics.js';
import { pfcfPercentile, isOpportunity, PFCF_OPP_MIN_SCORE10, PFCF_OPP_MAX } from '../../../api/src/services/pfcfHistory.js';
import type { FinnhubQuote } from '../../../api/src/services/finnhub.js';
import type { Criterion, DerivedMetrics, TimeseriesPoint } from '@lubin/shared';
import type { TickerData, RawFiling, PricePoint } from '../store.js';
import { loadSeriesMap, makeDbReplaySource, splitsToEvents } from './dbSource.js';

export interface AsOfScore {
  ticker: string;
  asOf: string;
  fundamentalsAvailable: boolean;
  score10: number;
  scoreChiffres: number;
  scoreMax: number;
  /** P/FCF courant (mcap asOf / FCF_adj TTM) — gate <25 de l'opportunité. */
  pfcfTTM: number | null;
  /** P/FCF du dernier point de la série (FCF brut TTM) — base de la décision d'opportunité. */
  pfcfCurrent: number | null;
  /** Percentile du P/FCF courant dans son historique ≤ asOf (0-100 ; bas = historiquement cher). */
  pfcfPercentile: number | null;
  opportunity: boolean;
  nPfcfPoints: number;
  earliestQuarter: string | null;
  /** Prix `close` (split-ajusté à aujourd'hui) à asOf. */
  priceAsOf: number | null;
  chiffres: Criterion[];
  metrics: DerivedMetrics;
  pfcfSeries?: { date: string; pfcf: number }[];
}

const STALENESS_DAYS = 200;       // tolérance app pour rattacher un fondamental (findLatestAsOf)
const PRICE_STALENESS_DAYS = 45;  // prix mensuel : le point ≤ asOf doit être récent (~1 mois)
const FALLBACK_FILING_LAG_DAYS = 90; // si filedDate absent : lag conservateur sur l'endDate

const d10 = (s: string) => s.slice(0, 10);
const tsOf = (iso: string) => new Date(d10(iso) + 'T00:00:00Z').getTime();

function addDaysIso(iso: string, days: number): string {
  const dt = new Date(d10(iso) + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Date de disponibilité publique d'un filing : filedDate, sinon endDate + lag conservateur. */
function availableDate(f: RawFiling): string {
  return f.filedDate ? d10(f.filedDate) : addDaysIso(f.endDate, FALLBACK_FILING_LAG_DAYS);
}

/**
 * Source de replay : filings publiés ≤ asOf. On fournit TOUS les splits (métadonnées de base) :
 * le ratio P/FCF et les croissances sont invariants par split, donc aucune info future de VALEUR
 * n'est introduite ; cela garantit que prix (today-basis) et actions (today-basis) sont alignés.
 */
function makeReplaySource(data: TickerData, asOf: string): ReplaySource {
  const avail = (rows: RawFiling[]) => rows.filter((f) => availableDate(f) <= asOf);
  const q = avail(data.finnhub.quarterly);
  const a = avail(data.finnhub.annual);
  const splits = data.yahoo.splits.map((s) => ({
    ts: Math.floor(tsOf(s.date) / 1000), date: s.date, numerator: s.numerator, denominator: s.denominator,
  }));
  return {
    asOf,
    filings: (_t, freq) => (freq === 'quarterly' ? q : a) as unknown as ReturnType<ReplaySource['filings']>,
    splits: () => splits,
  };
}

/** Dernier point d'une série triée dont date ≤ ref, rejeté si trop périmé (> staleness). */
function latestAtOrBefore<T extends { date: string }>(series: T[], refIso: string, maxStaleDays = STALENESS_DAYS): T | null {
  let cand: T | null = null;
  for (const p of series) {
    if (d10(p.date) <= refIso) cand = p; else break;
  }
  if (!cand) return null;
  const ageDays = (tsOf(refIso) - tsOf(cand.date)) / (24 * 3600 * 1000);
  return ageDays > maxStaleDays ? null : cand;
}

/** TTM rolling = somme des 4 derniers trimestres (comme pfcfHistory.rollingTtm). */
function rollingTtm4(points: { date: string; value: number }[]): { date: string; ttm: number }[] {
  const sorted = [...points].sort((x, y) => x.date.localeCompare(y.date));
  const out: { date: string; ttm: number }[] = [];
  for (let i = 3; i < sorted.length; i++) {
    out.push({ date: sorted[i]!.date, ttm: sorted[i]!.value + sorted[i - 1]!.value + sorted[i - 2]!.value + sorted[i - 3]!.value });
  }
  return out;
}

// ─── Fallback annuel des croissances (quand le trimestriel Finnhub a des trous) ──────────
/** CAGR annualisé par régression log-linéaire sur les `lastN` derniers points annuels (>0). */
function logCagr(points: { date: string; value: number }[], lastN = 6): number | null {
  const valid = points.filter((p) => p.value > 0).sort((a, b) => a.date.localeCompare(b.date)).slice(-lastN);
  if (valid.length < 3) return null;
  const t0 = tsOf(valid[0]!.date);
  const xs = valid.map((p) => (tsOf(p.date) - t0) / (365.25 * 24 * 3600 * 1000));
  const ys = valid.map((p) => Math.log(p.value));
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i]! - mx) * (ys[i]! - my); den += (xs[i]! - mx) ** 2; }
  return den === 0 ? null : Math.exp(num / den) - 1;
}
const byYear = (pts: { date: string; value: number }[]) => new Map(pts.map((p) => [p.date.slice(0, 4), p.value]));

/**
 * Croissances annualisées depuis les séries ANNUELLES (10-K) ≤ asOf — fallback quand la
 * régression trimestrielle tombe en « Non calculable » (trous de données Finnhub free). FCF
 * BRUT (CFO−CapEx) pour le FCF/action en repli (l'ajusté SBC reste primaire côté trimestriel).
 */
async function annualGrowthFallback(ticker: string): Promise<{ revenue: number | null; fcfPerShare: number | null; shares: number | null; opMarginTrend: number | null }> {
  const [rev, fcf, shares, opInc] = await Promise.all([
    getReportedTimeseries(ticker, 'revenue', 'annual', 12).catch(() => [] as { date: string; value: number }[]),
    getReportedTimeseries(ticker, 'fcf', 'annual', 12).catch(() => [] as { date: string; value: number }[]),
    getReportedTimeseries(ticker, 'shares', 'annual', 12).catch(() => [] as { date: string; value: number }[]),
    getReportedTimeseries(ticker, 'operatingIncome', 'annual', 12).catch(() => [] as { date: string; value: number }[]),
  ]);
  const shByYr = byYear(shares), revByYr = byYear(rev);
  const fcfPs: { date: string; value: number }[] = [];
  for (const f of fcf) { const s = shByYr.get(f.date.slice(0, 4)); if (s && s > 0 && f.value > 0) fcfPs.push({ date: f.date, value: f.value / s }); }
  const margin: { date: string; value: number }[] = [];
  for (const o of opInc) { const r = revByYr.get(o.date.slice(0, 4)); if (r && r > 0 && o.value > 0) margin.push({ date: o.date, value: o.value / r }); }
  return { revenue: logCagr(rev), fcfPerShare: logCagr(fcfPs), shares: logCagr(shares), opMarginTrend: logCagr(margin) };
}

/**
 * Agrégats TTM depuis le dernier exercice ANNUEL (10-K) ≤ asOf — fallback quand le TTM
 * trimestriel échoue (chaîne CFO/CapEx trop trouée, ex AMZN/BKNG). FCF ajusté = CFO−|CapEx|−SBC
 * sur l'exercice complet (proxy TTM valide en fin d'exercice).
 */
async function annualTtmFallback(ticker: string): Promise<{ adjFcfTtm: number | null; revenueTtm: number | null; netIncomeTtm: number | null }> {
  const [cfo, capex, sbc, rev, ni] = await Promise.all([
    getReportedTimeseries(ticker, 'cfo', 'annual', 4).catch(() => [] as { date: string; value: number }[]),
    getReportedTimeseries(ticker, 'capex', 'annual', 4).catch(() => [] as { date: string; value: number }[]),
    getReportedTimeseries(ticker, 'sbc', 'annual', 4).catch(() => [] as { date: string; value: number }[]),
    getReportedTimeseries(ticker, 'revenue', 'annual', 4).catch(() => [] as { date: string; value: number }[]),
    getReportedTimeseries(ticker, 'netIncome', 'annual', 4).catch(() => [] as { date: string; value: number }[]),
  ]);
  const last = (s: { date: string; value: number }[]) => (s.length ? s[s.length - 1]!.value : null);
  const cfoLast = cfo.length ? cfo[cfo.length - 1]! : null;
  let adjFcfTtm: number | null = null;
  if (cfoLast) {
    const yr = cfoLast.date.slice(0, 4);
    const capexY = capex.find((p) => p.date.slice(0, 4) === yr)?.value ?? last(capex);
    const sbcY = sbc.find((p) => p.date.slice(0, 4) === yr)?.value ?? null;
    adjFcfTtm = computeFcfAdj(cfoLast.value, capexY, sbcY);
  }
  return { adjFcfTtm, revenueTtm: last(rev), netIncomeTtm: last(ni) };
}

const EMPTY_FCF_ADJ: AdjustedFcfResult = { ttmFcfAdj: null, ttmCfo: null, ttmSbc: null, ttmCapex: null, sbcShareOfFcf: null, asOf: null };
const EMPTY_CAP_EMP: CapitalEmployedSnapshot = {
  totalAssets: null, currentLiabilities: null, currentAssets: null, goodwill: null, equity: null,
  totalDebt: null, totalCash: null, revenueTtm: null, netIncomeTtm: null, sharesLatest: null,
  excessCash: null, formulaUsed: null, capitalEmployed: null, asOf: null,
};

export interface ScoreAsOfOpts { debugSeries?: boolean }

/**
 * Cœur du scoring point-in-time. Une ReplaySource doit être DÉJÀ posée par le wrapper —
 * scoreAsOf (filings JSON local) OU scoreAsOfDb (séries DB du site). `prices` = série Yahoo.
 */
async function scoreAsOfCore(ticker: string, asOf: string, prices: PricePoint[], opts: ScoreAsOfOpts): Promise<AsOfScore> {
    const [fhFcfPs, fhRev, fhShares, fhOpLev, fhFcfAdj, fhCapEmp, sharesAdj, adjFcfSeries] = await Promise.all([
      computeFcfPerShareCagrFromQuarterlies(ticker, 5).catch(() => ({ value: null as number | null })),
      computeRevenueGrowthFromQuarterlies(ticker, 5).catch(() => ({ value: null as number | null })),
      computeSharesGrowthFromQuarterlies(ticker, 5).catch(() => ({ value: null as number | null })),
      computeOperatingMarginTrendFromQuarterlies(ticker, 5).catch(() => ({ value: null as number | null })),
      computeAdjustedFcfTtm(ticker).catch(() => EMPTY_FCF_ADJ),
      computeCapitalEmployedSnapshot(ticker).catch(() => EMPTY_CAP_EMP),
      // Actions split-ajustées today-basis (restatements gérés) — pour le market cap de la série P/FCF.
      getReportedTimeseries(ticker, 'shares', 'quarterly', 50).catch(() => [] as { date: string; value: number }[]),
      // FCF AJUSTÉ TTM (CFO − CapEx − SBC) — EXACTEMENT le dénominateur P/FCF de l'app (getPfcfHistory
      // + carte, cf. bbd7ed3). Lu depuis le store DB (cfo/capex/sbc via replay) → identique au site.
      getAdjustedFcfTtmSeries(ticker, 51).catch(() => [] as { date: string; ts: number; value: number }[]),
    ]);

    const pricePt: PricePoint | null = latestAtOrBefore(prices, asOf, PRICE_STALENESS_DAYS);
    const priceAsOf = pricePt?.close ?? null;

    // Les 10 critères de qualité n'utilisent pas le prix (fcfMargin se déverrouille si mcap>0
    // mais sa VALEUR = FCF_adj/revenue). Le prix `close` (today-basis) apparié à sharesLatest
    // (today-basis) donne un pfcfTTM correct.
    // Fallback annuel (10-K, sans trou de décumulation) si une régression trimestrielle a
    // échoué — primaire = trimestriel (plus de points), repli = annuel. Corrige la sous-notation
    // des titres à couverture trimestrielle Finnhub incomplète (NVDA, MSFT, ADBE…).
    const needAnnual = fhRev.value == null || fhFcfPs.value == null || fhShares.value == null || fhOpLev.value == null;
    const annual = needAnnual
      ? await annualGrowthFallback(ticker)
      : { revenue: null, fcfPerShare: null, shares: null, opMarginTrend: null };

    // Fallback annuel des agrégats TTM (FCF ajusté, revenue, net income) si le quarterly est
    // trop troué pour un TTM — corrige les critères FCF (fcfMargin, cashRoce, netDebtFcf,
    // cashConversion) + netMargin sur les titres type AMZN/BKNG.
    const needTtm = fhFcfAdj.ttmFcfAdj == null || fhCapEmp.revenueTtm == null || fhCapEmp.netIncomeTtm == null;
    const at = needTtm ? await annualTtmFallback(ticker) : { adjFcfTtm: null, revenueTtm: null, netIncomeTtm: null };
    const adjFcfTtm = fhFcfAdj.ttmFcfAdj ?? at.adjFcfTtm;
    const revenueTtm = fhCapEmp.revenueTtm ?? at.revenueTtm;
    const netIncomeTtm = fhCapEmp.netIncomeTtm ?? at.netIncomeTtm;

    const quote = { c: priceAsOf } as unknown as FinnhubQuote;
    const metrics = computeDerivedMetrics({
      metric: null, profile: null, quote,
      yahooShareCagr: fhShares.value ?? annual.shares,
      yahooFcfPerShareCagr: fhFcfPs.value ?? annual.fcfPerShare,
      revenueGrowthOverride: fhRev.value ?? annual.revenue,
      opMarginTrend: fhOpLev.value ?? annual.opMarginTrend,
      adjFcfTtm,
      sbcShareOfFcf: fhFcfAdj.sbcShareOfFcf,
      capitalEmployed: fhCapEmp.capitalEmployed,
      capitalEmployedReason: fhCapEmp.reason,
      capitalEmployedFormula: fhCapEmp.formulaUsed,
      revenueTtm,
      netIncomeTtm,
      sharesLatest: fhCapEmp.sharesLatest,
      currentAssetsSnapshot: fhCapEmp.currentAssets,
      currentLiabilitiesSnapshot: fhCapEmp.currentLiabilities,
      totalDebtSnapshot: fhCapEmp.totalDebt,
      totalCashSnapshot: fhCapEmp.totalCash,
    });

    // ── Score (chemin Finnhub : les 10 critères comptent, comme scoreSnapshot US) ──
    const chiffres = buildQuantitativeCriteria(metrics);
    const pass = chiffres.filter((c) => c.statut === 'pass').length;
    const warn = chiffres.filter((c) => c.statut === 'warn').length;
    const scoreChiffres = pass + Math.round(warn * 0.5);
    const scoreMax = chiffres.length;
    const score10 = scoreMax > 0 ? Math.round((scoreChiffres / scoreMax) * 10) : 0;

    // ── Série P/FCF ≤ asOf — MÊME formule que l'app : (adjClose × actions) / FCF ajusté TTM ──
    const pfcfSeries: { date: string; pfcf: number }[] = [];
    for (const p of prices) {
      if (p.date > asOf) break;
      const ttm = latestAtOrBefore(adjFcfSeries, p.date);   // FCF ajusté TTM (CFO−CapEx−SBC)
      const sh = latestAtOrBefore(sharesAdj, p.date);
      if (!ttm || !sh || ttm.value <= 0 || sh.value <= 0) continue;   // FCF ajusté ≤ 0 → P/FCF non pertinent (omis, comme l'app)
      const pfcf = (p.adjClose * sh.value) / ttm.value;
      if (Number.isFinite(pfcf) && pfcf > 0 && pfcf <= 200) pfcfSeries.push({ date: p.date, pfcf: Math.round(pfcf * 100) / 100 });
    }
    const current = pfcfSeries.length ? pfcfSeries[pfcfSeries.length - 1]!.pfcf : null;
    const pct = pfcfPercentile(pfcfSeries, current);
    const gatePass = score10 >= PFCF_OPP_MIN_SCORE10 && metrics.pfcfTTM != null && metrics.pfcfTTM > 0 && metrics.pfcfTTM < PFCF_OPP_MAX;
    const opportunity = gatePass && isOpportunity(pct, current, score10);

    return {
      ticker, asOf,
      fundamentalsAvailable: fhFcfAdj.ttmFcfAdj != null || fhCapEmp.capitalEmployed != null,
      score10, scoreChiffres, scoreMax,
      pfcfTTM: metrics.pfcfTTM ?? null,
      pfcfCurrent: current, pfcfPercentile: pct,
      opportunity, nPfcfPoints: pfcfSeries.length,
      earliestQuarter: sharesAdj.length ? d10(sharesAdj[0]!.date) : null,
      priceAsOf,
      chiffres, metrics,
      ...(opts.debugSeries ? { pfcfSeries } : {}),
    };
}

/** Chemin JSON local (filings bruts) — tests / PoC. */
export async function scoreAsOf(data: TickerData, asOf: string, opts: ScoreAsOfOpts = {}): Promise<AsOfScore> {
  setReplaySource(makeReplaySource(data, asOf));
  try { return await scoreAsOfCore(data.ticker, asOf, data.yahoo.prices, opts); }
  finally { setReplaySource(null); }
}

/**
 * Chemin DB (backtest production) : fondamentaux lus depuis FundamentalsSeries (le store du SITE),
 * prix/splits Yahoo locaux → MÊMES notes que le site, auto-ajustées quand la DB/le calcul changent.
 * lagDays = délai de publication appliqué (le store n'a pas filedDate) ; 0 pour comparer au site « aujourd'hui ».
 */
export async function scoreAsOfDb(data: TickerData, asOf: string, opts: ScoreAsOfOpts & { lagDays?: number; seriesMap?: Map<string, TimeseriesPoint[]> } = {}): Promise<AsOfScore> {
  const seriesMap = opts.seriesMap ?? await loadSeriesMap(data.ticker); // préchargé par le runner (1 requête DB/ticker)
  const splits = splitsToEvents(data.yahoo.splits, asOf);
  setReplaySource(makeDbReplaySource(asOf, seriesMap, () => splits, opts.lagDays ?? 75));
  try { return await scoreAsOfCore(data.ticker, asOf, data.yahoo.prices, opts); }
  finally { setReplaySource(null); }
}
