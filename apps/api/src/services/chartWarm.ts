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
/** Profondeur « All » du sélecteur du graphe P/FCF (cf. PERIOD_YEARS.All). */
const OPP_YEARS = 50;
/** Métriques d'histogramme exposées dans l'UI (cf. CRITERION_HISTOGRAMS, shared). */
const HISTO_METRICS: MetricKey[] = ['netIncome', 'revenue', 'fcf', 'shares', 'operatingIncome', 'totalDebt'];

/**
 * Calcule + met en cache les séries des graphiques d'un ticker.
 * @param nextEarningsDate  date du prochain earnings (déjà connue côté veille) → pilote le TTL.
 */
export async function warmChartCacheForTicker(ticker: string, nextEarningsDate: string | null): Promise<void> {
  const ttl = ttlUntilNextEarnings(nextEarningsDate);
  // P/FCF (5 ans = vue par défaut du graphe, + 50 ans = vue « All » et calcul opportunité)
  // + Cash ROCE. Les services gèrent US (Finnhub) et EU/Asie (Yahoo) en interne.
  const [pfcf, pfcfAll, croce] = await Promise.all([
    getPfcfHistory(ticker, YEARS).catch(() => []),
    getPfcfHistory(ticker, OPP_YEARS).catch(() => []),
    getCashRoceHistory(ticker, YEARS).catch(() => ({ points: [], freq: 'quarterly' as const })),
  ]);
  if (pfcf.length) await cache.set(cache.cacheKey(ticker, 'pfcf-history', 'computed-adj-fx', YEARS), pfcf.map(p => ({ date: p.date, value: p.pfcf })), 'finnhub', ttl).catch(() => {});
  if (pfcfAll.length) await cache.set(cache.cacheKey(ticker, 'pfcf-history', 'computed-adj-fx', OPP_YEARS), pfcfAll.map(p => ({ date: p.date, value: p.pfcf })), 'finnhub', ttl).catch(() => {});
  // Clé + méta alignées sur la route /api/cash-roce-history (génération 'computed2', servedFreq
  // porte annualOnly) — sinon le warm remplirait une clé que la route ne lit pas.
  if (croce.points.length) await cache.set(cache.cacheKey(ticker, 'cash-roce-history', 'computed2', YEARS), croce.points.map(p => ({ date: p.date, value: p.cashRoce })), 'finnhub', ttl, { servedFreq: croce.freq }).catch(() => {});

  // NB : le flag « opportunité du moment » (ScreenerTicker.opportunity/pfcfPercentile) est calculé
  // au scoring (scoreOne) — source unique, couvre tout l'univers — pas ici (warm = cache graphes).
  // Histogrammes : US uniquement (l'EU/Asie passe par Yahoo dans la route → lazy-fill).
  if (!ticker.includes('.')) {
    for (const metric of HISTO_METRICS) {
      const pts = await getReportedTimeseries(ticker, metric, 'quarterly', YEARS).catch(() => []);
      if (pts.length) await cache.set(cache.cacheKey(ticker, metric, 'quarterly', YEARS), pts, 'finnhub', ttl).catch(() => {});
    }
  }
}
