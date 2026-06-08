/**
 * Runner de backtest — stratégie « opportunité du moment » branchée sur la DB du site.
 *
 * Par titre :
 *   1. DÉTECTION : 1ʳᵉ date (fin de mois, ≤ detectEnd) où le titre est « opportunité du moment »
 *      (note ≥8/10 + P/FCF < 25 + P/FCF ≤ 10ᵉ percentile) — calculé via scoreAsOfDb (mêmes notes
 *      que le site, fondamentaux DB point-in-time).
 *   2. DÉTENTION : on garde, en re-scorant chaque mois ; SORTIE au 1ᵉʳ mois où la note repasse
 *      SOUS exitBelow (8). Sinon on tient jusqu'à aujourd'hui.
 *   3. RENDEMENT : total (adjClose, dividendes réinvestis) + CAGR + alpha vs SPY sur la fenêtre exacte.
 *
 * Équipondéré : chaque opportunité = une position. Détection ≤ 2022-12-31 (laisser mûrir le LT).
 */
import { readTicker, readBenchmark, type PricePoint } from '../store.js';
import { scoreAsOfDb } from './scoreAsOf.js';
import { loadSeriesMap } from './dbSource.js';

export interface Position {
  ticker: string;
  entryDate: string;
  exitDate: string;
  exitReason: 'score<8' | 'today';
  years: number;
  ret: number;        // rendement total (adjClose)
  cagr: number;
  benchRet: number;   // SPY total return, même fenêtre
  benchCagr: number;
  alpha: number;      // cagr − benchCagr
  entryScore: number;
  entryPfcf: number | null;
  entryPct: number | null;
}

export interface BacktestConfig {
  detectStart: string;  // 1ʳᵉ date de détection
  detectEnd: string;    // dernière (≤ 2022-12-31)
  today: string;        // borne de détention
  exitBelow: number;    // sortie si note < ce seuil (8)
  stepMonths: number;   // pas d'échantillonnage (3 = trimestriel — la note ne bouge qu'aux résultats)
}

const d10 = (s: string) => s.slice(0, 10);
const tsOf = (iso: string) => new Date(d10(iso) + 'T00:00:00Z').getTime();
const yearsBetween = (a: string, b: string) => Math.max(1 / 365, (tsOf(b) - tsOf(a)) / (365.25 * 86_400_000));

/** Fins de mois ISO de `start` (inclus) à `end` (inclus), par pas de `step` mois. */
export function monthEnds(start: string, end: string, step = 1): string[] {
  const out: string[] = [];
  let y = +start.slice(0, 4), m = +start.slice(5, 7);
  const ey = +end.slice(0, 4), em = +end.slice(5, 7);
  while (y < ey || (y === ey && m <= em)) {
    out.push(new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)); // dernier jour du mois m
    m += step; while (m > 12) { m -= 12; y++; }
  }
  return out;
}

/** adjClose le plus récent ≤ date (rendement total). */
function adjAt(prices: PricePoint[], date: string): number | null {
  let v: number | null = null;
  for (const p of prices) { if (p.date <= date) v = p.adjClose; else break; }
  return v;
}

/** Backteste UN titre. Renvoie null si jamais détecté opportunité (ou données insuffisantes). */
export async function backtestTicker(ticker: string, bench: PricePoint[], cfg: BacktestConfig): Promise<Position | null> {
  const data = readTicker(ticker);
  if (!data || data.yahoo.prices.length < 24) return null; // besoin de prix
  const seriesMap = await loadSeriesMap(ticker);
  if (seriesMap.size === 0) return null;                   // pas de fondamentaux DB

  // 1) DÉTECTION
  let entry: { date: string; score: number; pfcf: number | null; pct: number | null } | null = null;
  for (const d of monthEnds(cfg.detectStart, cfg.detectEnd, cfg.stepMonths)) {
    const r = await scoreAsOfDb(data, d, { seriesMap });
    if (r.opportunity) { entry = { date: d, score: r.score10, pfcf: r.pfcfCurrent, pct: r.pfcfPercentile }; break; }
  }
  if (!entry) return null;

  // 2) DÉTENTION → sortie au 1ᵉʳ pas note < exitBelow, sinon aujourd'hui
  let exitDate = cfg.today; let exitReason: Position['exitReason'] = 'today';
  for (const d of monthEnds(entry.date, cfg.today, cfg.stepMonths)) {
    if (d <= entry.date) continue;
    const r = await scoreAsOfDb(data, d, { seriesMap });
    if (r.score10 < cfg.exitBelow) { exitDate = d; exitReason = 'score<8'; break; }
  }

  // 3) RENDEMENT + alpha vs SPY
  const eP = adjAt(data.yahoo.prices, entry.date), xP = adjAt(data.yahoo.prices, exitDate);
  const bE = adjAt(bench, entry.date), bX = adjAt(bench, exitDate);
  if (eP == null || xP == null || bE == null || bX == null || eP <= 0 || bE <= 0) return null;
  const years = yearsBetween(entry.date, exitDate);
  const ret = xP / eP - 1, benchRet = bX / bE - 1;
  const cagr = Math.pow(1 + ret, 1 / years) - 1, benchCagr = Math.pow(1 + benchRet, 1 / years) - 1;
  return {
    ticker, entryDate: entry.date, exitDate, exitReason, years,
    ret, cagr, benchRet, benchCagr, alpha: cagr - benchCagr,
    entryScore: entry.score, entryPfcf: entry.pfcf, entryPct: entry.pct,
  };
}

export interface BacktestResult { positions: Position[]; summary: Record<string, number> }

/** Backteste une liste de titres (équipondéré). Séquentiel → garde la connexion DB chaude. */
export async function runBacktest(tickers: string[], cfg: BacktestConfig, onProgress?: (i: number, n: number, ticker: string) => void): Promise<BacktestResult> {
  const bench = readBenchmark('SPY');
  if (!bench || bench.length === 0) throw new Error('Benchmark SPY absent du store');
  const positions: Position[] = [];
  for (let i = 0; i < tickers.length; i++) {
    onProgress?.(i + 1, tickers.length, tickers[i]!);
    const p = await backtestTicker(tickers[i]!, bench, cfg).catch(() => null);
    if (p) positions.push(p);
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length : 0);
  const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]!; };
  const n = positions.length;
  return {
    positions,
    summary: {
      scanned: tickers.length,
      nPositions: n,
      cagrMean: mean(positions.map((p) => p.cagr)),
      cagrMedian: median(positions.map((p) => p.cagr)),
      benchCagrMean: mean(positions.map((p) => p.benchCagr)),
      alphaMean: mean(positions.map((p) => p.alpha)),
      alphaMedian: median(positions.map((p) => p.alpha)),
      hitRate: n ? positions.filter((p) => p.alpha > 0).length / n : 0,
      yearsMean: mean(positions.map((p) => p.years)),
    },
  };
}
