/**
 * P/FCF historique — calcule la trajectoire du multiple Price / Free Cash Flow
 * d'un ticker dans le temps, pour permettre de voir si l'action est expensive
 * vs son propre historique (mean reversion + signal de timing).
 *
 * Formule :
 *   P/FCF(t) = price(t) × shares(t) / TTM_FCF(t)
 *           = market_cap(t) / TTM_FCF(t)
 *
 * Sources :
 *   - price(t)    : Yahoo /v8/finance/chart (split-adjusté automatiquement par Yahoo)
 *   - shares(t)   : Finnhub /financials-reported quarterly (split-adjusté via yahooSplits)
 *   - FCF(t)      : Finnhub /financials-reported quarterly (sur 4 derniers Q = TTM)
 *
 * Resolution :
 *   - 1Y    → weekly  (~52 points)
 *   - 5Y+   → monthly (~60-240 points)
 *
 * Cas de gap (point omis) :
 *   - TTM_FCF ≤ 0 (FCF négatif : ratio non-pertinent financièrement)
 *   - Pas de quarter récent connu (delta < 6 mois)
 *   - Pas assez de quarters pour calculer TTM (besoin ≥ 4)
 */
import { getReportedTimeseries, getAdjustedFcfTtmSeries } from './finnhubFundamentals.js';
import { resolveYahooTicker } from './yahooResolve.js';
import { yahooLimiter } from '../lib/limiter.js';
import type { TimeseriesPoint } from '@lubin/shared';

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Lubin-Investment/0.1';

export interface PfcfHistoryPoint {
  /** YYYY-MM-DD */
  date: string;
  /** Multiple P/FCF (ex 22.5). Toujours > 0 — les points où le calcul n'est pas pertinent sont omis. */
  pfcf: number;
}

// ─── « Opportunité du moment » : P/FCF historiquement bas ──────────────────
/** Seuil de percentile (décile bas) pour qualifier d'opportunité. */
export const PFCF_OPP_PERCENTILE = 10;
/** Plafond absolu du P/FCF pour qualifier d'opportunité. */
export const PFCF_OPP_MAX = 25;
/** Note quantitative minimale (sur 10) pour qualifier d'« opportunité du moment ». */
export const PFCF_OPP_MIN_SCORE10 = 8;
/** Historique minimal (points) pour un percentile fiable (~3 ans de trimestres). */
const PFCF_PERCENTILE_MIN_POINTS = 12;

/**
 * Percentile du P/FCF `current` au sein de sa propre série (0-100 = % de points ≤ current).
 * Null si historique insuffisant. Même formule que la modale P/FCF.
 */
export function pfcfPercentile(points: PfcfHistoryPoint[], current: number | null): number | null {
  if (current == null || !Number.isFinite(current) || current <= 0) return null;
  const vals = points.map(p => p.pfcf).filter(v => Number.isFinite(v) && v > 0);
  if (vals.length < PFCF_PERCENTILE_MIN_POINTS) return null;
  let below = 0;
  for (const v of vals) if (v <= current) below++;
  return (below / vals.length) * 100;
}

/**
 * Seuil P/FCF du décile bas : la plus grande valeur `v` de la distribution telle que
 * pfcfPercentile(v) ≤ PFCF_OPP_PERCENTILE. Permet la ré-évaluation LIVE de l'opportunité
 * (pfcf_live ≤ seuil ⟺ percentile ≤ 10) avec le seul prix du jour, sans recharger l'historique.
 * Null si historique insuffisant. Légèrement conservateur sur la frontière (jamais de faux positif).
 */
export function pfcfDecileThreshold(points: PfcfHistoryPoint[]): number | null {
  const vals = points.map(p => p.pfcf).filter(v => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  const n = vals.length;
  if (n < PFCF_PERCENTILE_MIN_POINTS) return null;
  let threshold: number | null = null;
  for (let i = 0; i < n; i++) {
    // vals[i] a (i+1) valeurs ≤ lui → percentile = (i+1)/n*100. On garde la dernière ≤ seuil.
    if (((i + 1) / n) * 100 <= PFCF_OPP_PERCENTILE) threshold = vals[i]!;
    else break;
  }
  return threshold;
}

/**
 * Médiane du P/FCF historique (valeurs > 0). Sert de multiple de sortie par défaut en
 * valorisation : « à combien ce titre s'est-il payé, historiquement ». Null si historique
 * insuffisant (même seuil de fiabilité que le percentile).
 */
export function pfcfMedian(points: PfcfHistoryPoint[]): number | null {
  const vals = points.map(p => p.pfcf).filter(v => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  const n = vals.length;
  if (n < PFCF_PERCENTILE_MIN_POINTS) return null;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (vals[mid - 1]! + vals[mid]!) / 2 : vals[mid]!;
}

/** Vrai si le P/FCF est dans son décile bas historique ET sous le plafond (test P/FCF pur). */
export function isPfcfOpportunity(percentile: number | null, pfcf: number | null): boolean {
  return percentile != null && pfcf != null && pfcf > 0 && percentile <= PFCF_OPP_PERCENTILE && pfcf < PFCF_OPP_MAX;
}

/**
 * « Opportunité du moment » complète : société de qualité (note ≥ 8/10) DONT le P/FCF est
 * historiquement bas (décile bas ET < 25). Le gate de note évite de flagger un titre médiocre
 * juste parce qu'il est optiquement bon marché.
 */
export function isOpportunity(percentile: number | null, pfcf: number | null, score10: number | null): boolean {
  return isPfcfOpportunity(percentile, pfcf) && score10 != null && score10 >= PFCF_OPP_MIN_SCORE10;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        adjclose?: Array<{ adjclose?: (number | null)[] }>;
        quote?: Array<{ close?: (number | null)[] }>;
      };
    }>;
    error?: { description?: string } | null;
  };
}

/** Récupère les prix historiques (close ajusté splits/dividendes) depuis Yahoo. */
async function fetchPriceHistory(
  ticker: string,
  years: number,
  interval: '1d' | '1wk' | '1mo',
): Promise<TimeseriesPoint[]> {
  return yahooLimiter.schedule(async () => {
    const period2 = Math.floor(Date.now() / 1000);
    const period1 = period2 - Math.ceil(years * 365.25) * 24 * 3600;
    const url = `${CHART_BASE}/${encodeURIComponent(ticker)}`
      + `?period1=${period1}&period2=${period2}`
      + `&interval=${interval}`
      + `&events=history`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Yahoo chart HTTP ${res.status}`);
    const data = (await res.json()) as YahooChartResponse;
    if (data.chart?.error) throw new Error(`Yahoo chart: ${data.chart.error.description}`);
    const result = data.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    // adjclose = prix ajustés des dividendes ET splits → c'est ce qu'on veut
    const closes = result?.indicators?.adjclose?.[0]?.adjclose
                 ?? result?.indicators?.quote?.[0]?.close
                 ?? [];
    const points: TimeseriesPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const v = closes[i];
      if (typeof ts !== 'number' || typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
      points.push({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        value: v,
      });
    }
    points.sort((a, b) => a.date.localeCompare(b.date));
    return points;
  });
}


/**
 * Index : pour une date `t`, retrouve le dernier point de la série dont date ≤ t.
 * Renvoie null si pas de point récent (within `maxStalenessDays`).
 */
function findLatestAsOf<T extends { date: string }>(
  series: T[],
  asOfIso: string,
  maxStalenessDays = 200,
): T | null {
  // Hypothèse : series triée par date croissante.
  // Pour perf on pourrait binary search, mais N max ~50 quarters → linéaire OK.
  let candidate: T | null = null;
  for (const p of series) {
    if (p.date <= asOfIso) candidate = p;
    else break;
  }
  if (!candidate) return null;
  const ageMs = new Date(asOfIso).getTime() - new Date(candidate.date).getTime();
  if (ageMs > maxStalenessDays * 24 * 3600 * 1000) return null;
  return candidate;
}

/**
 * Calcule la timeseries de P/FCF pour un ticker sur une fenêtre donnée.
 *
 * @param ticker  Symbole boursier (en majuscules)
 * @param years   Profondeur de l'historique (1, 5, 10, 20, 50 pour "All")
 */
export async function getPfcfHistory(ticker: string, years: number): Promise<PfcfHistoryPoint[]> {
  // ─── Décide la source selon US/EU ────────────────────────────────────
  // EU ticker (NESN.SW, COPN.SW…) : Yahoo n'a QUE l'annuel → on calcule un P/FCF
  // par année (4 points max). US ticker : Finnhub quarterly + TTM rolling (60+ pts).
  const resolved = await resolveYahooTicker(ticker).catch(() => null);
  const isEuTicker = !!resolved && resolved.symbol !== ticker;

  if (isEuTicker && resolved) {
    return getPfcfHistoryAnnualYahoo(resolved.symbol, years);
  }

  // Path US : tente Finnhub quarterly d'abord (vraies TTM rolling, ~60 pts).
  // Si Finnhub renvoie 0 pt (cas des ADRs étrangers comme ASML, NSRGY, TSM qui ne filent
  // que des 20-F annuels avec la SEC → financials-reported vide), fallback sur
  // l'annual Yahoo (même flow que pour les EU, 4 pts annuels mais c'est mieux que rien).
  const usResult = await getPfcfHistoryUs(ticker, years);
  if (usResult.length === 0) {
    console.log(`[pfcf ${ticker}] Finnhub vide → fallback annual Yahoo (probablement un ADR étranger)`);
    return getPfcfHistoryAnnualYahoo(resolved?.symbol ?? ticker, years);
  }
  return usResult;
}

/** Path US : Finnhub quarterly + TTM rolling, ~60-240 points selon l'interval. */
async function getPfcfHistoryUs(ticker: string, years: number): Promise<PfcfHistoryPoint[]> {
  // Choix de résolution : 1Y = weekly (52 pts), au-delà = monthly (60-600 pts)
  const interval: '1d' | '1wk' | '1mo' = years <= 1 ? '1wk' : '1mo';

  // Fenêtre FCF : besoin de 1 an supplémentaire pour calculer le TTM du premier point
  const fcfYears = years + 1;

  // FCF TTM AJUSTÉ DU SBC (CFO − CapEx − SBC) — même définition que le P/FCF de la carte
  // (metrics.pfcfTTM = marketCap / adjFcfTtm). On NE prend plus le FCF brut, sinon le graphe
  // et le percentile divergent de la carte (cas DocuSign : 10× brut vs 25× ajusté).
  const [prices, adjFcfTtm, sharesQ] = await Promise.all([
    fetchPriceHistory(ticker, years, interval),
    getAdjustedFcfTtmSeries(ticker, fcfYears),
    getReportedTimeseries(ticker, 'shares', 'quarterly', fcfYears),
  ]);

  if (prices.length === 0) {
    console.warn(`[pfcf ${ticker}] aucun prix Yahoo`);
    return [];
  }
  if (adjFcfTtm.length < 1 || sharesQ.length < 4) {
    console.warn(`[pfcf ${ticker}] pas assez de quarters (adjFcfTtm=${adjFcfTtm.length}, shares=${sharesQ.length})`);
    return [];
  }

  const points: PfcfHistoryPoint[] = [];
  for (const p of prices) {
    const ttm = findLatestAsOf(adjFcfTtm, p.date);   // {date, value} = FCF ajusté TTM
    const sh = findLatestAsOf(sharesQ, p.date);
    if (!ttm || !sh) continue;
    if (ttm.value <= 0 || sh.value <= 0) continue;   // FCF ajusté ≤ 0 → P/FCF non pertinent (omis)
    const marketCap = p.value * sh.value;
    const pfcf = marketCap / ttm.value;
    if (!Number.isFinite(pfcf) || pfcf <= 0) continue;
    if (pfcf > 200) continue;   // FCF ajusté ≈ 0 → multiple explosif (>200× = rendement FCF <0,5%) → bruit
    points.push({ date: p.date, pfcf: Math.round(pfcf * 100) / 100 });
  }

  console.log(`[pfcf ${ticker}] US ${points.length} pts (${interval}, FCF ajusté SBC) — prices=${prices.length} adjFcf=${adjFcfTtm.length} sharesQ=${sharesQ.length}`);
  return points;
}

/**
 * Path "annual Yahoo" : utilisé quand le quarterly Finnhub est indispo.
 *
 * 2 cas d'usage :
 *   1. Tickers européens (NESN.SW, COPN.SW…) résolus via suffixe
 *   2. ADRs étrangers cotés US (ASML, NSRGY, TSM…) qui filent en 20-F annuel
 *      → Finnhub /financials-reported renvoie 0 quarter, on tombe sur ce path
 *
 * Yahoo annual ~4 ans → 4 points P/FCF (1 par fin d'année fiscale) :
 *   pfcf(année N) = price(fin année N) × shares(année N, split-adj) / FCF(année N)
 */
async function getPfcfHistoryAnnualYahoo(yahooSymbol: string, years: number): Promise<PfcfHistoryPoint[]> {
  // Fetch direct des séries annuelles via le helper bas-niveau.
  // Note : on n'applique PLUS cumulativeSplitFactor sur les shares annuelles — Yahoo
  // restate déjà l'historique post-split (cas NVO 2:1 2023, AAPL 4:1 2020 vérifiés).
  // Double-comptage évité.
  const [annualFcf, annualShares, prices] = await Promise.all([
    fetchYahooAnnualBasic(yahooSymbol, 'annualFreeCashFlow'),
    fetchYahooAnnualBasic(yahooSymbol, 'annualDilutedAverageShares'),
    fetchPriceHistory(yahooSymbol, Math.max(years, 5), '1mo'),
  ]);
  if (annualFcf.length === 0 || annualShares.length === 0 || prices.length === 0) {
    console.warn(`[pfcf ${yahooSymbol}] EU pas assez de données (fcf=${annualFcf.length}, shares=${annualShares.length}, prices=${prices.length})`);
    return [];
  }

  // Index par année
  const fcfByYear: Record<string, number> = {};
  const sharesByYear: Record<string, number> = {};
  for (const p of annualFcf) fcfByYear[p.date.slice(0, 4)] = p.value;
  for (const p of annualShares) sharesByYear[p.date.slice(0, 4)] = p.value;

  // Pour chaque année où on a (FCF, shares), on trouve le prix de fin d'année correspondant
  const points: PfcfHistoryPoint[] = [];
  const annualDates = annualFcf.map(p => p.date).sort();
  for (const yearEnd of annualDates) {
    const yr = yearEnd.slice(0, 4);
    const fcf = fcfByYear[yr];
    const sh = sharesByYear[yr];
    if (fcf == null || fcf <= 0 || sh == null || sh <= 0) continue;
    // Le prix de la fin d'année : on cherche le price le plus proche (≤) de yearEnd
    let priceAt: number | null = null;
    for (const p of prices) {
      if (p.date <= yearEnd) priceAt = p.value;
      else break;
    }
    if (priceAt == null) continue;
    const marketCap = priceAt * sh;
    const pfcf = marketCap / fcf;
    if (!Number.isFinite(pfcf) || pfcf <= 0) continue;
    points.push({ date: yearEnd, pfcf: Math.round(pfcf * 100) / 100 });
  }

  console.log(`[pfcf ${yahooSymbol}] EU ${points.length} pts annual — fcf=${annualFcf.length} shares=${annualShares.length}`);
  return points;
}

/** Helper bas-niveau pour récupérer un type annuel Yahoo (sans crumb). */
async function fetchYahooAnnualBasic(symbol: string, type: string): Promise<Array<{ date: string; value: number }>> {
  return yahooLimiter.schedule(async () => {
    const BASE = 'https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries';
    const now = Math.floor(Date.now() / 1000);
    const url = `${BASE}/${encodeURIComponent(symbol)}?symbol=${encodeURIComponent(symbol)}&type=${encodeURIComponent(type)}&period1=${now - 10 * 365 * 86400}&period2=${now}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) return [];
      const data = await res.json() as { timeseries?: { result?: Array<Record<string, unknown> & { meta?: { type?: string[] } }> } };
      const result = data.timeseries?.result?.find(r => r.meta?.type?.includes(type));
      const rows = (result?.[type] as Array<{ asOfDate?: string; reportedValue?: { raw?: number } }> | undefined) ?? [];
      return rows
        .map(r => (r.asOfDate && typeof r.reportedValue?.raw === 'number')
          ? { date: r.asOfDate, value: r.reportedValue.raw }
          : null)
        .filter((x): x is { date: string; value: number } => x !== null)
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch {
      return [];
    }
  });
}
