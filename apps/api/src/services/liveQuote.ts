/**
 * liveQuote — prix en direct d'un titre, quelle que soit sa place de cotation.
 *
 * Finnhub /quote ne couvre que les cotations US : pour 000660.KS, NESN.SW ou MC.PA il ne renvoie
 * rien d'exploitable. Tous les recomputes « live » (fiche, watchlist, fiche screener, percentile)
 * retombaient alors en silence sur le prix figé du dernier scoring — jusqu'à 120 jours pour un
 * titre hors US. Constaté le 21/11/2026 sur SK Hynix : 1 418 000 ₩ servis (scoring du 01/11)
 * pour 1 113 000 ₩ réels, P/FCF 8,2× au lieu de 6,5×.
 *
 * Titres suffixés (convention de l'app : suffixe Yahoo = cotation hors US) → Yahoo /v8/chart, le
 * même appel qui fournit déjà le prix du scoring, donc même devise et même unité (GBp à Londres).
 * Repli Finnhub si Yahoo ne connaît pas le symbole. Mémo court : une fiche ouverte par plusieurs
 * visiteurs ne doit pas multiplier les appels Yahoo.
 */
import { getQuote } from './finnhub.js';
import { probeOne } from './yahooResolve.js';
import { yahooLimiter } from '../lib/limiter.js';

export interface LiveQuote {
  /** Dernier prix, devise et unité de cotation. */
  c: number;
  /** Variation du jour en %, si connue. */
  dp: number | null;
}

const TTL_MS = 60_000;
const memo = new Map<string, { quote: LiveQuote | null; at: number }>();

async function finnhubQuote(ticker: string): Promise<LiveQuote | null> {
  const q = await getQuote(ticker).catch(() => null);
  return q?.c != null && q.c > 0 ? { c: q.c, dp: Number.isFinite(q.dp) ? q.dp : null } : null;
}

export async function getLiveQuote(ticker: string): Promise<LiveQuote | null> {
  const key = ticker.trim().toUpperCase();
  if (!key.includes('.')) return finnhubQuote(key);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.quote;
  const y = await yahooLimiter.schedule(() => probeOne(key)).catch(() => null);
  const quote = y ? { c: y.price, dp: y.dayChangePct ?? null } : await finnhubQuote(key);
  memo.set(key, { quote, at: Date.now() });
  return quote;
}

/** Test-only. */
export function _resetLiveQuoteMemo(): void {
  memo.clear();
}
