/**
 * Service Finnhub — source primaire pour métriques + quote + news.
 * Free tier : 60 req/min. Tous les appels passent par :
 *   1. Cache en mémoire (TTL par endpoint) — évite de cramer le quota sur des analyses répétées
 *   2. finnhubLimiter (Bottleneck) — limite à 50 req/min
 *   3. fetchWithRetry — retry sur 429/5xx (mais peu de tentatives pour 429 car réinitialisation côté API = 60s)
 */
import { finnhubLimiter } from '../lib/limiter.js';
import { fetchWithRetry } from '../lib/retry.js';

const BASE = 'https://finnhub.io/api/v1';
const TOKEN = process.env.FINNHUB_API_KEY ?? '';

if (!TOKEN) console.warn('[finnhub] FINNHUB_API_KEY non défini — les appels échoueront');

// ── Cache en mémoire avec TTL paramétrable par appel ─────────────────────
interface CacheEntry { data: unknown; expiresAt: number }
const cache = new Map<string, CacheEntry>();
const PURGE_THRESHOLD = 1000;  // au-delà, purge les entrées expirées

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data as T;
}
function setCached(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  if (cache.size > PURGE_THRESHOLD) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.expiresAt < now) cache.delete(k);
  }
}

async function fhGet<T>(path: string, label: string, ttlMs: number): Promise<T> {
  const cacheKey = path;
  const hit = getCached<T>(cacheKey);
  if (hit !== null) {
    // pas de log pour éviter le bruit (les hits sont fréquents)
    return hit;
  }
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE}${path}${sep}token=${TOKEN}`;
  return finnhubLimiter.schedule(async () => {
    // attempts=2 pour 429 : on essaie 1× puis on attend brièvement pour les transients
    const res = await fetchWithRetry(url, undefined, { label: `finnhub ${label}`, attempts: 2, baseDelayMs: 200 });
    const data = await res.json() as T;
    setCached(cacheKey, data, ttlMs);
    return data;
  });
}

// ── TTL recommandés ───────────────────────────────────────────────────────
const TTL_QUOTE   = 60_000;          // prix : 1 min (peut bouger)
const TTL_METRIC  = 5 * 60_000;      // métriques fondamentales : 5 min (changent par trimestre)
const TTL_PROFILE = 60 * 60_000;     // nom de boîte : 1h (statique)
const TTL_NEWS    = 5 * 60_000;      // news : 5 min

export interface FinnhubMetricResponse {
  metric?: Record<string, number | null>;
  series?: unknown;
}

export interface FinnhubProfile2 {
  ticker?: string;
  name?: string;
  finnhubIndustry?: string;
  exchange?: string;
  weburl?: string;
}

export interface FinnhubQuote {
  c: number; d: number; dp: number; h: number; l: number; pc: number;
}

export interface FinnhubNewsItem {
  category: string;
  datetime: number;
  headline: string;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export const getMetric = (ticker: string) =>
  fhGet<FinnhubMetricResponse>(`/stock/metric?symbol=${ticker}&metric=all`, 'metric', TTL_METRIC);

export const getProfile2 = (ticker: string) =>
  fhGet<FinnhubProfile2>(`/stock/profile2?symbol=${ticker}`, 'profile2', TTL_PROFILE);

export const getQuote = (ticker: string) =>
  fhGet<FinnhubQuote>(`/quote?symbol=${ticker}`, 'quote', TTL_QUOTE);

export function getCompanyNews(ticker: string, days = 60) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return fhGet<FinnhubNewsItem[]>(`/company-news?symbol=${ticker}&from=${fmt(from)}&to=${fmt(to)}`, 'news', TTL_NEWS);
}
