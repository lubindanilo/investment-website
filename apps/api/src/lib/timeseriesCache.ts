/**
 * Cache des séries temporelles des graphiques détaillés (/api/timeseries, /pfcfHistory,
 * /cashRoceHistory).
 *
 * Persistance : DB (table `ChartCache`) + couche mémoire chaude (L1) par instance.
 *   - L1 (Map) : hits instantanés + dédup des requêtes concurrentes dans une même instance.
 *   - L2 (Postgres) : partagé entre TOUTES les instances de lambda, survit aux cold starts.
 *     → un graphe calculé une fois (par n'importe qui) est rapide partout ensuite.
 *
 * TTL « intelligent » : calé sur la prochaine date d'earnings (typiquement 2-3 mois).
 * Le jour d'une nouvelle publication, l'entrée expire → recompute incorporant le trimestre.
 * Donc l'invalidation post-résultats est gratuite (pas besoin de toucher au cache à la main).
 */
import type { TimeseriesPoint } from '@lubin/shared';
import { prisma } from '../db/client.js';

export interface CacheMeta {
  /** Granularité effectivement servie ('quarterly' ou 'annual'), si différente de la clé. */
  servedFreq?: 'quarterly' | 'annual';
  /** true si on a basculé sur l'annuel Yahoo faute de trimestriel (ADR 20-F). */
  annualFallback?: boolean;
}

export interface CacheEntry extends CacheMeta {
  points: TimeseriesPoint[];
  source: 'yahoo' | 'finnhub';
  expiresAt: number;
  storedAt: number;
}

const l1 = new Map<string, CacheEntry>();
const PURGE_THRESHOLD = 500;

/** Clé canonique : ticker|metric|freq|years */
export function cacheKey(ticker: string, metric: string, freq: string, years: number): string {
  return `${ticker}|${metric}|${freq}|${years}`;
}

/** Lit le cache (L1 mémoire → L2 DB). Retourne null si absent ou expiré. */
export async function get(key: string): Promise<CacheEntry | null> {
  const now = Date.now();
  const hot = l1.get(key);
  if (hot) {
    if (now <= hot.expiresAt) return hot;
    l1.delete(key);
  }
  try {
    const row = await prisma.chartCache.findUnique({ where: { key } });
    if (!row) return null;
    const expiresAt = row.expiresAt.getTime();
    if (now > expiresAt) return null; // expiré (purge paresseuse au prochain set)
    const entry: CacheEntry = {
      points: row.points as unknown as TimeseriesPoint[],
      source: (row.source as 'yahoo' | 'finnhub') ?? 'finnhub',
      servedFreq: (row.servedFreq as 'quarterly' | 'annual' | null) ?? undefined,
      annualFallback: row.annualFallback ?? undefined,
      expiresAt,
      storedAt: row.storedAt.getTime(),
    };
    l1.set(key, entry); // réchauffe L1
    return entry;
  } catch {
    return null; // un souci DB ne doit jamais casser le graphe → on recompute
  }
}

/** Écrit le cache (L1 + L2). Best-effort sur la DB : n'émet jamais d'erreur. */
export async function set(
  key: string,
  points: TimeseriesPoint[],
  source: 'yahoo' | 'finnhub',
  ttlMs: number,
  meta?: CacheMeta,
): Promise<void> {
  const now = Date.now();
  const entry: CacheEntry = {
    points, source, storedAt: now, expiresAt: now + ttlMs,
    servedFreq: meta?.servedFreq, annualFallback: meta?.annualFallback,
  };
  l1.set(key, entry);
  if (l1.size > PURGE_THRESHOLD) {
    for (const [k, v] of l1) if (v.expiresAt < now) l1.delete(k);
  }
  try {
    const data = {
      points: points as unknown as object, source,
      servedFreq: meta?.servedFreq ?? null, annualFallback: meta?.annualFallback ?? null,
      expiresAt: new Date(entry.expiresAt), storedAt: new Date(now),
    };
    await prisma.chartCache.upsert({ where: { key }, update: data, create: { key, ...data } });
  } catch { /* best-effort : L1 sert quand même cette instance */ }
}

export function clear(): void { l1.clear(); }
