/**
 * Backtest PORTEFEUILLE calendaire (pour le risque ajusté). Pour chaque config :
 *   - on détermine entrée/sortie de chaque titre (même logique que le sweep) ;
 *   - on construit une courbe d'équité MENSUELLE : chaque mois on détient les positions ouvertes
 *     (équipondéré) ; s'il n'y en a aucune, on est parqué en S&P (pour isoler la valeur de la
 *     SÉLECTION, pas le market-timing) ;
 *   - on en tire CAGR, volatilité annualisée, Sharpe (rf≈0), max drawdown — vs S&P sur la même période.
 */
import { readTicker, readBenchmark, type PricePoint } from '../store.js';
import { scoreAsOfDb } from './scoreAsOf.js';
import { loadSeriesMap } from './dbSource.js';
import { monthEnds } from './runner.js';
import type { SweepConfig, BaseCfg } from './sweep.js';

const tsOf = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00Z').getTime();
const yrs = (a: string, b: string) => Math.max(0.1, (tsOf(b) - tsOf(a)) / (365.25 * 86_400_000));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length : 0);
function std(xs: number[]): number { if (xs.length < 2) return 0; const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); }
function adjAt(prices: PricePoint[], date: string): number | null { let v: number | null = null; for (const p of prices) { if (p.date <= date) v = p.adjClose; else break; } return v; }
function ret(prices: PricePoint[], from: string, to: string): number { const a = adjAt(prices, from), b = adjAt(prices, to); return a != null && b != null && a > 0 ? b / a - 1 : 0; }
function metrics(rets: number[], span: number): { cagr: number; vol: number; sharpe: number; maxDD: number } {
  let eq = 1, peak = 1, maxDD = 0;
  for (const r of rets) { eq *= 1 + r; if (eq > peak) peak = eq; const dd = eq / peak - 1; if (dd < maxDD) maxDD = dd; }
  const cagr = Math.pow(eq, 1 / span) - 1;
  const vol = std(rets) * Math.sqrt(12);
  return { cagr, vol, sharpe: vol > 0 ? cagr / vol : 0, maxDD };
}

interface DatePt { date: string; score10: number; pfcfTTM: number | null; pfcfCurrent: number | null; pct: number | null }
function isOpp(p: DatePt, entryMin: number, pctMax: number): boolean {
  return p.score10 >= entryMin && p.pfcfTTM != null && p.pfcfTTM > 0 && p.pfcfTTM < 25
    && p.pct != null && p.pct <= pctMax && p.pfcfCurrent != null && p.pfcfCurrent > 0 && p.pfcfCurrent < 25;
}

export interface PortfolioRow { label: string; nPositions: number; pctInvested: number; cagr: number; vol: number; sharpe: number; maxDD: number }

export async function runPortfolios(tickers: string[], configs: SweepConfig[], base: BaseCfg, onProgress?: (i: number, n: number) => void): Promise<{ rows: PortfolioRow[]; spy: { cagr: number; vol: number; sharpe: number; maxDD: number } }> {
  const bench = readBenchmark('SPY'); if (!bench || !bench.length) throw new Error('SPY absent');
  const detectDates = monthEnds(base.detectStart, base.today, base.stepMonths);
  const calendar = monthEnds(base.detectStart, base.today, 1); // mensuel pour la courbe d'équité
  const posByCfg = new Map<string, { ticker: string; entry: string; exit: string }[]>();
  for (const c of configs) posByCfg.set(c.label, []);
  const priceCache = new Map<string, PricePoint[]>();

  for (let i = 0; i < tickers.length; i++) {
    onProgress?.(i + 1, tickers.length);
    const data = readTicker(tickers[i]!); if (!data || data.yahoo.prices.length < 24) continue;
    const seriesMap = await loadSeriesMap(tickers[i]!); if (seriesMap.size === 0) continue;
    const pts: DatePt[] = [];
    for (const d of detectDates) { const r = await scoreAsOfDb(data, d, { seriesMap }); pts.push({ date: d, score10: r.score10, pfcfTTM: r.pfcfTTM, pfcfCurrent: r.pfcfCurrent, pct: r.pfcfPercentile }); }
    priceCache.set(tickers[i]!, data.yahoo.prices);
    for (const c of configs) {
      const entry = pts.find((p) => p.date <= base.detectEnd && isOpp(p, c.entryMin, c.pctMax));
      if (!entry) continue;
      let exit = base.today;
      if (c.exitBelow != null) { const ex = pts.find((p) => p.date > entry.date && p.score10 < c.exitBelow!); if (ex) exit = ex.date; }
      posByCfg.get(c.label)!.push({ ticker: tickers[i]!, entry: entry.date, exit });
    }
  }

  // S&P benchmark (mensuel)
  const spyRets: number[] = [];
  for (let i = 1; i < calendar.length; i++) spyRets.push(ret(bench, calendar[i - 1]!, calendar[i]!));
  const span = yrs(calendar[0]!, calendar[calendar.length - 1]!);
  const spy = metrics(spyRets, span);

  const rows: PortfolioRow[] = configs.map((c) => {
    const pos = posByCfg.get(c.label)!;
    const rets: number[] = []; let invested = 0;
    for (let i = 1; i < calendar.length; i++) {
      const mPrev = calendar[i - 1]!, m = calendar[i]!;
      const held = pos.filter((p) => p.entry <= mPrev && mPrev < p.exit);
      if (held.length) { invested++; rets.push(mean(held.map((p) => ret(priceCache.get(p.ticker)!, mPrev, m)))); }
      else rets.push(spyRets[i - 1]!); // parqué en S&P quand pas de pépite
    }
    return { label: c.label, nPositions: pos.length, pctInvested: invested / (calendar.length - 1), ...metrics(rets, span) };
  });
  return { rows, spy };
}
