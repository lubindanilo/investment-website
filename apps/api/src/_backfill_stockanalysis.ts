/**
 * Backfill stockanalysis.com pour TOUS les tickers non-US (EU / INTL) en DB.
 *
 * Stratégie :
 *   - On itère sur ScreenerTicker (status = scored | pending) où ticker contient un point
 *     (= non-US par convention) OU region != 'US'.
 *   - Pour chaque ticker, on appelle accumulateStockanalysisQuarterly (3 fetches au throttle
 *     1 req/s = ~3s/ticker).
 *   - Append-only : si une période existe déjà dans le store (ex via Yahoo accumulé), on n'écrase
 *     pas — on AJOUTE les périodes manquantes.
 *   - Reprenable : si le job meurt et qu'on relance, la sélection refait le tour ; les tickers
 *     dont le store est FRAIS pour `revenue` (TTL store, ~120j) sont skippés.
 *   - Retry sur erreurs Neon transitoires (3000ms exponentiel).
 *
 * Vitesse attendue : ~1.2-3s par ticker × 1500 tickers = ~30-75 min.
 */
import { prisma } from './db/client.js';
import { accumulateStockanalysisQuarterly } from './services/yahooAnnualStore.js';
import { readSeries, isFresh } from './services/fundamentalsStore.js';

async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const msg = (e as Error).message ?? '';
      if (/Closed|timeout|ECONN|fetch failed|EAI_AGAIN|reach/i.test(msg) && i < attempts - 1) {
        await new Promise(r => setTimeout(r, 3000 * (i + 1)));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

const ONLY_PFCF_OPP_CANDIDATES = process.argv.includes('--opp-only');

const where = ONLY_PFCF_OPP_CANDIDATES
  ? { OR: [{ region: { not: 'US' } }, { ticker: { contains: '.' } }], scoreRatio: { gte: 0.75 } }
  : { OR: [{ region: { not: 'US' } }, { ticker: { contains: '.' } }] };

const candidates = await withRetry(() => prisma.screenerTicker.findMany({
  where,
  select: { ticker: true },
  orderBy: [{ priority: 'asc' }, { scoreRatio: 'desc' }],
}));
console.log(`${candidates.length} tickers non-US à backfiller${ONLY_PFCF_OPP_CANDIDATES ? ' (filtre: opp candidates note ≥ 8)' : ''}`);

const now = Date.now();
let ok = 0, skip = 0, noData = 0, err = 0;
const t0 = Date.now();

for (const c of candidates) {
  try {
    // Skip si le revenu trimestriel/semestriel est déjà frais pour ce ticker
    // (= store FundamentalsSeries.expiresAt > now). Repère honnête de progression.
    const stored = await withRetry(() => readSeries(c.ticker, 'revenue'));
    if (stored && isFresh(stored, now) && (stored.source === 'stockanalysis' || stored.source === 'finnhub+edgar')) {
      skip++;
      continue;
    }
    const n = await accumulateStockanalysisQuarterly(c.ticker, now);
    if (n === 0) noData++;
    else ok++;
  } catch (e) {
    err++;
    console.log(`  ✗ ${c.ticker}: ${(e as Error).message}`);
  }
  if ((ok + skip + noData + err) % 25 === 0) {
    const elapsed = (Date.now() - t0) / 1000;
    const rate = (ok + skip + noData + err) / Math.max(elapsed, 1);
    const remaining = (candidates.length - (ok + skip + noData + err)) / Math.max(rate, 0.1);
    console.log(`  progression ${ok + skip + noData + err}/${candidates.length} (ok=${ok} skip=${skip} noData=${noData} err=${err}) — ETA ${(remaining / 60).toFixed(1)} min`);
  }
}

const total = ((Date.now() - t0) / 1000 / 60).toFixed(1);
console.log(`\nTerminé en ${total} min : ${ok} accumulés, ${skip} déjà frais, ${noData} sans données, ${err} erreurs.`);
process.exit(0);
