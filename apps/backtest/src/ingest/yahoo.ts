/**
 * Ingestion Yahoo /v8/finance/chart — récupère en UN appel : prix mensuels (close brut +
 * adjClose) ET les splits. Mensuel suffit pour des cohortes mensuelles et pour le percentile
 * P/FCF (l'app elle-même graphe en mensuel au-delà d'1 an). On remonte ~25 ans.
 *
 * Pourquoi garder les DEUX prix :
 *   - close brut  → market cap point-in-time = close × shares (valorisation correcte)
 *   - adjClose    → rendement total (splits + dividendes réinvestis) pour le backtest
 */
import { fetchJson } from '../lib/throttle.js';
import type { PricePoint, SplitPoint } from '../store.js';

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
// Yahoo throttle les IP : on reste prudent (~1.5 s entre appels).
const MIN_INTERVAL_MS = 1500;

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      events?: { splits?: Record<string, { date?: number; numerator?: number; denominator?: number }> };
      indicators?: {
        adjclose?: Array<{ adjclose?: (number | null)[] }>;
        quote?: Array<{ close?: (number | null)[] }>;
      };
    }>;
    error?: { description?: string } | null;
  };
}

export interface YahooSeries { prices: PricePoint[]; splits: SplitPoint[] }

/** Récupère prix mensuels (close + adjClose) + splits pour un symbole Yahoo, sur `years` ans. */
export async function fetchMonthlyPricesAndSplits(symbol: string, years = 25): Promise<YahooSeries> {
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - Math.ceil(years * 365.25) * 24 * 3600;
  const url = `${CHART_BASE}/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1mo&events=split`;
  const data = await fetchJson<YahooChartResponse>(url, {
    throttleKey: 'yahoo',
    minIntervalMs: MIN_INTERVAL_MS,
    label: `yahoo chart ${symbol}`,
  });
  if (data.chart?.error) throw new Error(`Yahoo: ${data.chart.error.description}`);
  const result = data.chart?.result?.[0];
  if (!result) return { prices: [], splits: [] };

  const ts = result.timestamp ?? [];
  const adj = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  const raw = result.indicators?.quote?.[0]?.close ?? [];

  // `close` = split-ajusté à AUJOURD'HUI (Yahoo `quote.close`, SANS dividendes) → today-basis.
  // On l'appariera à des actions elles aussi today-basis (getReportedTimeseries('shares'), qui
  // gère les restatements de splits via splitAdjustWithDiscontinuity) → market cap correct,
  // robuste autour des splits. `adjClose` = split + dividendes → rendement total (payoff backtest).
  const prices: PricePoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    const close = raw[i];
    const adjClose = adj[i] ?? close;
    if (typeof t !== 'number' || typeof close !== 'number' || !Number.isFinite(close) || close <= 0) continue;
    if (typeof adjClose !== 'number' || !Number.isFinite(adjClose) || adjClose <= 0) continue;
    prices.push({ date: new Date(t * 1000).toISOString().slice(0, 10), close, adjClose });
  }
  prices.sort((a, b) => a.date.localeCompare(b.date));

  const splitsObj = result.events?.splits ?? {};
  const splits: SplitPoint[] = Object.values(splitsObj)
    .map(s => {
      if (typeof s.date !== 'number' || typeof s.numerator !== 'number' || typeof s.denominator !== 'number') return null;
      if (s.numerator <= 0 || s.denominator <= 0) return null;
      return { date: new Date(s.date * 1000).toISOString().slice(0, 10), numerator: s.numerator, denominator: s.denominator };
    })
    .filter((x): x is SplitPoint => x !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  return { prices, splits };
}
