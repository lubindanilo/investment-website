/**
 * Validation « P/FCF comme dans l'app » : compare le dernier point du graphique P/FCF de l'app
 * (getPfcfHistory) au pfcfCurrent du backtest (scoreAsOfDb). Doivent coïncider (même dénominateur
 * FCF ajusté + mêmes actions ; seule la fraîcheur du prix diffère de quelques jours).
 */
import { prisma } from '../../../api/src/db/client.js';
import { getPfcfHistory } from '../../../api/src/services/pfcfHistory.js';
import { readTicker } from '../store.js';
import { scoreAsOfDb } from '../engine/scoreAsOf.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function wake(): Promise<void> {
  for (let i = 0; i < 15; i++) { try { await prisma.$queryRawUnsafe('SELECT 1'); return; } catch { process.stdout.write('.'); await sleep(5000); } }
  throw new Error('Neon injoignable');
}

const TODAY = process.env.ASOF ?? '2026-06-05';
const TICKERS = process.argv.slice(2).length ? process.argv.slice(2) : ['AAPL', 'NVDA', 'MSFT', 'BKNG', 'MEDP'];

async function main(): Promise<void> {
  process.stdout.write('Réveil Neon'); await wake(); console.log(' OK\n');
  console.log('ticker  APP P/FCF (graphe, dernier pt)   BACKTEST pfcfCurrent   pct   nPts(app/bt)');
  for (const t of TICKERS) {
    const data = readTicker(t);
    if (!data) { console.log(`${t}: skip (pas de prix local)`); continue; }
    // App d'abord (REPLAY null → chemin live), puis backtest (pose/retire REPLAY).
    const appHist = await getPfcfHistory(t, 50).catch(() => [] as { date: string; pfcf: number }[]);
    const appLast = appHist.length ? appHist[appHist.length - 1]!.pfcf : null;
    const bt = await scoreAsOfDb(data, TODAY, { lagDays: 0 });
    const diff = appLast != null && bt.pfcfCurrent != null ? `${(((bt.pfcfCurrent - appLast) / appLast) * 100).toFixed(1)}%` : '—';
    console.log(`${t.padEnd(6)} ${String(appLast?.toFixed(1) ?? '∅').padStart(10)}                ${String(bt.pfcfCurrent?.toFixed(1) ?? '∅').padStart(8)}  (Δ ${diff})  ${String(bt.pfcfPercentile?.toFixed(0) ?? '∅').padStart(3)}   ${appHist.length}/${bt.nPfcfPoints}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
