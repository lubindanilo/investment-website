/**
 * Ingestion Finnhub /stock/financials-reported — récupère TOUS les filings 10-K/10-Q bruts
 * (annual + quarterly), en conservant filedDate (date de publication SEC). Client dédié au
 * crawl de masse (espacement propre sous la limite free 60/min) — indépendant des fetchers
 * de l'app (qui ont un cache mémoire court calé pour le runtime web).
 */
import { fetchJson } from '../lib/throttle.js';
import { requireEnv } from '../lib/env.js';
import type { RawFiling } from '../store.js';

const BASE = 'https://finnhub.io/api/v1';
// 60 req/min → on vise ~50/min pour garder de la marge : 1200 ms entre appels.
const MIN_INTERVAL_MS = 1200;

interface ReportedResponse {
  data?: RawFiling[];
  symbol?: string;
  cik?: string;
  error?: string;
}

/** Récupère les filings d'une fréquence (annual|quarterly) pour un ticker. */
export async function fetchFinancialsReported(ticker: string, freq: 'annual' | 'quarterly'): Promise<RawFiling[]> {
  const token = requireEnv('FINNHUB_API_KEY');
  const url = `${BASE}/stock/financials-reported?symbol=${encodeURIComponent(ticker)}&freq=${freq}&token=${token}`;
  const j = await fetchJson<ReportedResponse>(url, {
    throttleKey: 'finnhub',
    minIntervalMs: MIN_INTERVAL_MS,
    label: `finnhub reported ${ticker}/${freq}`,
  });
  if (j.error) throw new Error(`Finnhub: ${j.error}`);
  return (j.data ?? []).sort((a, b) => (a.endDate ?? '').localeCompare(b.endDate ?? ''));
}

/** Liste des symboles d'un exchange (pour seeder l'univers US — réservé à P2). */
interface FinnhubSymbol { symbol?: string; description?: string; type?: string; mic?: string; currency?: string }
export async function fetchStockSymbols(exchange = 'US'): Promise<FinnhubSymbol[]> {
  const token = requireEnv('FINNHUB_API_KEY');
  const url = `${BASE}/stock/symbol?exchange=${encodeURIComponent(exchange)}&token=${token}`;
  return fetchJson<FinnhubSymbol[]>(url, { throttleKey: 'finnhub', minIntervalMs: MIN_INTERVAL_MS, label: `finnhub symbols ${exchange}` });
}
