/**
 * Risque ajusté : courbe d'équité calendaire de quelques configs vs S&P (CAGR, vol, Sharpe, max DD).
 * Parqué en S&P quand pas de pépite → on isole la valeur de la SÉLECTION.
 */
import { prisma } from '../../../api/src/db/client.js';
import { runPortfolios } from '../engine/portfolio.js';
import type { SweepConfig, BaseCfg } from '../engine/sweep.js';
import { listTickers } from '../store.js';

const _log = console.log.bind(console);
console.log = (...a: unknown[]) => { if (String(a[0] ?? '').startsWith('[')) return; _log(...a); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function wake(): Promise<void> { for (let i = 0; i < 15; i++) { try { await prisma.$queryRawUnsafe('SELECT 1'); return; } catch { process.stderr.write('.'); await sleep(5000); } } throw new Error('Neon injoignable'); }
const pct = (x: number) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%';

async function main(): Promise<void> {
  await wake();
  const base: BaseCfg = { detectStart: '2014-01-01', detectEnd: '2022-12-31', today: process.env.TODAY ?? '2026-06-05', stepMonths: 3 };
  const configs: SweepConfig[] = [
    { label: '≥7/p≤10/s<8', entryMin: 7, pctMax: 10, exitBelow: 8 },   // meilleure du sweep
    { label: '≥8/p≤25/s<8', entryMin: 8, pctMax: 25, exitBelow: 8 },   // proche définition app
    { label: '≥8/p≤10/s<8', entryMin: 8, pctMax: 10, exitBelow: 8 },
    { label: '≥7/p≤10/hold', entryMin: 7, pctMax: 10, exitBelow: null }, // sans sortie (drawdown brut)
    { label: '≥10/p≤10/s<8', entryMin: 10, pctMax: 10, exitBelow: 8 },  // strict
  ];
  const tickers = listTickers();
  console.log(`Portefeuille calendaire — ${configs.length} configs × ${tickers.length} titres (parqué S&P si pas de pépite)\n`);
  const { rows, spy } = await runPortfolios(tickers, configs, base, (i, n) => process.stderr.write(`\r[${i}/${n}]      `));
  process.stderr.write('\r');

  console.log('config           nPos  %investi   CAGR     vol     Sharpe   maxDD');
  for (const r of rows) {
    console.log(`${r.label.padEnd(15)} ${String(r.nPositions).padStart(4)}  ${(r.pctInvested * 100).toFixed(0).padStart(4)}%    ${pct(r.cagr).padStart(7)} ${(r.vol * 100).toFixed(1).padStart(5)}%   ${r.sharpe.toFixed(2).padStart(5)}   ${pct(r.maxDD).padStart(7)}`);
  }
  console.log(`${'S&P 500 (100%)'.padEnd(15)}    —     —     ${pct(spy.cagr).padStart(7)} ${(spy.vol * 100).toFixed(1).padStart(5)}%   ${spy.sharpe.toFixed(2).padStart(5)}   ${pct(spy.maxDD).padStart(7)}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
