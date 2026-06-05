/**
 * Cache GLOBAL par ticker du résultat de l'analyse quant.
 *
 * Architecture : source unique de vérité.
 *   - /api/analyze écrit ici après chaque compute fresh.
 *   - /api/watchlist lit ici directement (jamais de recompute).
 *
 * Conséquence : le score affiché en watchlist EST le score calculé par l'analyse.
 * Divergence mathématiquement impossible.
 *
 * Storage : table Postgres `TickerQuantSnapshot` (clé = ticker).
 * Global, pas per-user, car les fundamentaux sont universels.
 *
 * TTL implicite : on n'expire pas automatiquement. Le cache est mis à jour quand
 * l'utilisateur clique explicitement sur "Analyser" pour ce ticker. Le bouton
 * "Rafraîchir" de la watchlist force un re-fetch (cf. /api/watchlist/refresh).
 */
import type { DerivedMetrics, Criterion } from '@lubin/shared';
import { prisma } from '../db/client.js';

/**
 * Payload stocké dans la DB. Contient tout ce dont une UI a besoin pour afficher
 * une vue compacte (watchlist) OU détaillée (analyze). Les graphiques historiques
 * et les news ne sont PAS cachés ici — ils ont leur propre TTL earnings-based.
 */
export interface CachedQuantSnapshot {
  // Identité
  ticker: string;
  company: string;
  currency: string;
  fundamentalsSource: 'finnhub' | 'yahoo' | null;
  fundamentalsAvailable: boolean;
  yahooSymbol?: string;

  // Métriques + critères (utilisés par analyze pour le rendu complet)
  metrics: DerivedMetrics;
  chiffres: Criterion[];  // 10 critères qualité

  // Score précomputé — c'est CETTE VALEUR qui s'affiche en watchlist (pas de recompute)
  scoreChiffres: number;
  scoreChiffresMax: number;

  // Pour le recompute LIVE du P/FCF en watchlist (price × shares / adjFcfTtm)
  adjFcfTtm: number | null;
  sharesOutstanding: number | null;

  // ─── Prochain earnings (affiché en watchlist) ───────────────────────────
  /** Date du prochain earnings (YYYY-MM-DD). Null si inconnue. */
  nextEarningsDate?: string | null;
  /** ISO timestamp du dernier check earnings. Évite de re-fetcher en boucle quand
   *  aucune date n'est connue (recheck espacé), tout en gardant le cache valide
   *  "jusqu'à la date" quand une date future est connue. */
  earningsCheckedAt?: string | null;

  // ─── Métadonnées d'affichage (screener) ─────────────────────────────────
  /** Secteur/industrie (Finnhub). Null pour la plupart des titres Yahoo. */
  sector?: string | null;
  /** Variation du jour en % (quote.dp). */
  dayChangePct?: number | null;
}

/** Lit le snapshot caché pour un ticker. Retourne null si absent (jamais analysé). */
export async function getCachedSnapshot(ticker: string): Promise<CachedQuantSnapshot | null> {
  const row = await prisma.tickerQuantSnapshot.findUnique({ where: { ticker } });
  return row ? (row.snapshot as unknown as CachedQuantSnapshot) : null;
}

/** Cap absolu : au-delà, on recalcule même si l'earnings n'est pas atteint (sécurité fraîcheur). */
const HARD_MAX_AGE_MS = 120 * 24 * 3600 * 1000;
/** TTL pour les tickers sans date d'earnings connue. */
const UNKNOWN_EARNINGS_MAX_AGE_MS = 30 * 24 * 3600 * 1000;

/**
 * Snapshot servable « tel quel » par /api/analyze (chemin rapide, sans recompute).
 * Règle de fraîcheur : les fondamentaux ne bougent qu'aux earnings. On sert donc le cache
 * tant que le prochain earnings n'est pas atteint (date future), avec un cap absolu.
 * Le PRIX, lui, est rafraîchi en direct côté loadQuantData. Retourne null si à recalculer.
 */
export async function getServableSnapshot(ticker: string): Promise<CachedQuantSnapshot | null> {
  const row = await prisma.tickerQuantSnapshot.findUnique({ where: { ticker } });
  if (!row) return null;
  const snap = row.snapshot as unknown as CachedQuantSnapshot;
  if (!snap.fundamentalsAvailable) return null; // ne sert pas un cache "nodata"
  const ageMs = Date.now() - row.refreshedAt.getTime();
  if (ageMs > HARD_MAX_AGE_MS) return null;
  const today = new Date().toISOString().slice(0, 10);
  const ned = snap.nextEarningsDate;
  if (ned) {
    if (ned < today) return null; // earnings passé → fondamentaux potentiellement changés
  } else if (ageMs > UNKNOWN_EARNINGS_MAX_AGE_MS) {
    return null; // date inconnue → on recalcule au bout d'un mois
  }
  return snap;
}

/** Lit plusieurs snapshots en batch (pour la watchlist). */
export async function getCachedSnapshotsBatch(tickers: string[]): Promise<Map<string, CachedQuantSnapshot>> {
  if (tickers.length === 0) return new Map();
  const rows = await prisma.tickerQuantSnapshot.findMany({
    where: { ticker: { in: tickers } },
  });
  const map = new Map<string, CachedQuantSnapshot>();
  for (const r of rows) map.set(r.ticker, r.snapshot as unknown as CachedQuantSnapshot);
  return map;
}

/**
 * Nombre de critères CHIFFRÉS réellement calculables dans un snapshot (parmi les 10).
 * Indépendant de la langue : on lit les métriques dérivées, pas les libellés.
 * operatingLeverage est un booléen → non-null = calculé.
 */
function computableMetrics(snap: CachedQuantSnapshot): number {
  const m = snap.metrics ?? ({} as DerivedMetrics);
  const vals = [
    m.netMargin, m.revenueCagr, m.fcfPerShareCagr, m.shareCagr, m.fcfMargin,
    m.operatingLeverage, m.cashROCE, m.netDebtFcf, m.ccr, m.nwcCurrentRatio,
  ];
  return vals.filter((v) => v != null).length;
}

/**
 * Vrai si `next` est une DÉGRADATION de qualité vs `prev` — typiquement un échec TRANSITOIRE
 * de données (rate-limit Finnhub, appel /financials-reported qui flanche), PAS un vrai
 * changement de fondamentaux. Cas détectés :
 *   - perte des fondamentaux (available → indisponible),
 *   - rétrogradation de source (finnhub → yahoo : change l'ensemble des critères ET le
 *     dénominateur du score → grosse marche dans la note),
 *   - moins de critères chiffrés calculables (une régression est tombée en « Non calculable »).
 *
 * Dans ces cas on CONSERVE `prev` : la note affichée aux clients ne doit pas bouger sur du
 * bruit transitoire — seulement sur un vrai changement (earnings → recompute de même qualité).
 * Auto-réparation : un 1er cache dégradé (rien à comparer) est écrit, puis un recompute
 * complet est une AMÉLIORATION (non dégradation) → il écrase bien le cache dégradé.
 */
/**
 * Vrai si un snapshot contient une métrique économiquement ABERRANTE (au-delà de ce qu'un
 * recompute propre, garde-fous actifs, peut produire). Sert à NE PAS protéger un cache défectueux.
 */
export function hasAberrantMetric(snap: CachedQuantSnapshot): boolean {
  const m = snap.metrics ?? ({} as DerivedMetrics);
  const ab = (v: number | null | undefined, bad: (x: number) => boolean) =>
    typeof v === 'number' && Number.isFinite(v) && bad(v);
  // Seuils volontairement TRÈS hauts : on ne veut détecter QUE le déchet périmé d'avant les
  // garde-fous « base dégénérée » (pour autoriser son écrasement), PAS une vraie valeur haute
  // désormais légitime (qu'on conserve). Le code base-rigoureux ne produit plus ces extrêmes.
  return (
    ab(m.shareCagr,       x => Math.abs(x) > 5)  ||
    ab(m.fcfPerShareCagr, x => Math.abs(x) > 20) ||
    ab(m.revenueCagr,     x => Math.abs(x) > 5)  ||
    ab(m.netMargin,       x => x < -20 || x > 10) ||
    ab(m.fcfMargin,       x => x < -20 || x > 10) ||
    ab(m.cashROCE,        x => Math.abs(x) > 20)
  );
}

export function isQualityDegradation(prev: CachedQuantSnapshot, next: CachedQuantSnapshot): boolean {
  // DÉBLOCAGE : si le cache existant est aberrant et que le recompute est propre, on AUTORISE
  // l'écrasement même s'il a moins de critères calculables — corriger une aberration prime sur
  // la complétude (sinon l'aberration reste épinglée à vie, cf. cas FLY shareCagr=22,33).
  if (hasAberrantMetric(prev) && !hasAberrantMetric(next)) return false;
  if (prev.fundamentalsAvailable && !next.fundamentalsAvailable) return true;
  if (prev.fundamentalsSource === 'finnhub' && next.fundamentalsSource === 'yahoo') return true;
  if (computableMetrics(next) < computableMetrics(prev)) return true;
  return false;
}

/**
 * Écrit le snapshot (upsert) — appelé après chaque compute fresh. GARDE ANTI-DÉGRADATION :
 * si un cache existant est de meilleure qualité (cf. isQualityDegradation), on le CONSERVE et
 * on ne persiste pas le recompute dégradé. Renvoie le snapshot EFFECTIVEMENT en cache (le
 * conservé ou le nouveau) — les appelants (screener) doivent l'utiliser pour rester cohérents.
 */
export async function writeCachedSnapshot(ticker: string, snapshot: CachedQuantSnapshot): Promise<CachedQuantSnapshot> {
  const existing = await getCachedSnapshot(ticker).catch(() => null);
  if (existing && isQualityDegradation(existing, snapshot)) {
    console.warn(
      `[quantCache ${ticker}] recompute dégradé ignoré — source ${existing.fundamentalsSource}→${snapshot.fundamentalsSource}, ` +
      `critères calculables ${computableMetrics(existing)}→${computableMetrics(snapshot)} : cache conservé, note inchangée`,
    );
    return existing;
  }
  await prisma.tickerQuantSnapshot.upsert({
    where: { ticker },
    update: { snapshot: snapshot as unknown as object, refreshedAt: new Date() },
    create: { ticker, snapshot: snapshot as unknown as object, refreshedAt: new Date() },
  });
  return snapshot;
}
