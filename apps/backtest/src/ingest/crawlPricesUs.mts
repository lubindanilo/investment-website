/**
 * Crawl des PRIX (Yahoo) pour l'univers US — le seul élément hors DB pour le backtest.
 * Univers = tickers ayant une série `quarterly` dans FundamentalsSeries (chemin US). Stocke
 * prix mensuels (close + adjClose) + splits par ticker (finnhub vide : les fondamentaux
 * viennent de la DB). Reprenable (skip si déjà en cache), rate-limité Yahoo.
 *   DATABASE_URL=… tsx src/ingest/crawlPricesUs.mts [--force]
 */
import { prisma } from '../../../api/src/db/client.js';
import { fetchMonthlyPricesAndSplits } from './yahoo.js';
import { hasTicker, writeTicker, writeBenchmark, readBenchmark, type TickerData } from '../store.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function wake(): Promise<void> {
  for (let i = 0; i < 15; i++) { try { await prisma.$queryRawUnsafe('SELECT 1'); return; } catch { process.stderr.write('.'); await sleep(5000); } }
  throw new Error('Neon injoignable');
}

async function main(): Promise<void> {
  await wake();
  const force = process.argv.includes('--force');
  const rows = await prisma.fundamentalsSeries.findMany({ where: { freq: 'quarterly' }, distinct: ['ticker'], select: { ticker: true } });
  const tickers = rows.map((r) => r.ticker).sort();
  console.error(`Univers US (FundamentalsSeries quarterly) : ${tickers.length} titres`);
  await prisma.$disconnect(); // plus besoin de la DB pendant le crawl Yahoo

  if (force || !readBenchmark('SPY')) {
    try { const { prices } = await fetchMonthlyPricesAndSplits('SPY'); writeBenchmark('SPY', prices); console.error(`SPY: ${prices.length} prix`); } catch { console.error('SPY: échec'); }
  }

  let ok = 0, skip = 0, fail = 0;
  for (let i = 0; i < tickers.length; i++) {
    const t = tickers[i]!;
    if (!force && hasTicker(t)) { skip++; }
    else {
      try {
        const y = await fetchMonthlyPricesAndSplits(t);
        const data: TickerData = { ticker: t, fetchedAt: new Date().toISOString(), finnhub: { quarterly: [], annual: [] }, yahoo: { symbol: t, prices: y.prices, splits: y.splits } };
        writeTicker(data);
        ok++;
      } catch { fail++; }
    }
    if (i % 25 === 0 || i === tickers.length - 1) process.stderr.write(`\r[${i + 1}/${tickers.length}] ok=${ok} skip=${skip} fail=${fail}      `);
  }
  console.error(`\nTerminé : ${ok} crawlés, ${skip} déjà en cache, ${fail} échecs (relançable).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
