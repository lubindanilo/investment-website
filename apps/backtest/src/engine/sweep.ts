/**
 * Sweep de configs — entrée (note min) × seuil de percentile P/FCF × règle de sortie.
 * Efficace : score trimestriel de CHAQUE titre calculé UNE fois, puis N configs appliquées dessus.
 *
 * Métriques ROBUSTES (pas d'annualisation sur fenêtres courtes, qui gonfle tout) :
 *   - hitRate = % de positions dont le rendement TOTAL bat le S&P sur la MÊME fenêtre ;
 *   - excessTotMedian = médiane de (rendement total titre − rendement total S&P).
 * On garde le CAGR/alpha annualisé en RÉFÉRENCE (moyenne), mais c'est secondaire/bruité.
 */
import { readTicker, readBenchmark, type PricePoint } from '../store.js';
import { scoreAsOfDb } from './scoreAsOf.js';
import { loadSeriesMap } from './dbSource.js';
import { monthEnds } from './runner.js';

export interface SweepConfig { label: string; entryMin: number; pctMax: number; exitBelow: number | null }
export interface BaseCfg { detectStart: string; detectEnd: string; today: string; stepMonths: number }

const tsOf = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00Z').getTime();
const yrs = (a: string, b: string) => Math.max(1 / 365, (tsOf(b) - tsOf(a)) / (365.25 * 86_400_000));
function adjAt(prices: PricePoint[], date: string): number | null {
  let v: number | null = null;
  for (const p of prices) { if (p.date <= date) v = p.adjClose; else break; }
  return v;
}
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]!; };
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length : 0);

interface DatePt { date: string; score10: number; pfcfTTM: number | null; pfcfCurrent: number | null; pct: number | null }
function isOpp(p: DatePt, entryMin: number, pctMax: number): boolean {
  return p.score10 >= entryMin
    && p.pfcfTTM != null && p.pfcfTTM > 0 && p.pfcfTTM < 25
    && p.pct != null && p.pct <= pctMax
    && p.pfcfCurrent != null && p.pfcfCurrent > 0 && p.pfcfCurrent < 25;
}

interface Pos { ret: number; benchRet: number; alphaAnn: number; years: number }
export interface SweepRow {
  label: string; nPositions: number;
  hitRate: number;             // % rendement total > S&P (même fenêtre) — métrique principale
  excessTotMedian: number;     // médiane (rendt total titre − rendt total S&P) — robuste
  retTotMedian: number;        // médiane rendement total titre
  benchTotMedian: number;      // médiane rendement total S&P
  alphaAnnMean: number;        // alpha annualisé moyen (référence, bruité)
  yearsMean: number;
}

export async function runSweep(tickers: string[], configs: SweepConfig[], base: BaseCfg, onProgress?: (i: number, n: number) => void): Promise<SweepRow[]> {
  const bench = readBenchmark('SPY');
  if (!bench || bench.length === 0) throw new Error('Benchmark SPY absent');
  const dates = monthEnds(base.detectStart, base.today, base.stepMonths);
  const acc = new Map<string, Pos[]>();
  for (const c of configs) acc.set(c.label, []);

  for (let i = 0; i < tickers.length; i++) {
    onProgress?.(i + 1, tickers.length);
    const data = readTicker(tickers[i]!);
    if (!data || data.yahoo.prices.length < 24) continue;
    const seriesMap = await loadSeriesMap(tickers[i]!);
    if (seriesMap.size === 0) continue;

    const pts: DatePt[] = [];
    for (const d of dates) {
      const r = await scoreAsOfDb(data, d, { seriesMap });
      pts.push({ date: d, score10: r.score10, pfcfTTM: r.pfcfTTM, pfcfCurrent: r.pfcfCurrent, pct: r.pfcfPercentile });
    }

    for (const c of configs) {
      const entry = pts.find((p) => p.date <= base.detectEnd && isOpp(p, c.entryMin, c.pctMax));
      if (!entry) continue;
      let exitDate = base.today;
      if (c.exitBelow != null) {
        const ex = pts.find((p) => p.date > entry.date && p.score10 < c.exitBelow!);
        if (ex) exitDate = ex.date;
      }
      const eP = adjAt(data.yahoo.prices, entry.date), xP = adjAt(data.yahoo.prices, exitDate);
      const bE = adjAt(bench, entry.date), bX = adjAt(bench, exitDate);
      if (eP == null || xP == null || bE == null || bX == null || eP <= 0 || bE <= 0) continue;
      const y = yrs(entry.date, exitDate), ret = xP / eP - 1, benchRet = bX / bE - 1;
      const alphaAnn = (Math.pow(1 + ret, 1 / y) - 1) - (Math.pow(1 + benchRet, 1 / y) - 1);
      acc.get(c.label)!.push({ ret, benchRet, alphaAnn, years: y });
    }
  }

  return configs.map((c) => {
    const ps = acc.get(c.label)!; const n = ps.length;
    return {
      label: c.label, nPositions: n,
      hitRate: n ? ps.filter((p) => p.ret > p.benchRet).length / n : 0,
      excessTotMedian: median(ps.map((p) => p.ret - p.benchRet)),
      retTotMedian: median(ps.map((p) => p.ret)),
      benchTotMedian: median(ps.map((p) => p.benchRet)),
      alphaAnnMean: mean(ps.map((p) => p.alphaAnn)),
      yearsMean: mean(ps.map((p) => p.years)),
    };
  });
}
