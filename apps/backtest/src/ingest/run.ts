/**
 * Orchestrateur d'ingestion — crawl reprenable, rate-limité.
 *
 * Usage :
 *   tsx src/ingest/run.ts                 # liste PoC par défaut + benchmark SPY
 *   tsx src/ingest/run.ts AAPL MSFT GOOGL # tickers explicites
 *   tsx src/ingest/run.ts --force AAPL    # re-fetch même si déjà en store
 *   tsx src/ingest/run.ts --no-bench ...  # sans (re)fetch du benchmark
 *
 * Idempotent : un ticker déjà présent est sauté (sauf --force). Sûr à relancer après crash.
 */
import { fetchFinancialsReported } from './finnhub.js';
import { fetchMonthlyPricesAndSplits } from './yahoo.js';
import { hasTicker, writeTicker, writeBenchmark, readBenchmark, type TickerData } from '../store.js';

/** Liste PoC : méga-caps + cas testés dans l'app (MEDP, BKNG) + cas splits (NVDA, AMZN). */
const POC_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA', 'AMZN', 'V', 'ADBE', 'BKNG', 'MEDP'];
const BENCHMARK = 'SPY';

async function ingestTicker(ticker: string, force: boolean): Promise<'skip' | 'ok' | 'fail'> {
  const T = ticker.toUpperCase();
  if (!force && hasTicker(T)) return 'skip';
  try {
    // Finnhub (2 appels) + Yahoo (1 appel). Séquentiel : les throttles par hôte gèrent l'espacement.
    const [quarterly, annual] = [
      await fetchFinancialsReported(T, 'quarterly'),
      await fetchFinancialsReported(T, 'annual'),
    ];
    const yahoo = await fetchMonthlyPricesAndSplits(T);
    const data: TickerData = {
      ticker: T,
      fetchedAt: new Date().toISOString(),
      finnhub: { quarterly, annual },
      yahoo: { symbol: T, prices: yahoo.prices, splits: yahoo.splits },
    };
    writeTicker(data);
    const q0 = quarterly[0]?.endDate ?? '—';
    const p0 = yahoo.prices[0]?.date ?? '—';
    console.log(`  ✓ ${T}: ${quarterly.length} Q (depuis ${q0}), ${annual.length} A, ${yahoo.prices.length} prix mensuels (depuis ${p0}), ${yahoo.splits.length} split(s)`);
    return 'ok';
  } catch (e) {
    console.warn(`  ✗ ${T}: ${(e as Error).message}`);
    return 'fail';
  }
}

async function ingestBenchmark(force: boolean): Promise<void> {
  if (!force && readBenchmark(BENCHMARK)) { console.log(`Benchmark ${BENCHMARK} déjà en store.`); return; }
  try {
    const { prices } = await fetchMonthlyPricesAndSplits(BENCHMARK);
    writeBenchmark(BENCHMARK, prices);
    console.log(`Benchmark ${BENCHMARK}: ${prices.length} prix mensuels (depuis ${prices[0]?.date ?? '—'}).`);
  } catch (e) {
    console.warn(`Benchmark ${BENCHMARK} échec: ${(e as Error).message}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const noBench = args.includes('--no-bench');
  const tickers = args.filter(a => !a.startsWith('--'));
  const list = tickers.length ? tickers.map(t => t.toUpperCase()) : POC_TICKERS;

  console.log(`Ingestion de ${list.length} ticker(s)${force ? ' (--force)' : ''} :`);
  if (!noBench) await ingestBenchmark(force);

  let ok = 0, skip = 0, fail = 0;
  for (let i = 0; i < list.length; i++) {
    process.stdout.write(`[${i + 1}/${list.length}] `);
    const r = await ingestTicker(list[i]!, force);
    if (r === 'ok') ok++; else if (r === 'skip') { skip++; console.log(`  ↷ ${list[i]} déjà en store (skip)`); } else fail++;
  }
  console.log(`\nTerminé : ${ok} ok, ${skip} sautés, ${fail} échecs.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
