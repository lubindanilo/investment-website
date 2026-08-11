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
import type { TimeseriesFreq, TimeseriesPoint } from '@lubin/shared';
import { prisma } from '../db/client.js';
import { SNAPSHOT_LOGIC_VERSION } from '../services/quantCache.js';

/**
 * Origine de la série servie. 'store' = série intra-annuelle relue du store FundamentalsSeries
 * (accumulée depuis Yahoo trimestriel + stockanalysis), par opposition à un fetch direct.
 */
export type ChartSource = 'yahoo' | 'finnhub' | 'store';

export interface CacheMeta {
  /** Granularité effectivement servie, si différente de celle demandée. */
  servedFreq?: TimeseriesFreq;
  /** true si on a basculé sur l'annuel faute d'intra-annuel (ADR 20-F, EU sans historique). */
  annualFallback?: boolean;
}

export interface CacheEntry extends CacheMeta {
  points: TimeseriesPoint[];
  source: ChartSource;
  expiresAt: number;
  storedAt: number;
}

const l1 = new Map<string, CacheEntry>();
const PURGE_THRESHOLD = 500;

/** Clé canonique : ticker|metric|freq|years */
export function cacheKey(ticker: string, metric: string, freq: string, years: number): string {
  return `${ticker}|${metric}|${freq}|${years}`;
}

/**
 * Compteur de la STRATÉGIE DE SOURCE des graphes dérivés du FCF : d'où viennent les points
 * (store intra-annuel EU, repli annuel, profondeur EDGAR/stockanalysis, garde-fou de cohérence…).
 * À bumper à la main quand cette stratégie change, comme le faisaient les compteurs par famille
 * qu'il remplace : 'computed-adj-fx4' (P/FCF), 'computed4' (Cash ROCE), 'ratio7' (ratios).
 *
 * 5 = état de #286 (P/FCF et Cash ROCE EU au-delà de 4 exercices), point de départ commun.
 */
const CHART_STRATEGY_GENERATION = 5;

/**
 * Génération des graphes DÉRIVÉS DU FCF (P/FCF, Cash ROCE, ratios marge FCF / dette-FCF /
 * conversion). À placer dans le `freq` de leur clé de cache, derrière le préfixe propre à chaque
 * famille pour qu'elles ne se télescopent pas.
 *
 * Deux causes d'invalidation, d'où deux composantes :
 *   - la STRATÉGIE de source du graphe → `CHART_STRATEGY_GENERATION`, bumpé à la main ;
 *   - la FORMULE du FCF → `SNAPSHOT_LOGIC_VERSION`, qui invalide déjà les fiches, et qu'on
 *     rattache ICI pour qu'un correctif de formule ne puisse plus atteindre la fiche sans
 *     atteindre son graphe.
 *
 * Ce second point est un vrai mode d'échec, pas une précaution théorique. Il s'est produit deux
 * fois : le graphe P/FCF de MELI servait 7,8× quand sa fiche affichait 15,2×, et traçait une
 * courbe À L'INTÉRIEUR des zones grisées « FCF négatif » (celles-ci sont recalculées à la volée,
 * donc déjà à la formule courante). Le commentaire de 'ratio7' raconte le même oubli sur #281.
 * Un compteur par famille, c'est un compteur oublié : il n'y en a plus qu'un.
 *
 * Coût assumé : un bump de l'une des deux composantes reconstruit les trois familles au premier
 * accès, comme après une publication de résultats. Du recalcul, jamais un chiffre faux.
 */
export const FCF_CHART_GENERATION = `s${CHART_STRATEGY_GENERATION}fcf${SNAPSHOT_LOGIC_VERSION}`;

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
      source: (row.source as ChartSource) ?? 'finnhub',
      servedFreq: (row.servedFreq as TimeseriesFreq | null) ?? undefined,
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
  source: ChartSource,
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
