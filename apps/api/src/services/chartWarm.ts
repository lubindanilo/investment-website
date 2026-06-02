/**
 * Préremplissage du cache des graphiques détaillés (ChartCache) pour UN ticker.
 *
 * Utilisé par la veille (à chaque score : le memo /financials-reported est encore chaud →
 * quasi gratuit) ET par le script de backfill. Best-effort : n'émet jamais d'erreur, ne doit
 * jamais bloquer le scoring. Warme la période par défaut (5 ans), celle qu'ouvre le front.
 */
import * as cache from '../lib/timeseriesCache.js';
import { getPfcfHistory, pfcfPercentile, isPfcfOpportunity } from './pfcfHistory.js';
import { getCashRoceHistory } from './cashRoceHistory.js';
import { getReportedTimeseries, type MetricKey } from './finnhubFundamentals.js';
import { ttlUntilNextEarnings } from './earnings.js';
import { prisma } from '../db/client.js';

const YEARS = 5;
/** Profondeur « All » du sélecteur du graphe P/FCF (cf. PERIOD_YEARS.All) — référence
 *  historique COMPLÈTE servant au calcul de l'« opportunité du moment ».
 *  On l'aligne sur « All » pour que le percentile affiché en valo == celui du graphe. */
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
    getCashRoceHistory(ticker, YEARS).catch(() => []),
  ]);
  if (pfcf.length) await cache.set(cache.cacheKey(ticker, 'pfcf-history', 'computed', YEARS), pfcf.map(p => ({ date: p.date, value: p.pfcf })), 'finnhub', ttl).catch(() => {});
  if (pfcfAll.length) await cache.set(cache.cacheKey(ticker, 'pfcf-history', 'computed', OPP_YEARS), pfcfAll.map(p => ({ date: p.date, value: p.pfcf })), 'finnhub', ttl).catch(() => {});
  if (croce.length) await cache.set(cache.cacheKey(ticker, 'cash-roce-history', 'computed', YEARS), croce.map(p => ({ date: p.date, value: p.cashRoce })), 'finnhub', ttl).catch(() => {});

  // « Opportunité du moment » : percentile du dernier point sur la série COMPLÈTE (= onglet
  // « All » du graphe), persisté sur ScreenerTicker pour le badge + filtre. Best-effort.
  if (pfcfAll.length) {
    const current = pfcfAll[pfcfAll.length - 1]?.pfcf ?? null;
    const pct = pfcfPercentile(pfcfAll, current);
    await prisma.screenerTicker.updateMany({
      where: { ticker },
      data: { pfcfPercentile: pct, opportunity: isPfcfOpportunity(pct, current) },
    }).catch(() => {});
  }
  // Histogrammes : US uniquement (l'EU/Asie passe par Yahoo dans la route → lazy-fill).
  if (!ticker.includes('.')) {
    for (const metric of HISTO_METRICS) {
      const pts = await getReportedTimeseries(ticker, metric, 'quarterly', YEARS).catch(() => []);
      if (pts.length) await cache.set(cache.cacheKey(ticker, metric, 'quarterly', YEARS), pts, 'finnhub', ttl).catch(() => {});
    }
  }
}
