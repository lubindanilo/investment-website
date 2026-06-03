/**
 * fundamentalsStore — store PERSISTANT et CANONIQUE des séries trimestrielles brutes
 * (table FundamentalsSeries). Lecture-traversante pour getReportedTimeseries :
 *   - série fraîche en DB → zéro appel réseau (Finnhub + EDGAR) entre deux earnings ;
 *   - périmée/absente → le caller reconstruit puis appelle appendMergePersist().
 *
 * APPEND-ONLY : on n'ajoute que les trimestres dont la date est absente du stock
 * (±20j de proximité, pour absorber la dérive de dates Finnhub vs EDGAR). On n'écrase
 * JAMAIS une valeur déjà stockée → stabilité point-in-time, et un trou ancien comblé
 * plus tard est tout de même ajouté (sa date n'existait pas).
 *
 * On stocke la série PRÉ-ajustement splits ; l'ajustement (shares) se fait à la lecture.
 */
import type { TimeseriesPoint } from '@lubin/shared';
import { prisma } from '../db/client.js';

const DAY_MS = 86_400_000;
/** Tolérance de proximité de dates pour considérer deux points comme la MÊME période. */
const PROXIMITY_MS = 20 * DAY_MS;

/** Cadence d'expiration par fréquence : délai après la dernière période avant d'attendre un nouveau dépôt. */
export interface ExpiryCadence {
  /** Jours après lastEnd avant qu'une nouvelle période soit attendue. quarterly ~120, annual ~400. */
  cadenceDays: number;
  /** Plancher de re-check quand le dépôt attendu n'est pas encore là. quarterly ~14, annual ~30. */
  floorDays: number;
}
const QUARTERLY_CADENCE: ExpiryCadence = { cadenceDays: 120, floorDays: 14 };

export interface StoredSeries {
  points: TimeseriesPoint[];
  source: string;
  lastEnd: string | null;
  expiresAt: Date;
}

/** Lit la série stockée pour (ticker, metric). Null si absente. Best-effort (jamais throw). */
export async function readSeries(ticker: string, metric: string): Promise<StoredSeries | null> {
  try {
    const row = await prisma.fundamentalsSeries.findUnique({
      where: { ticker_metric: { ticker: ticker.toUpperCase(), metric } },
    });
    if (!row) return null;
    return {
      points: (row.points as unknown as TimeseriesPoint[]) ?? [],
      source: row.source,
      lastEnd: row.lastEnd,
      expiresAt: row.expiresAt,
    };
  } catch {
    return null;
  }
}

/** True si la série stockée est encore fraîche (pas besoin de re-fetcher). */
export function isFresh(stored: StoredSeries | null, nowMs: number): boolean {
  return stored != null && stored.expiresAt.getTime() > nowMs;
}

/** Échéance de re-fetch : lastEnd + cadence, avec un plancher de re-check depuis maintenant. */
function computeExpiry(lastEnd: string | null, nowMs: number, cadence: ExpiryCadence): Date {
  const floor = nowMs + cadence.floorDays * DAY_MS;
  if (!lastEnd) return new Date(floor);
  const due = Date.parse(lastEnd) + cadence.cadenceDays * DAY_MS;
  return new Date(Math.max(due, floor));
}

/**
 * Fusion APPEND-ONLY de `built` (reconstruction fraîche) dans `existing` (stock) :
 * on conserve tout l'existant inchangé et on n'ajoute que les points de `built` dont la
 * date n'est PAS déjà présente (à ±20j près). Renvoie la série fusionnée triée ASC.
 */
export function appendOnlyMerge(existing: TimeseriesPoint[], built: TimeseriesPoint[]): TimeseriesPoint[] {
  if (existing.length === 0) return [...built].sort(byDate);
  const existingTs = existing.map(p => Date.parse(p.date));
  const isKnown = (t: number) => existingTs.some(h => Math.abs(h - t) < PROXIMITY_MS);
  const fresh = built.filter(b => !isKnown(Date.parse(b.date)));
  if (fresh.length === 0) return existing; // rien de nouveau
  return [...existing, ...fresh].sort(byDate);
}

const byDate = (a: TimeseriesPoint, b: TimeseriesPoint) => a.date.localeCompare(b.date);

/**
 * Fusionne append-only puis upsert. Renvoie la série EFFECTIVE (stockée) à utiliser.
 * Anti-dégradation : si la reconstruction est vide ET qu'on a déjà du stock, on garde le stock
 * (on rafraîchit juste l'échéance pour ne pas re-fetcher en boucle).
 */
export interface PersistOpts {
  /** 'quarterly' (défaut) ou 'annual'. */
  freq?: string;
  /** Cadence d'expiration. Défaut = quarterly (120j / 14j). */
  cadence?: ExpiryCadence;
  /** Si true, persiste même une série VIDE (avec expiry) → évite de re-fetcher en boucle un
   *  type qu'une source ne fournit pas (cache négatif borné). Utilisé pour le batch annuel Yahoo. */
  persistEmpty?: boolean;
}

export async function appendMergePersist(
  ticker: string,
  metric: string,
  stored: StoredSeries | null,
  built: TimeseriesPoint[],
  source: string,
  nowMs: number,
  opts: PersistOpts = {},
): Promise<TimeseriesPoint[]> {
  const freq = opts.freq ?? 'quarterly';
  const cadence = opts.cadence ?? QUARTERLY_CADENCE;
  const existing = stored?.points ?? [];
  const merged = appendOnlyMerge(existing, built);
  const lastEnd = merged.length > 0 ? merged[merged.length - 1]!.date : null;
  const expiresAt = computeExpiry(lastEnd, nowMs, cadence);
  // Série vide et rien à persister : on n'écrit que si persistEmpty (cache négatif borné).
  if (merged.length === 0 && !opts.persistEmpty) return [];

  try {
    await prisma.fundamentalsSeries.upsert({
      where: { ticker_metric: { ticker: ticker.toUpperCase(), metric } },
      create: { ticker: ticker.toUpperCase(), metric, points: merged as unknown as object, source, freq, lastEnd, expiresAt },
      update: { points: merged as unknown as object, source, freq, lastEnd, expiresAt, builtAt: new Date(nowMs) },
    });
  } catch {
    // Best-effort : si l'écriture échoue, on renvoie quand même la série mergée en mémoire.
  }
  return merged;
}
