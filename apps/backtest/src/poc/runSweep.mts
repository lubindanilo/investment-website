import { prisma } from '../../../api/src/db/client.js';
import { runSweep, type SweepConfig, type BaseCfg } from '../engine/sweep.js';
import { listTickers } from '../store.js';

const _log = console.log.bind(console);
console.log = (...a: unknown[]) => { if (String(a[0] ?? '').startsWith('[')) return; _log(...a); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function wake(): Promise<void> {
  for (let i = 0; i < 15; i++) { try { await prisma.$queryRawUnsafe('SELECT 1'); return; } catch { process.stderr.write('.'); await sleep(5000); } }
  throw new Error('Neon injoignable');
}
const pct = (x: number) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%';

async function main(): Promise<void> {
  await wake();
  const base: BaseCfg = { detectStart: '2014-01-01', detectEnd: '2022-12-31', today: process.env.TODAY ?? '2026-06-05', stepMonths: 3 };
  const exits: { label: string; below: number | null }[] = [{ label: 'hold', below: null }, { label: 's<8', below: 8 }, { label: 's<6', below: 6 }];
  const pctMaxes = [25, 15, 10, 5, 3];
  const entries = [7, 8, 9, 10];
  const configs: SweepConfig[] = entries.flatMap((e) => pctMaxes.flatMap((p) => exits.map((x) => ({ label: `≥${e}/p≤${p}/${x.label}`, entryMin: e, pctMax: p, exitBelow: x.below }))));

  const tickers = listTickers();
  console.log(`Sweep ${configs.length} hypothèses × ${tickers.length} titres (détection ≤${base.detectEnd}, pas trimestriel)\n`);
  const rows = await runSweep(tickers, configs, base, (i, n) => process.stderr.write(`\r[${i}/${n}]      `));
  process.stderr.write('\r');

  // Tri : bat-marché desc, puis excès total médian desc.
  rows.sort((a, b) => b.hitRate - a.hitRate || b.excessTotMedian - a.excessTotMedian);
  console.log('config           nPos  bat-marché  excès-tot-méd  rendt-tot-méd  SPY-tot-méd  alpha-ann-moy');
  for (const r of rows) {
    console.log(
      `${r.label.padEnd(15)} ${String(r.nPositions).padStart(4)}    ${(r.hitRate * 100).toFixed(0).padStart(3)}%      ${pct(r.excessTotMedian).padStart(8)}     ${pct(r.retTotMedian).padStart(8)}    ${pct(r.benchTotMedian).padStart(8)}   ${pct(r.alphaAnnMean).padStart(7)}`,
    );
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
