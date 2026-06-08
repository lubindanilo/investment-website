/**
 * CLI runner backtest (démo). Détection ≤ 2022-12-31, sortie note<8, détention → aujourd'hui,
 * alpha vs SPY. Fondamentaux = DB (FundamentalsSeries), prix = cache Yahoo local.
 *   DATABASE_URL=… tsx src/poc/runBacktest.mts [tickers...]
 */
import { prisma } from '../../../api/src/db/client.js';
import { runBacktest, type BacktestConfig } from '../engine/runner.js';
import { listTickers } from '../store.js';

// Silence les logs internes de l'app (régressions, etc.) qui spamment à grande échelle —
// on garde uniquement nos lignes de résultat (qui ne commencent pas par '[').
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
  const cfg: BacktestConfig = { detectStart: '2014-01-01', detectEnd: '2022-12-31', today: process.env.TODAY ?? '2026-06-05', exitBelow: 8, stepMonths: 3 };
  const tickers = process.argv.slice(2).length ? process.argv.slice(2).map((t) => t.toUpperCase()) : listTickers();
  console.log(`Backtest ${tickers.length} titres — détection ${cfg.detectStart}→${cfg.detectEnd}, sortie note<${cfg.exitBelow}, détention→${cfg.today}\n`);

  const { positions, summary } = await runBacktest(tickers, cfg, (i, n, t) => process.stderr.write(`\r[${i}/${n}] ${t}            `));
  process.stderr.write('\r');

  console.log('=== POSITIONS (triées par alpha) ===');
  console.log('ticker  entrée→sortie            motif     durée  rendt     CAGR    SPY     alpha   note@entrée');
  for (const p of [...positions].sort((a, b) => b.alpha - a.alpha)) {
    console.log(`${p.ticker.padEnd(6)} ${p.entryDate}→${p.exitDate} ${p.exitReason.padEnd(8)} ${p.years.toFixed(1)}a ${pct(p.ret).padStart(9)} ${pct(p.cagr).padStart(7)} ${pct(p.benchCagr).padStart(7)} ${pct(p.alpha).padStart(7)}  ${p.entryScore}/10 pct${p.entryPct?.toFixed(0) ?? '?'}`);
  }
  console.log('\n=== SYNTHÈSE ===');
  console.log(`Scannés ${summary.scanned} · Opportunités détectées ${summary.nPositions}`);
  if (summary.nPositions > 0) {
    console.log(`CAGR moyen ${pct(summary.cagrMean)} (médian ${pct(summary.cagrMedian)}) vs SPY ${pct(summary.benchCagrMean)}`);
    console.log(`ALPHA moyen ${pct(summary.alphaMean)} (médian ${pct(summary.alphaMedian)}) · bat le marché ${(summary.hitRate * 100).toFixed(0)}% · détention moy ${summary.yearsMean.toFixed(1)}a`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
