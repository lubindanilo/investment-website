/**
 * Validation du branchement DB : scoreAsOfDb (fondamentaux = FundamentalsSeries du site) vs app.
 * lagDays=0 → même fenêtre que le site. Vérifie aussi que la série P/FCF (opportunité) se peuple.
 */
import { prisma } from '../../../api/src/db/client.js';
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
  const rows = await prisma.screenerTicker.findMany({ where: { ticker: { in: TICKERS } }, select: { ticker: true, scoreChiffres: true, scoreChiffresMax: true, opportunity: true, pfcfPercentile: true } });
  const app = new Map(rows.map((r) => [r.ticker, r]));
  console.log('ticker  APP-note APP-opp  |  BT-DB note  pfcf   pct  opp  nPts');
  for (const t of TICKERS) {
    const data = readTicker(t);
    if (!data) { console.log(`${t}: skip (pas de prix local)`); continue; }
    const a = app.get(t);
    const appScore = a?.scoreChiffresMax ? Math.round((a.scoreChiffres! / a.scoreChiffresMax) * 10) : null;
    const db = await scoreAsOfDb(data, TODAY, { lagDays: 0 });
    console.log(`${t.padEnd(6)} ${String(appScore ?? '—').padStart(4)}/10  ${String(a?.opportunity ?? '—').padStart(5)}  |  ${String(db.score10).padStart(2)}/10     ${(db.pfcfTTM?.toFixed(1) ?? '∅').padStart(6)} ${String(db.pfcfPercentile?.toFixed(0) ?? '∅').padStart(4)} ${String(db.opportunity).padStart(5)} ${String(db.nPfcfPoints).padStart(4)}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
