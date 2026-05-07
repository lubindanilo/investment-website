/**
 * Service Finnhub /calendar/earnings — récupère la date du prochain rapport
 * d'une entreprise pour caler le TTL du cache timeseries.
 *
 * Endpoint : https://finnhub.io/api/v1/calendar/earnings?symbol=X&from=...&to=...
 * Free tier : OK pour ce endpoint.
 *
 * On regarde les 100 prochains jours pour être sûr d'attraper le prochain rapport
 * (typique : 60-90 jours entre 2 rapports trimestriels).
 */
import { finnhubLimiter } from '../lib/limiter.js';
import { fetchWithRetry } from '../lib/retry.js';

const BASE = 'https://finnhub.io/api/v1';
const TOKEN = process.env.FINNHUB_API_KEY ?? '';

interface FinnhubEarningsResponse {
  earningsCalendar?: Array<{
    symbol: string;
    /** YYYY-MM-DD */
    date: string;
    hour?: string;
    epsActual?: number | null;
    epsEstimate?: number | null;
    revenueActual?: number | null;
    revenueEstimate?: number | null;
    quarter?: number;
    year?: number;
  }>;
}

// Cache interne : evite de re-fetch la date pour chaque appel timeseries
interface CachedEarnings { date: string | null; cachedAt: number }
const EARNINGS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 jours (date earnings change rarement)
const earningsCache = new Map<string, CachedEarnings>();

/**
 * Retourne la date du prochain rapport (YYYY-MM-DD) ou null si inconnu.
 * Le résultat est mémoïsé 7 jours.
 */
export async function getNextEarningsDate(ticker: string): Promise<string | null> {
  const cached = earningsCache.get(ticker);
  if (cached && Date.now() - cached.cachedAt < EARNINGS_CACHE_TTL) {
    return cached.date;
  }

  if (!TOKEN) return null;

  // Fenêtre : aujourd'hui → +100 jours
  const today = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 100);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url = `${BASE}/calendar/earnings?symbol=${ticker}&from=${fmt(today)}&to=${fmt(to)}&token=${TOKEN}`;

  try {
    const data = await finnhubLimiter.schedule(async () => {
      const res = await fetchWithRetry(url, undefined, { label: `finnhub earnings ${ticker}`, attempts: 2 });
      return res.json() as Promise<FinnhubEarningsResponse>;
    });
    const items = data.earningsCalendar ?? [];
    // Plus proche dans le futur
    const upcoming = items
      .filter(e => e.symbol === ticker && /^\d{4}-\d{2}-\d{2}$/.test(e.date))
      .sort((a, b) => a.date.localeCompare(b.date));
    const next = upcoming[0]?.date ?? null;
    earningsCache.set(ticker, { date: next, cachedAt: Date.now() });
    if (next) console.log(`[earnings ${ticker}] prochain rapport : ${next}`);
    return next;
  } catch (e) {
    console.warn(`[earnings ${ticker}] échec :`, (e as Error).message);
    earningsCache.set(ticker, { date: null, cachedAt: Date.now() });
    return null;
  }
}

/**
 * Calcule le TTL en ms basé sur la prochaine date d'earnings.
 * Si pas de date connue → fallback 24h.
 * Si la date d'earnings est passée (cas rare, désynchronisation) → 24h aussi.
 */
export function ttlUntilNextEarnings(nextDate: string | null): number {
  const FALLBACK = 24 * 60 * 60 * 1000;
  if (!nextDate) return FALLBACK;
  const nextTs = Date.parse(nextDate + 'T12:00:00Z'); // midi UTC pour éviter les fuseaux
  if (Number.isNaN(nextTs)) return FALLBACK;
  // TTL = jusqu'à la date + 1 jour (laisser le 10-Q se publier le matin)
  const ttl = (nextTs - Date.now()) + 24 * 60 * 60 * 1000;
  // Borne : min 1h, max 100 jours
  return Math.max(60 * 60 * 1000, Math.min(ttl, 100 * 24 * 60 * 60 * 1000));
}
