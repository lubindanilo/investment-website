/**
 * Export EXHAUSTIF des pépites (flag `opportunity` de l'app, 1ʳᵉ détection ≤2022-12-31) :
 *   1. CSV résumé : 1 ligne/pépite (entrée, P/FCF d'entrée, percentile, rendement total vs S&P).
 *   2. CSV annuel : 1 ligne/(pépite, année) — cours fin d'année, rendement de l'année, P/FCF fin
 *      d'année, S&P de l'année, cumul depuis l'entrée → pour voir perf ET P/FCF côte à côte.
 *   3. Test de règles de SORTIE sur P/FCF (vs hold) — hitRate + excès médian vs S&P.
 *
 * La série P/FCF utilisée = celle calculée à AUJOURD'HUI (= exactement le graphe P/FCF du site).
 */
import fs from 'node:fs';
import path from 'node:path';
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
const yrs = (a: string, b: string) => Math.max(0.01, (tsOf(b) - tsOf(a)) / (365.25 * 86_400_000));
const pctS = (x: number) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%';
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]!; };
function adjAt(prices: PricePoint[], date: string): number | null { let v: number | null = null; for (const p of prices) { if (p.date <= date) v = p.adjClose; else break; } return v; }
function pfcfAt(series: { date: string; pfcf: number }[], date: string): number | null { let v: number | null = null; for (const p of series) { if (p.date <= date) v = p.pfcf; else break; } return v; }

interface Pepite { ticker: string; entryDate: string; entryPrice: number; entryPfcf: number; entryPct: number; entryScore: number; entryMcapM: number | null; prices: PricePoint[]; pfcfSeries: { date: string; pfcf: number }[]; histMedianPfcf: number }

/** Buckets de capitalisation (market cap en M$, à l'entrée) — convention US. */
function bucketOf(mcM: number | null): string {
  if (mcM == null) return '? inconnu';
  if (mcM < 300) return 'micro  <0,3 Md';
  if (mcM < 2000) return 'small  0,3-2 Md';
  if (mcM < 10000) return 'mid    2-10 Md';
  return 'large  >10 Md';
}
const BUCKET_ORDER = ['micro  <0,3 Md', 'small  0,3-2 Md', 'mid    2-10 Md', 'large  >10 Md', '? inconnu'];

async function main(): Promise<void> {
  await wake();
  const bench = readBenchmark('SPY'); if (!bench) throw new Error('SPY absent');
  const detectDates = monthEnds('2014-01-01', DETECT_END, 3);
  const tickers = listTickers();
  console.log(`Détection des pépites (flag opportunity, 1ʳᵉ ≤${DETECT_END}) sur ${tickers.length} titres…\n`);

  const pepites: Pepite[] = [];
  for (let i = 0; i < tickers.length; i++) {
    process.stderr.write(`\r[${i + 1}/${tickers.length}] (${pepites.length} pépites)      `);
    const data = readTicker(tickers[i]!); if (!data || data.yahoo.prices.length < 24) continue;
    const seriesMap = await loadSeriesMap(tickers[i]!); if (seriesMap.size === 0) continue;
    let entry: { date: string; pfcf: number; pct: number; score: number; mcapM: number | null } | null = null;
    for (const d of detectDates) {
      const r = await scoreAsOfDb(data, d, { seriesMap });
      if (r.opportunity && r.pfcfCurrent != null && r.pfcfPercentile != null) { entry = { date: d, pfcf: r.pfcfCurrent, pct: r.pfcfPercentile, score: r.score10, mcapM: r.metrics.marketCap ?? null }; break; }
    }
    if (!entry) continue;
    const entryPrice = adjAt(data.yahoo.prices, entry.date); if (entryPrice == null || entryPrice <= 0) continue;
    // Série P/FCF complète jusqu'à aujourd'hui (= graphe app).
    const full = await scoreAsOfDb(data, TODAY, { seriesMap, debugSeries: true });
    const series = full.pfcfSeries ?? [];
    const histAtEntry = series.filter((p) => p.date <= entry!.date).map((p) => p.pfcf);
    pepites.push({ ticker: tickers[i]!, entryDate: entry.date, entryPrice, entryPfcf: entry.pfcf, entryPct: entry.pct, entryScore: entry.score, entryMcapM: entry.mcapM, prices: data.yahoo.prices, pfcfSeries: series, histMedianPfcf: median(histAtEntry) });
  }
  process.stderr.write('\r');
  console.log(`\n${pepites.length} pépites détectées.\n`);

  // ── CSV 1 : résumé ──
  const outDir = path.join(process.cwd(), 'exports'); fs.mkdirSync(outDir, { recursive: true });
  const resumeRows = pepites.map((p) => {
    const pNow = adjAt(p.prices, TODAY)!, bE = adjAt(bench, p.entryDate)!, bN = adjAt(bench, TODAY)!;
    const ret = pNow / p.entryPrice - 1, sp = bN / bE - 1;
    return { ...p, ret, sp, excess: ret - sp, years: yrs(p.entryDate, TODAY), pfcfNow: pfcfAt(p.pfcfSeries, TODAY) };
  }).sort((a, b) => b.excess - a.excess);
  const csv1 = ['ticker,date_entree,mcap_M_entree,bucket,prix_entree,pfcf_entree,percentile_entree,note_entree,pfcf_median_hist,pfcf_aujourdhui,annees,rendt_total,sp500_total,excess'];
  for (const r of resumeRows) csv1.push(`${r.ticker},${r.entryDate},${r.entryMcapM != null ? r.entryMcapM.toFixed(0) : ''},${bucketOf(r.entryMcapM).trim()},${r.entryPrice.toFixed(2)},${r.entryPfcf.toFixed(1)},${r.entryPct.toFixed(0)},${r.entryScore},${r.histMedianPfcf.toFixed(1)},${(r.pfcfNow ?? 0).toFixed(1)},${r.years.toFixed(1)},${(r.ret * 100).toFixed(1)},${(r.sp * 100).toFixed(1)},${(r.excess * 100).toFixed(1)}`);
  fs.writeFileSync(path.join(outDir, 'pepites_resume.csv'), csv1.join('\n'));

  // ── CSV 2 : année par année ──
  const csv2 = ['ticker,annee,cours_fin_annee,rendt_annee,sp500_annee,pfcf_fin_annee,cumul_depuis_entree'];
  const yEnd = (y: number) => { const e = `${y}-12-31`; return e < TODAY ? e : TODAY; };
  for (const p of pepites) {
    const y0 = Number(p.entryDate.slice(0, 4)), yN = Number(TODAY.slice(0, 4));
    let prevDate = p.entryDate, prevPrice = p.entryPrice;
    for (let y = y0; y <= yN; y++) {
      const end = yEnd(y); if (end <= prevDate && y !== y0) continue;
      const px = adjAt(p.prices, end); if (px == null) continue;
      const bPrev = adjAt(bench, prevDate)!, bEnd = adjAt(bench, end)!;
      const yr = px / prevPrice - 1, spYr = bEnd / bPrev - 1, cum = px / p.entryPrice - 1;
      const pf = pfcfAt(p.pfcfSeries, end);
      csv2.push(`${p.ticker},${y},${px.toFixed(2)},${(yr * 100).toFixed(1)},${(spYr * 100).toFixed(1)},${pf != null ? pf.toFixed(1) : ''},${(cum * 100).toFixed(1)}`);
      prevDate = end; prevPrice = px;
    }
  }
  fs.writeFileSync(path.join(outDir, 'pepites_annuel.csv'), csv2.join('\n'));

  // ── Test de règles de SORTIE sur P/FCF (vs hold) ──
  type Rule = { label: string; exitDate: (p: Pepite) => string };
  const fixed = (X: number): Rule['exitDate'] => (p) => { const hit = p.pfcfSeries.find((q) => q.date > p.entryDate && q.pfcf >= X); return hit ? hit.date : TODAY; };
  const mult = (k: number): Rule['exitDate'] => (p) => { const hit = p.pfcfSeries.find((q) => q.date > p.entryDate && q.pfcf >= p.entryPfcf * k); return hit ? hit.date : TODAY; };
  const toMedian: Rule['exitDate'] = (p) => { const hit = p.pfcfSeries.find((q) => q.date > p.entryDate && q.pfcf >= p.histMedianPfcf); return hit ? hit.date : TODAY; };
  const rules: Rule[] = [
    { label: 'hold (référence)', exitDate: () => TODAY },
    { label: 'P/FCF ≥ 20', exitDate: fixed(20) },
    { label: 'P/FCF ≥ 25', exitDate: fixed(25) },
    { label: 'P/FCF ≥ 30', exitDate: fixed(30) },
    { label: 'P/FCF ≥ 40', exitDate: fixed(40) },
    { label: 'P/FCF ≥ entrée×1.5', exitDate: mult(1.5) },
    { label: 'P/FCF ≥ entrée×2', exitDate: mult(2) },
    { label: 'P/FCF ≥ médiane hist.', exitDate: toMedian },
  ];
  // Helper : métriques agrégées d'une règle sur un sous-ensemble de pépites.
  function evalRule(subset: Pepite[], exitDate: Rule['exitDate']): { n: number; hit: number; excessMed: number; retMed: number; yrsMean: number } {
    if (!subset.length) return { n: 0, hit: 0, excessMed: 0, retMed: 0, yrsMean: 0 };
    const recs = subset.map((p) => {
      const ex = exitDate(p);
      const xP = adjAt(p.prices, ex)!, bE = adjAt(bench, p.entryDate)!, bX = adjAt(bench, ex)!;
      return { ret: xP / p.entryPrice - 1, bench: bX / bE - 1, yrs: yrs(p.entryDate, ex) };
    });
    return {
      n: recs.length,
      hit: recs.filter((r) => r.ret > r.bench).length / recs.length,
      excessMed: median(recs.map((r) => r.ret - r.bench)),
      retMed: median(recs.map((r) => r.ret)),
      yrsMean: recs.reduce((s, r) => s + r.yrs, 0) / recs.length,
    };
  }

  console.log('règle de sortie          nPos  bat-marché  excès-tot-méd  rendt-tot-méd  détention-moy');
  for (const rule of rules) {
    const m = evalRule(pepites, rule.exitDate);
    console.log(`${rule.label.padEnd(24)} ${String(m.n).padStart(4)}    ${(m.hit * 100).toFixed(0).padStart(3)}%      ${pctS(m.excessMed).padStart(8)}     ${pctS(m.retMed).padStart(8)}     ${m.yrsMean.toFixed(1)}a`);
  }

  // ── Segmentation par TAILLE (market cap à l'entrée) × 2 règles clés (hold vs P/FCF≥médiane) ──
  const medianRule = rules.find((r) => r.label.includes('médiane'))!.exitDate;
  const holdRule = rules[0]!.exitDate;
  console.log('\nPar taille (cap à l\'entrée) :');
  console.log('bucket             nPos   ─── HOLD ───        ─── sortie P/FCF≥médiane ───');
  console.log('                          bat%  excès-méd  rendt-méd    bat%  excès-méd  rendt-méd');
  for (const b of BUCKET_ORDER) {
    const sub = pepites.filter((p) => bucketOf(p.entryMcapM) === b);
    if (!sub.length) continue;
    const h = evalRule(sub, holdRule), mdn = evalRule(sub, medianRule);
    console.log(`${b.padEnd(18)} ${String(sub.length).padStart(4)}    ${(h.hit * 100).toFixed(0).padStart(3)}%  ${pctS(h.excessMed).padStart(8)}  ${pctS(h.retMed).padStart(8)}    ${(mdn.hit * 100).toFixed(0).padStart(3)}%  ${pctS(mdn.excessMed).padStart(8)}  ${pctS(mdn.retMed).padStart(8)}`);
  }

  console.log(`\nCSV écrits dans ${outDir}/ : pepites_resume.csv · pepites_annuel.csv`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
