/**
 * Audit « erreurs de note » sur tous les titres ingérés : score backtest (/financials-reported)
 * vs score app (prod ScreenerTicker), et liste des critères tombés en « Non calculable » /
 * « N/A » (signature des trous de données Finnhub → sous-notation). Sert à quantifier l'ampleur
 * du biais avant de décider du fallback annuel.
 *
 *   DATABASE_URL=… tsx apps/backtest/src/poc/diag-sweep.ts [asOf]
 */
import { prisma } from '../../../api/src/db/client.js';
import { listTickers, readTicker } from '../store.js';
import { scoreAsOf } from '../engine/scoreAsOf.js';

const ASOF = process.argv[2] ?? '2026-06-03';
const NOT = new Set(['Non calculable', 'N/A']);

async function main(): Promise<void> {
  const tickers = listTickers().sort();
  const rows = await prisma.screenerTicker.findMany({
    where: { ticker: { in: tickers } },
    select: { ticker: true, scoreChiffres: true, scoreChiffresMax: true },
  });
  const prod = new Map(rows.map((r) => [r.ticker, r]));

  console.log(`\nAudit notes @ ${ASOF}  (bt = backtest /financials-reported · app = prod /stock/metric)\n`);
  console.log('ticker  bt    app   Δ    calc  critères non calculables');
  let totalGaps = 0;
  for (const t of tickers) {
    const data = readTicker(t);
    if (!data) continue;
    const r = await scoreAsOf(data, ASOF);
    const pr = prod.get(t);
    const app = pr?.scoreChiffresMax ? Math.round((pr.scoreChiffres! / pr.scoreChiffresMax) * 10) : null;
    const nc = r.chiffres.filter((c) => NOT.has(c.valeur)).map((c) => c.key);
    if (nc.length) totalGaps++;
    const delta = app != null ? r.score10 - app : null;
    const deltaStr = delta == null ? '  ' : (delta > 0 ? '+' : '') + delta;
    console.log(
      `${t.padEnd(6)} ${String(r.score10).padStart(2)}/10 ${app != null ? (String(app).padStart(2) + '/10') : '  —  '}  ${deltaStr.padStart(3)}  ${String(10 - nc.length).padStart(2)}/10  ${nc.length ? nc.join(', ') : '—'}`,
    );
  }
  console.log(`\n${totalGaps}/${tickers.length} titres avec ≥1 critère non calculable (trous de données Finnhub).`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
