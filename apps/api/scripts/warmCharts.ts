/**
 * Préremplissage du cache graphiques (ChartCache) pour le « premier batch » : les tickers
 * les mieux notés (les plus susceptibles d'être consultés). Warme, à la période par défaut
 * (5 ans) : P/FCF + Cash ROCE (tous tickers) et les histogrammes (US uniquement — l'EU/Asie
 * passe par Yahoo dans la route, lazy-fill). Idempotent (réécrit le cache), best-effort.
 *
 * Usage : npx tsx scripts/warmCharts.ts [N]   (N = nb de tickers, défaut 80)
 *
 * Ce n'est qu'un AMORÇAGE one-shot. Ensuite : le TTL earnings invalide à chaque résultat,
 * et la prochaine ouverture (ou un nouveau run) recompose — pas besoin de cron permanent.
 */
import '../src/env.js';
import { prisma } from '../src/db/client.js';
import * as cache from '../src/lib/timeseriesCache.js';
import { getPfcfHistory } from '../src/services/pfcfHistory.js';
import { getCashRoceHistory } from '../src/services/cashRoceHistory.js';
import { getReportedTimeseries, type MetricKey } from '../src/services/finnhubFundamentals.js';
import { getNextEarningsDate, ttlUntilNextEarnings } from '../src/services/earnings.js';

const YEARS = 5;
const HISTO_METRICS: MetricKey[] = ['netIncome', 'revenue', 'fcf', 'shares', 'operatingIncome', 'totalDebt'];
const N = Math.max(1, Math.min(Number(process.argv[2]) || 80, 1000));

const top = await prisma.screenerTicker.findMany({
  where: { status: 'scored', scoreChiffresMax: { gte: 8 } },
  orderBy: [{ scoreRatio: 'desc' }, { scoreChiffresMax: 'desc' }],
  take: N,
  select: { ticker: true },
});
console.log(`warmCharts : ${top.length} tickers (période ${YEARS} ans)`);

let ok = 0, fail = 0;
for (const { ticker } of top) {
  try {
    const ttl = ttlUntilNextEarnings(await getNextEarningsDate(ticker).catch(() => null));
    // P/FCF + Cash ROCE (services gèrent US + EU en interne)
    const [pfcf, croce] = await Promise.all([
      getPfcfHistory(ticker, YEARS).catch(() => []),
      getCashRoceHistory(ticker, YEARS).catch(() => []),
    ]);
    if (pfcf.length) await cache.set(cache.cacheKey(ticker, 'pfcf-history', 'computed', YEARS), pfcf.map(p => ({ date: p.date, value: p.pfcf })), 'finnhub', ttl);
    if (croce.length) await cache.set(cache.cacheKey(ticker, 'cash-roce-history', 'computed', YEARS), croce.map(p => ({ date: p.date, value: p.cashRoce })), 'finnhub', ttl);
    // Histogrammes : US uniquement (tickers sans suffixe), via Finnhub /financials-reported.
    if (!ticker.includes('.')) {
      for (const metric of HISTO_METRICS) {
        const pts = await getReportedTimeseries(ticker, metric, 'quarterly', YEARS).catch(() => []);
        if (pts.length) await cache.set(cache.cacheKey(ticker, metric, 'quarterly', YEARS), pts, 'finnhub', ttl);
      }
    }
    ok++;
    if (ok % 10 === 0) console.log(`  … ${ok}/${top.length}`);
  } catch (e) {
    fail++;
    console.warn(`  ✗ ${ticker}: ${(e as Error).message.slice(0, 60)}`);
  }
}
console.log(`warmCharts terminé : ${ok} OK, ${fail} échecs`);
await prisma.$disconnect();
