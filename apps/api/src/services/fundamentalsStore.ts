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
  /**
   * Cadence RÉELLE des points stockés : 'quarterly' | 'semiannual' | 'annual'.
   * Indispensable côté lecture : ~25 % des émetteurs EU (LVMH, L'Oréal, Vinci…) ne publient pas
   * de Q1/Q3 (directive Transparence UE), leurs points sont des SEMESTRES. Les servir en les
   * annonçant « trimestriels » afficherait « Trimestre S1 2025 » sur des barres de 6 mois.
   */
  freq: string;
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
      freq: row.freq,
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
  // Dédup EXACTE par date : d'anciennes séries contiennent des doublons (même `end` émis 2x par
  // l'ancien décumul EDGAR YTD+trimestre, avant le correctif). Ces doublons corrompent les calculs
  // TTM en aval (P/FCF, CAGR). On nettoie l'existant à chaque écriture → auto-réparation.
  const clean = dedupeByDate(existing);
  if (clean.length === 0) return dedupeByDate([...built].sort(byDate));
  const existingTs = clean.map(p => Date.parse(p.date));
  const isKnown = (t: number) => existingTs.some(h => Math.abs(h - t) < PROXIMITY_MS);
  const fresh = built.filter(b => !isKnown(Date.parse(b.date)));
  if (fresh.length === 0) return clean; // rien de nouveau (existant déjà dédupliqué)
  return dedupeByDate([...clean, ...fresh].sort(byDate));
}

/**
 * Écart relatif en deçà duquel une révision n'est pas prise en compte : arrondis et petits
 * écarts entre sources (Yahoo-Q vs stockanalysis) ne justifient pas de réécrire le stock.
 */
const REVISION_TOLERANCE = 0.005;

/**
 * Comme appendOnlyMerge, mais les `reviseLast` périodes LES PLUS RÉCENTES de `built` remplacent
 * la valeur stockée à la même date quand elles en diffèrent au-delà de REVISION_TOLERANCE.
 *
 * Pourquoi : la première version d'un trimestre fraîchement publié est parfois fausse chez la
 * source, puis corrigée quelques jours plus tard. En pur append-only, cette première version
 * restait figée pour toujours. Cas mesuré : SK Hynix (000660.KS) T2 2026, capté avec un CFO de
 * -20,2 T₩ et des fonds propres de 4,4 T₩, corrigés depuis par stockanalysis à +65,4 et 262,7.
 * Le FCF du graphe tombait à -30,9 T₩ au lieu de +54,7, et le P/FCF TTM était ~3× trop haut.
 *
 * La fenêtre reste courte (les dernières périodes seulement) : l'historique ancien garde sa
 * stabilité point-in-time, et une date absente du stock est ajoutée comme avant.
 */
export function mergeWithRecentRevisions(
  existing: TimeseriesPoint[],
  built: TimeseriesPoint[],
  reviseLast: number,
): TimeseriesPoint[] {
  const merged = appendOnlyMerge(existing, built);
  if (reviseLast <= 0 || built.length === 0) return merged;
  const recent = [...built].sort(byDate).slice(-reviseLast);
  for (const b of recent) {
    const t = Date.parse(b.date);
    // Point stocké le plus proche de cette période (même tolérance de dates que la fusion).
    let idx = -1;
    let best = Infinity;
    merged.forEach((p, i) => {
      const d = Math.abs(Date.parse(p.date) - t);
      if (d < PROXIMITY_MS && d < best) { best = d; idx = i; }
    });
    if (idx < 0) continue;
    const old = merged[idx]!.value;
    const scale = Math.max(Math.abs(old), Math.abs(b.value));
    if (scale === 0 || Math.abs(old - b.value) / scale <= REVISION_TOLERANCE) continue;
    merged[idx] = b;
  }
  return dedupeByDate(merged.sort(byDate));
}

const byDate = (a: TimeseriesPoint, b: TimeseriesPoint) => a.date.localeCompare(b.date);

/** Supprime les points à date EXACTEMENT identique (garde le 1er rencontré). */
export function dedupeByDate(points: TimeseriesPoint[]): TimeseriesPoint[] {
  const seen = new Set<string>();
  const out: TimeseriesPoint[] = [];
  for (const p of points) {
    if (seen.has(p.date)) continue;
    seen.add(p.date);
    out.push(p);
  }
  return out;
}

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
  /** Nombre de périodes les plus récentes de `built` autorisées à RÉVISER le stock (défaut 0 =
   *  append-only strict). Cf mergeWithRecentRevisions. */
  reviseLast?: number;
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
  const merged = mergeWithRecentRevisions(existing, built, opts.reviseLast ?? 0);
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
