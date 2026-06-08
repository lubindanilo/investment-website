/**
 * JUGE DE PAIX : portefeuille calendaire des pépites (flag opportunity, 1ʳᵉ ≤2022) avec
 * sortie HOLD vs P/FCF≥médiane historique, segmenté par taille de cap. Chaque mois on détient
 * les positions ouvertes (équipondéré) ; parqué S&P si aucune → on isole la sélection.
 * Sortie : CAGR, vol, Sharpe (rf≈0), max DD, %investi — vs S&P sur la même période.
 */
import { prisma } from '../../../api/src/db/client.js';
import { scoreAsOfDb } from '../engine/scoreAsOf.js';
import { loadSeriesMap } from '../engine/dbSource.js';
import { monthEnds } from '../engine/runner.js';
import { listTickers, readTicker, readBenchmark, type PricePoint } from '../store.js';

const _log = console.log.bind(console);
console.log = (...a: unknown[]) => { if (String(a[0] ?? '').startsWith('[')) return; _log(...a); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function wake(): Promise<void> { for (let i = 0; i < 15; i++) { try { await prisma.$queryRawUnsafe('SELECT 1'); return; } catch { process.stderr.write('.'); await sleep(5000); } } throw new Error('Neon injoignable'); }

const TODAY = process.env.TODAY ?? '2026-06-05';
const DETECT_END = '2022-12-31';
const tsOf = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00Z').getTime();
const yrs = (a: string, b: string) => Math.max(0.1, (tsOf(b) - tsOf(a)) / (365.25 * 86_400_000));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length : 0);
function std(xs: number[]): number { if (xs.length < 2) return 0; const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); }
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]!; };
const pctS = (x: number) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%';
function adjAt(prices: PricePoint[], date: string): number | null { let v: number | null = null; for (const p of prices) { if (p.date <= date) v = p.adjClose; else break; } return v; }
function ret(prices: PricePoint[], from: string, to: string): number { const a = adjAt(prices, from), b = adjAt(prices, to); return a != null && b != null && a > 0 ? b / a - 1 : 0; }
function metrics(rets: number[], span: number): { cagr: number; vol: number; sharpe: number; maxDD: number } {
  let eq = 1, peak = 1, maxDD = 0;
  for (const r of rets) { eq *= 1 + r; if (eq > peak) peak = eq; const dd = eq / peak - 1; if (dd < maxDD) maxDD = dd; }
  return { cagr: Math.pow(eq, 1 / span) - 1, vol: std(rets) * Math.sqrt(12), sharpe: std(rets) * Math.sqrt(12) > 0 ? (Math.pow(eq, 1 / span) - 1) / (std(rets) * Math.sqrt(12)) : 0, maxDD };
}
function bucketOf(mcM: number | null): string {
  if (mcM == null) return '?';
  if (mcM < 300) return 'micro'; if (mcM < 2000) return 'small'; if (mcM < 10000) return 'mid'; return 'large';
}

interface Pos { ticker: string; entryDate: string; mcapM: number | null; prices: PricePoint[]; pfcfSeries: { date: string; pfcf: number }[]; histMedianPfcf: number }

async function main(): Promise<void> {
  await wake();
  const bench = readBenchmark('SPY'); if (!bench) throw new Error('SPY absent');
  const detectDates = monthEnds('2014-01-01', DETECT_END, 3);
  const calendar = monthEnds('2014-01-01', TODAY, 1);
  const tickers = listTickers();
  console.log(`Portefeuille P/FCF-exit × taille — détection ${tickers.length} titres…\n`);

  const positions: Pos[] = [];
  for (let i = 0; i < tickers.length; i++) {
    process.stderr.write(`\r[${i + 1}/${tickers.length}] (${positions.length})      `);
    const data = readTicker(tickers[i]!); if (!data || data.yahoo.prices.length < 24) continue;
    const seriesMap = await loadSeriesMap(tickers[i]!); if (seriesMap.size === 0) continue;
    let entryDate: string | null = null, mcapM: number | null = null;
    for (const d of detectDates) {
      const r = await scoreAsOfDb(data, d, { seriesMap });
      if (r.opportunity) { entryDate = d; mcapM = r.metrics.marketCap ?? null; break; }
    }
    if (!entryDate) continue;
    const full = await scoreAsOfDb(data, TODAY, { seriesMap, debugSeries: true });
    const series = full.pfcfSeries ?? [];
    const hist = series.filter((p) => p.date <= entryDate!).map((p) => p.pfcf);
    positions.push({ ticker: tickers[i]!, entryDate, mcapM, prices: data.yahoo.prices, pfcfSeries: series, histMedianPfcf: median(hist) });
  }
  process.stderr.write('\r');
  console.log(`\n${positions.length} pépites.\n`);

  const span = yrs(calendar[0]!, calendar[calendar.length - 1]!);
  const spyRets: number[] = [];
  for (let i = 1; i < calendar.length; i++) spyRets.push(ret(bench, calendar[i - 1]!, calendar[i]!));
  const spy = metrics(spyRets, span);

  const holdExit = (_p: Pos) => TODAY;
  const medExit = (p: Pos) => { const h = p.pfcfSeries.find((q) => q.date > p.entryDate && q.pfcf >= p.histMedianPfcf); return h ? h.date : TODAY; };

  function equity(subset: Pos[], exitFn: (p: Pos) => string): { n: number; pctInvested: number; cagr: number; vol: number; sharpe: number; maxDD: number } {
    const ex = subset.map((p) => ({ p, exit: exitFn(p) }));
    const rets: number[] = []; let invested = 0;
    for (let i = 1; i < calendar.length; i++) {
      const mPrev = calendar[i - 1]!, m = calendar[i]!;
      const held = ex.filter((e) => e.p.entryDate <= mPrev && mPrev < e.exit);
      if (held.length) { invested++; rets.push(mean(held.map((e) => ret(e.p.prices, mPrev, m)))); }
      else rets.push(spyRets[i - 1]!);
    }
    return { n: subset.length, pctInvested: invested / (calendar.length - 1), ...metrics(rets, span) };
  }

  const segments: { label: string; sub: Pos[] }[] = [
    { label: 'TOUTES', sub: positions },
    { label: 'small', sub: positions.filter((p) => bucketOf(p.mcapM) === 'small') },
    { label: 'mid', sub: positions.filter((p) => bucketOf(p.mcapM) === 'mid') },
    { label: 'large', sub: positions.filter((p) => bucketOf(p.mcapM) === 'large') },
    { label: 'micro', sub: positions.filter((p) => bucketOf(p.mcapM) === 'micro') },
  ];

  const row = (lbl: string, m: ReturnType<typeof equity>) =>
    console.log(`${lbl.padEnd(22)} ${String(m.n).padStart(4)}  ${(m.pctInvested * 100).toFixed(0).padStart(4)}%   ${pctS(m.cagr).padStart(7)} ${(m.vol * 100).toFixed(1).padStart(5)}%   ${m.sharpe.toFixed(2).padStart(5)}   ${pctS(m.maxDD).padStart(7)}`);

  console.log('segment / règle         nPos  %inv    CAGR     vol     Sharpe   maxDD');
  for (const s of segments) {
    if (!s.sub.length) continue;
    row(`${s.label} · HOLD`, equity(s.sub, holdExit));
    row(`${s.label} · P/FCF≥méd`, equity(s.sub, medExit));
  }
  console.log(`${'S&P 500 (100%)'.padEnd(22)}    —     —    ${pctS(spy.cagr).padStart(7)} ${(spy.vol * 100).toFixed(1).padStart(5)}%   ${spy.sharpe.toFixed(2).padStart(5)}   ${pctS(spy.maxDD).padStart(7)}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
