/**
 * Ablation des 10 critères CHIFFRÉS — « lequel ajoute du rendement ? ».
 * Pour chaque titre on calcule les 10 statuts à chaque trimestre UNE fois, puis on rejoue la
 * stratégie en retirant un critère à la fois (note recalculée sur les 9 restants, re-normalisée /10).
 * Si retirer un critère FAIT BAISSER l'alpha/le hit-rate → ce critère AJOUTE de la valeur.
 * Si le retirer AMÉLIORE → critère neutre/nuisible.
 *
 * NB : les 15 critères QUALITATIFS (GPT) ne sont pas dans la note historique → non ablatables ici
 * (biais de rétrospective) ; leur valeur se mesure seulement en forward.
 */
import { readTicker, readBenchmark, type PricePoint } from '../store.js';
import { scoreAsOfDb } from './scoreAsOf.js';
import { loadSeriesMap } from './dbSource.js';
import { monthEnds } from './runner.js';

export const QUANT_KEYS = [
  'netMargin', 'revenueGrowth5y', 'fcfGrowth5y', 'shareCount5y', 'fcfMargin',
  'operatingLeverage', 'cashRoce', 'netDebtFcf', 'cashConversion', 'currentRatio',
] as const;

export interface BaseCfg { detectStart: string; detectEnd: string; today: string; stepMonths: number; entryMin: number; exitBelow: number }

const tsOf = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00Z').getTime();
const yrs = (a: string, b: string) => Math.max(1 / 365, (tsOf(b) - tsOf(a)) / (365.25 * 86_400_000));
function adjAt(prices: PricePoint[], date: string): number | null {
  let v: number | null = null;
  for (const p of prices) { if (p.date <= date) v = p.adjClose; else break; }
  return v;
}
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]!; };

interface DatePt { date: string; st: { key: string; statut: string }[]; pfcfTTM: number | null; pfcfCurrent: number | null; pct: number | null }

/** Note /10 recalculée sur les critères INCLUS (en excluant `exclude`), re-normalisée. */
function score10From(st: { key: string; statut: string }[], exclude: string | null): number {
  const inc = exclude ? st.filter((s) => s.key !== exclude) : st;
  if (!inc.length) return 0;
  const pass = inc.filter((s) => s.statut === 'pass').length;
  const warn = inc.filter((s) => s.statut === 'warn').length;
  return Math.round(((pass + Math.round(warn * 0.5)) / inc.length) * 10);
}
function isOpp(sc: number, pt: DatePt, entryMin: number): boolean {
  return sc >= entryMin
    && pt.pfcfTTM != null && pt.pfcfTTM > 0 && pt.pfcfTTM < 25
    && pt.pct != null && pt.pct <= 10
    && pt.pfcfCurrent != null && pt.pfcfCurrent > 0 && pt.pfcfCurrent < 25;
}

function evalStrategy(series: DatePt[], prices: PricePoint[], bench: PricePoint[], cfg: BaseCfg, ablate: string | null): { alpha: number; beat: boolean } | null {
  const entry = series.find((p) => p.date <= cfg.detectEnd && isOpp(score10From(p.st, ablate), p, cfg.entryMin));
  if (!entry) return null;
  let exitDate = cfg.today;
  const ex = series.find((p) => p.date > entry.date && score10From(p.st, ablate) < cfg.exitBelow);
  if (ex) exitDate = ex.date;
  const eP = adjAt(prices, entry.date), xP = adjAt(prices, exitDate), bE = adjAt(bench, entry.date), bX = adjAt(bench, exitDate);
  if (eP == null || xP == null || bE == null || bX == null || eP <= 0 || bE <= 0) return null;
  const y = yrs(entry.date, exitDate);
  const alpha = (Math.pow(xP / eP, 1 / y) - 1) - (Math.pow(bX / bE, 1 / y) - 1);
  return { alpha, beat: alpha > 0 };
}

export interface AblationRow { ablated: string; nPositions: number; alphaMedian: number; hitRate: number }

export async function runAblation(tickers: string[], cfg: BaseCfg, onProgress?: (i: number, n: number) => void): Promise<AblationRow[]> {
  const bench = readBenchmark('SPY');
  if (!bench || bench.length === 0) throw new Error('Benchmark SPY absent');
  const dates = monthEnds(cfg.detectStart, cfg.today, cfg.stepMonths);
  const variants: (string | null)[] = [null, ...QUANT_KEYS];
  const acc = new Map<string | null, { alpha: number; beat: boolean }[]>();
  for (const v of variants) acc.set(v, []);

  for (let i = 0; i < tickers.length; i++) {
    onProgress?.(i + 1, tickers.length);
    const data = readTicker(tickers[i]!);
    if (!data || data.yahoo.prices.length < 24) continue;
    const seriesMap = await loadSeriesMap(tickers[i]!);
    if (seriesMap.size === 0) continue;

    const series: DatePt[] = [];
    for (const d of dates) {
      const r = await scoreAsOfDb(data, d, { seriesMap });
      series.push({ date: d, st: r.chiffres.map((c) => ({ key: c.key, statut: c.statut })), pfcfTTM: r.pfcfTTM, pfcfCurrent: r.pfcfCurrent, pct: r.pfcfPercentile });
    }
    for (const v of variants) {
      const res = evalStrategy(series, data.yahoo.prices, bench, cfg, v);
      if (res) acc.get(v)!.push(res);
    }
  }

  return variants.map((v) => {
    const ps = acc.get(v)!; const n = ps.length;
    return { ablated: v ?? '(baseline 10)', nPositions: n, alphaMedian: median(ps.map((p) => p.alpha)), hitRate: n ? ps.filter((p) => p.beat).length / n : 0 };
  });
}
