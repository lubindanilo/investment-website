/**
 * Séries-RATIO dérivées pour les histogrammes (marges, conversion, dette/FCF).
 *
 * Problème résolu : /api/timeseries ne sait servir qu'une grandeur ABSOLUE (revenue, fcf…).
 * Les cartes qui sont des ratios (marge nette, marge FCF, levier op, dette/FCF, conversion
 * cash) ouvraient donc un graphe du NUMÉRATEUR brut, pas du ratio. Ce service calcule le
 * vrai ratio dans le temps.
 *
 * Méthode = TTM glissant (cohérent avec cashRoceHistory / pfcfHistory et avec la valeur de
 * la carte → le dernier point du graphe ≈ la valeur affichée) :
 *   marge(t)        = numérateur_TTM(t) / dénominateur_TTM(t)         (en %)
 *   netDebtFcf(t)   = (dette(t) − cash(t)) [snapshot] / FCF_adj_TTM(t) (en ×)
 *
 * Sources, comme les autres graphes-ratio :
 *   - US (Finnhub quarterly) : TTM glissant sur ~20 trimestres
 *   - EU + ADRs étrangers 20-F (Yahoo annual) : ratio par exercice (~4-5 ans)
 *
 * Le FCF utilisé côté US est le FCF ajusté SBC (getAdjustedFcfTtmSeries) — identique à la
 * carte. Côté annuel Yahoo c'est le FCF brut (comme pfcfHistory/cashRoceHistory).
 */
import type { RatioMetricKey, TimeseriesPoint } from '@lubin/shared';
import { getReportedTimeseries, getAdjustedFcfTtmSeries } from './finnhubFundamentals.js';
import { resolveYahooTicker } from './yahooResolve.js';
import { yahooLimiter } from '../lib/limiter.js';

const TIMESERIES_BASE = 'https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Lubin-Investment/0.1';

/** Unité d'affichage de chaque ratio (alignée sur CriterionHistogram.unit côté shared). */
const RATIO_UNIT: Record<RatioMetricKey, 'percent' | 'multiple'> = {
  netMargin: 'percent',
  fcfMargin: 'percent',
  operatingMargin: 'percent',
  cashConversion: 'multiple', // ratio FCF/RN (ex 1.05×) — même unité que la carte (fmtRaw)
  netDebtFcf: 'multiple',
};

/** Facteur d'échelle : 100 pour exprimer une marge en points de %, 1 pour un multiple ×. */
function scaleFor(ratio: RatioMetricKey): number {
  return RATIO_UNIT[ratio] === 'percent' ? 100 : 1;
}

export interface RatioTimeseriesResult {
  points: TimeseriesPoint[];
  unit: 'percent' | 'multiple';
  /** Granularité réellement produite : 'quarterly' (US TTM) ou 'annual' (EU/ADR). */
  freq: 'quarterly' | 'annual';
  /** true uniquement pour les vrais tickers EU (suffixe d'exchange) → masque les boutons de période. */
  isEuTicker: boolean;
}

// ─── Helpers de combinaison de séries ────────────────────────────────────────

/** Somme glissante TTM (4 trimestres) sur une série quarterly triée. */
function rollingTtmSum(points: TimeseriesPoint[]): TimeseriesPoint[] {
  const s = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const out: TimeseriesPoint[] = [];
  for (let i = 3; i < s.length; i++) {
    out.push({ date: s[i]!.date, value: s[i]!.value + s[i - 1]!.value + s[i - 2]!.value + s[i - 3]!.value });
  }
  return out;
}

/** num(t) / den(t) joint par date exacte. scale=100 pour les %, 1 pour les multiples. */
function divideByDate(num: TimeseriesPoint[], den: TimeseriesPoint[], scale: number): TimeseriesPoint[] {
  const denByDate = new Map(den.map(p => [p.date, p.value]));
  const out: TimeseriesPoint[] = [];
  for (const n of num) {
    const d = denByDate.get(n.date);
    if (d == null || d <= 0) continue; // dénominateur ≤ 0 → ratio non pertinent (skip)
    const r = n.value / d;
    if (!Number.isFinite(r)) continue;
    out.push({ date: n.date, value: r * scale });
  }
  return out;
}

/** a(t) − b(t) joint par date exacte (pour netDebt = dette − cash). */
function subtractByDate(a: TimeseriesPoint[], b: TimeseriesPoint[]): TimeseriesPoint[] {
  const bByDate = new Map(b.map(p => [p.date, p.value]));
  const out: TimeseriesPoint[] = [];
  for (const p of a) {
    const other = bByDate.get(p.date);
    if (other == null) continue;
    out.push({ date: p.date, value: p.value - other });
  }
  return out;
}

/** Filtre une série sur la fenêtre demandée. */
function filterWindow(points: TimeseriesPoint[], years: number): TimeseriesPoint[] {
  const cutoff = Date.now() - years * 365.25 * 24 * 3600 * 1000;
  return points
    .filter(p => new Date(p.date + 'T00:00:00Z').getTime() >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Path US : Finnhub quarterly + TTM glissant ──────────────────────────────

async function ttmOf(ticker: string, metric: 'revenue' | 'netIncome' | 'operatingIncome', windowYears: number): Promise<TimeseriesPoint[]> {
  return rollingTtmSum(await getReportedTimeseries(ticker, metric, 'quarterly', windowYears));
}

async function fcfAdjTtm(ticker: string, years: number): Promise<TimeseriesPoint[]> {
  return (await getAdjustedFcfTtmSeries(ticker, years)).map(p => ({ date: p.date, value: p.value }));
}

async function computeUsRatio(ticker: string, ratio: RatioMetricKey, years: number): Promise<TimeseriesPoint[]> {
  const W = years + 1; // +1 an pour amorcer le premier TTM
  const scale = scaleFor(ratio);
  let raw: TimeseriesPoint[];
  switch (ratio) {
    case 'fcfMargin': {
      const [fcf, rev] = await Promise.all([fcfAdjTtm(ticker, years), ttmOf(ticker, 'revenue', W)]);
      raw = divideByDate(fcf, rev, scale);
      break;
    }
    case 'netMargin': {
      const [ni, rev] = await Promise.all([ttmOf(ticker, 'netIncome', W), ttmOf(ticker, 'revenue', W)]);
      raw = divideByDate(ni, rev, scale);
      break;
    }
    case 'operatingMargin': {
      const [op, rev] = await Promise.all([ttmOf(ticker, 'operatingIncome', W), ttmOf(ticker, 'revenue', W)]);
      raw = divideByDate(op, rev, scale);
      break;
    }
    case 'cashConversion': {
      // FCF_adj_TTM / Net Income_TTM (×). Skip les trimestres à NI ≤ 0 (ratio non pertinent).
      const [fcf, ni] = await Promise.all([fcfAdjTtm(ticker, years), ttmOf(ticker, 'netIncome', W)]);
      raw = divideByDate(fcf, ni, scale);
      break;
    }
    case 'netDebtFcf': {
      // (dette − cash) snapshot / FCF_adj_TTM (×). Skip si FCF ≤ 0.
      const [fcf, debt, cash] = await Promise.all([
        fcfAdjTtm(ticker, years),
        getReportedTimeseries(ticker, 'totalDebt', 'quarterly', W),
        getReportedTimeseries(ticker, 'cashAndEquivalents', 'quarterly', W),
      ]);
      const netDebt = subtractByDate(debt, cash);
      raw = divideByDate(netDebt, fcf, scale);
      break;
    }
  }
  return filterWindow(raw, years);
}

// ─── Path EU/ADR : Yahoo annual, ratio par exercice ──────────────────────────

/** Helper bas-niveau Yahoo annual (clone du pattern pfcfHistory/cashRoceHistory). */
async function fetchYahooAnnual(symbol: string, type: string): Promise<TimeseriesPoint[]> {
  return yahooLimiter.schedule(async () => {
    const now = Math.floor(Date.now() / 1000);
    const url = `${TIMESERIES_BASE}/${encodeURIComponent(symbol)}?symbol=${encodeURIComponent(symbol)}&type=${encodeURIComponent(type)}&period1=${now - 10 * 365 * 86400}&period2=${now}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) return [];
      const data = await res.json() as { timeseries?: { result?: Array<Record<string, unknown> & { meta?: { type?: string[] } }> } };
      const result = data.timeseries?.result?.find(r => r.meta?.type?.includes(type));
      const rows = (result?.[type] as Array<{ asOfDate?: string; reportedValue?: { raw?: number } }> | undefined) ?? [];
      return rows
        .map(r => (r.asOfDate && typeof r.reportedValue?.raw === 'number') ? { date: r.asOfDate, value: r.reportedValue.raw } : null)
        .filter((x): x is TimeseriesPoint => x !== null)
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch {
      return [];
    }
  });
}

/** num(année) / den(année) indexé par année, scale=100 pour %, 1 pour ×. */
function divideByYear(num: TimeseriesPoint[], den: TimeseriesPoint[], scale: number): TimeseriesPoint[] {
  const denByYear = new Map(den.map(p => [p.date.slice(0, 4), p.value]));
  const out: TimeseriesPoint[] = [];
  for (const n of num) {
    const d = denByYear.get(n.date.slice(0, 4));
    if (d == null || d <= 0) continue;
    const r = n.value / d;
    if (!Number.isFinite(r)) continue;
    out.push({ date: n.date, value: r * scale });
  }
  return out;
}

function subtractByYear(a: TimeseriesPoint[], b: TimeseriesPoint[]): TimeseriesPoint[] {
  const bByYear = new Map(b.map(p => [p.date.slice(0, 4), p.value]));
  const out: TimeseriesPoint[] = [];
  for (const p of a) {
    const other = bByYear.get(p.date.slice(0, 4));
    if (other == null) continue;
    out.push({ date: p.date, value: p.value - other });
  }
  return out;
}

async function computeAnnualRatio(symbol: string, ratio: RatioMetricKey, years: number): Promise<TimeseriesPoint[]> {
  const scale = scaleFor(ratio);
  let raw: TimeseriesPoint[] = [];
  if (ratio === 'fcfMargin' || ratio === 'netMargin' || ratio === 'operatingMargin') {
    const numType = ratio === 'fcfMargin' ? 'annualFreeCashFlow' : ratio === 'netMargin' ? 'annualNetIncome' : 'annualOperatingIncome';
    const [num, rev] = await Promise.all([fetchYahooAnnual(symbol, numType), fetchYahooAnnual(symbol, 'annualTotalRevenue')]);
    raw = divideByYear(num, rev, scale);
  } else if (ratio === 'cashConversion') {
    const [fcf, ni] = await Promise.all([fetchYahooAnnual(symbol, 'annualFreeCashFlow'), fetchYahooAnnual(symbol, 'annualNetIncome')]);
    raw = divideByYear(fcf, ni, scale);
  } else { // netDebtFcf
    const [fcf, debt, cash] = await Promise.all([
      fetchYahooAnnual(symbol, 'annualFreeCashFlow'),
      fetchYahooAnnual(symbol, 'annualTotalDebt'),
      fetchYahooAnnual(symbol, 'annualCashAndCashEquivalents'),
    ]);
    const netDebt = subtractByYear(debt, cash);
    raw = divideByYear(netDebt, fcf, scale);
  }
  return filterWindow(raw, Math.max(years, 5));
}

// ─── Point d'entrée ──────────────────────────────────────────────────────────

/**
 * Série temporelle d'un ratio dérivé. US → TTM glissant Finnhub ; EU/ADR → annuel Yahoo.
 */
export async function getRatioTimeseries(ticker: string, ratio: RatioMetricKey, years: number): Promise<RatioTimeseriesResult> {
  const unit = RATIO_UNIT[ratio];
  const resolved = await resolveYahooTicker(ticker).catch(() => null);
  const isEuTicker = !!resolved && resolved.symbol !== ticker;

  if (isEuTicker && resolved) {
    const points = await computeAnnualRatio(resolved.symbol, ratio, years);
    console.log(`[ratio ${ticker}/${ratio}] EU annual ${points.length} pts`);
    return { points, unit, freq: 'annual', isEuTicker: true };
  }

  const us = await computeUsRatio(ticker, ratio, years);
  if (us.length === 0) {
    // ADR étranger 20-F (Finnhub quarterly vide) → repli annuel Yahoo.
    const points = await computeAnnualRatio(resolved?.symbol ?? ticker, ratio, years);
    console.log(`[ratio ${ticker}/${ratio}] ADR/20-F → Yahoo annual ${points.length} pts`);
    return { points, unit, freq: 'annual', isEuTicker: false };
  }
  console.log(`[ratio ${ticker}/${ratio}] US TTM ${us.length} pts`);
  return { points: us, unit, freq: 'quarterly', isEuTicker: false };
}
