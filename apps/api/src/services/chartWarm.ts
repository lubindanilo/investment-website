/**
 * Préremplissage du cache des graphiques détaillés (ChartCache) pour UN ticker.
 *
 * Utilisé par la veille (à chaque score : le memo /financials-reported est encore chaud →
 * quasi gratuit) ET par le script de backfill. Best-effort : n'émet jamais d'erreur, ne doit
 * jamais bloquer le scoring. Warme la période par défaut (5 ans), celle qu'ouvre le front.
 */
import * as cache from '../lib/timeseriesCache.js';
import { getPfcfHistory } from './pfcfHistory.js';
import { getCashRoceHistory } from './cashRoceHistory.js';
import { getReportedTimeseries, type MetricKey } from './finnhubFundamentals.js';
import { ttlUntilNextEarnings } from './earnings.js';

const YEARS = 5;
/** Métriques d'histogramme exposées dans l'UI (cf. CRITERION_HISTOGRAMS, shared). */
const HISTO_METRICS: MetricKey[] = ['netIncome', 'revenue', 'fcf', 'shares', 'operatingIncome', 'totalDebt'];

/**
 * Calcule + met en cache les séries des graphiques d'un ticker, période 5 ans.
 * @param nextEarningsDate  date du prochain earnings (déjà connue côté veille) → pilote le TTL.
 */
export async function warmChartCacheForTicker(ticker: string, nextEarningsDate: string | null): Promise<void> {
  const ttl = ttlUntilNextEarnings(nextEarningsDate);
  // P/FCF + Cash ROCE : les services gèrent US (Finnhub) et EU/Asie (Yahoo) en interne.
  const [pfcf, croce] = await Promise.all([
    getPfcfHistory(ticker, YEARS).catch(() => []),
    getCashRoceHistory(ticker, YEARS).catch(() => []),
  ]);
  if (pfcf.length) await cache.set(cache.cacheKey(ticker, 'pfcf-history', 'computed', YEARS), pfcf.map(p => ({ date: p.date, value: p.pfcf })), 'finnhub', ttl).catch(() => {});
  if (croce.length) await cache.set(cache.cacheKey(ticker, 'cash-roce-history', 'computed', YEARS), croce.map(p => ({ date: p.date, value: p.cashRoce })), 'finnhub', ttl).catch(() => {});
  // Histogrammes : US uniquement (l'EU/Asie passe par Yahoo dans la route → lazy-fill).
  if (!ticker.includes('.')) {
    for (const metric of HISTO_METRICS) {
      const pts = await getReportedTimeseries(ticker, metric, 'quarterly', YEARS).catch(() => []);
      if (pts.length) await cache.set(cache.cacheKey(ticker, metric, 'quarterly', YEARS), pts, 'finnhub', ttl).catch(() => {});
    }
  }
}
