import { prisma } from '../../../api/src/db/client.js';
import { runAblation, type BaseCfg } from '../engine/ablation.js';
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
  const cfg: BaseCfg = { detectStart: '2014-01-01', detectEnd: '2022-12-31', today: process.env.TODAY ?? '2026-06-05', stepMonths: 3, entryMin: 8, exitBelow: 8 };
  const tickers = listTickers();
  console.log(`Ablation des 10 critères chiffrés × ${tickers.length} titres (entrée≥${cfg.entryMin}, sortie<${cfg.exitBelow})\n`);
  const rows = await runAblation(tickers, cfg, (i, n) => process.stderr.write(`\r[${i}/${n}]      `));
  process.stderr.write('\r');

  const base = rows.find((r) => r.ablated.startsWith('(baseline'))!;
  console.log(`BASELINE (10 critères) : ${base.nPositions} positions · alpha-méd ${pct(base.alphaMedian)} · bat-marché ${(base.hitRate * 100).toFixed(0)}%\n`);
  console.log('critère retiré      nPos  alpha-méd  bat%   Δalpha   Δbat    → verdict');
  const ablated = rows.filter((r) => !r.ablated.startsWith('(baseline'));
  // tri par Δalpha croissant : le plus négatif = critère dont le retrait fait le plus mal = le plus utile
  ablated.sort((a, b) => (a.alphaMedian - base.alphaMedian) - (b.alphaMedian - base.alphaMedian));
  for (const r of ablated) {
    const dA = r.alphaMedian - base.alphaMedian;
    const dH = r.hitRate - base.hitRate;
    const verdict = dA < -0.005 ? 'AJOUTE (retrait nuit)' : dA > 0.005 ? 'nuit/neutre (retrait aide)' : '≈ neutre';
    console.log(`${r.ablated.padEnd(18)} ${String(r.nPositions).padStart(4)}  ${pct(r.alphaMedian).padStart(8)}  ${(r.hitRate * 100).toFixed(0).padStart(3)}%  ${pct(dA).padStart(7)}  ${(dH * 100 >= 0 ? '+' : '') + (dH * 100).toFixed(0).padStart(2)}%   ${verdict}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
