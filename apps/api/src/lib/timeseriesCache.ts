/**
 * Cache en mémoire pour les séries temporelles (route /api/timeseries).
 *
 * TTL "intelligent" :
 *   - Calé sur la prochaine date d'earnings du ticker (récupérée via Finnhub /calendar/earnings)
 *   - TTL = next earnings - now + 1 jour → typiquement 2-3 mois entre 2 rapports
 *   - Fallback 24h si la date d'earnings est inconnue
 *
 * Conséquence : si tu re-consultes le même histogramme dans les 2 mois
 * entre 2 publications, c'est instantané. Le jour où une nouvelle 10-Q est
 * publiée, le cache se vide automatiquement et un nouveau fetch incorpore
 * le trimestre fraîchement publié.
 *
 * Stockage : Map en mémoire (1 process = 1 cache). Phase 4 → migration Postgres
 * possible si déploiement multi-instance.
 */
import type { TimeseriesPoint } from '@lubin/shared';

interface CacheEntry {
  points: TimeseriesPoint[];
  /** Source ayant fourni la donnée : pour logs + debug */
  source: 'yahoo' | 'finnhub';
  expiresAt: number;
  storedAt: number;
}

const cache = new Map<string, CacheEntry>();
const PURGE_THRESHOLD = 500;

/** Clé canonique : ticker|metric|freq|years */
export function cacheKey(ticker: string, metric: string, freq: string, years: number): string {
  return `${ticker}|${metric}|${freq}|${years}`;
}

export function get(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry;
}

export function set(key: string, points: TimeseriesPoint[], source: 'yahoo' | 'finnhub', ttlMs: number): void {
  cache.set(key, {
    points,
    source,
    storedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  });
  if (cache.size > PURGE_THRESHOLD) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.expiresAt < now) cache.delete(k);
  }
}

export function clear(): void { cache.clear(); }

export function stats(): { size: number; oldest: number; newest: number } {
  let oldest = Infinity;
  let newest = 0;
  for (const v of cache.values()) {
    oldest = Math.min(oldest, v.storedAt);
    newest = Math.max(newest, v.storedAt);
  }
  return { size: cache.size, oldest, newest };
}
