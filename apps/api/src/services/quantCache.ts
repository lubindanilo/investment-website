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
  /**
   * Facteur convertissant `adjFcfTtm` de sa devise de REPORTING vers la devise de COTATION du
   * prix. 1 pour tout émetteur qui publie dans sa devise de cotation (la quasi-totalité), ~0,148
   * pour un ADR chinois. Figé au calcul du snapshot pour que les recomputes live (watchlist,
   * screener, percentile) n'aient pas à retaper le réseau. Voir `computeLivePfcf` et le module `fx`.
   */
  fcfFxToQuote?: number | null;
  /**
   * Génération de la LOGIQUE de calcul. `getServableSnapshot` refuse un snapshot d'une
   * génération antérieure : c'est le seul moyen de faire sortir un correctif de formule, sinon
   * le cache reste servi jusqu'au prochain earnings (jusqu'à 120 jours).
   */
  logicVersion?: number;

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

/**
 * Génération courante de la logique de calcul du snapshot. À INCRÉMENTER dès qu'une formule
 * change de résultat, sinon les caches déjà écrits continuent de servir l'ancien chiffre.
 *
 * 1 — conversion de devise du P/FCF. Le multiple divisait une capitalisation en devise de
 *     cotation par un FCF en devise de reporting : les ADR chinois affichaient PDD à 1,28×
 *     pour ~8,0× réel, ZTO à 3,34× pour ~20,8×.
 * 2 — cohérence prix ↔ actions ↔ capitalisation des ADR : la capi Yahoo publiée sert de
 *     référence de convention (shares annuelles hors convention ADS → capi publiée retenue,
 *     cf. reconcileAdsMarketCap), et la rétro-dérivation d'adjFcfTtm retombe en devise de
 *     REPORTING (extractLivePfcfInputs) — la double conversion de la génération 1 rendait le
 *     P/FCF live ~7× trop CHER pour un ADR chinois (fx appliqué deux fois).
 * 3 — flottant client retranché du FCF (CUSTOMER_FLOAT_CONCEPTS) + SBC des émetteurs qui
 *     ont migré de tag XBRL (resolveSbc) + fin du fallback pfcfShareTTM quand notre calcul
 *     a CONCLU (FCF refusé ou ≤ 0). Sans invalidation, les snapshots servaient encore le
 *     P/FCF gonflé (MELI 8,3× pour 17,3× corrigé) jusqu'au prochain earnings.
 * 4 — capex COMPOSÉ (computeCapex : somme des lignes d'investissement corporelles avec
 *     dédoublonnage agrégat/composantes, au lieu du premier tag qui matche). Débloque les
 *     déposants sans aucun des trois anciens tags (Corning 1 282 M$, EA, Alaska Air,
 *     Gallagher — leur FCF valait leur CFO) et complète les ventilés (CAT ×1,52, EOG ×1,08).
 * 5 — critère n°5 remplacé : évolution du CA par employé (effectifs stockanalysis,
 *     revenuePerEmployeeCagr) à la place de la profitabilité cash, qui devient son REPLI
 *     quand l'historique d'effectifs manque. Sans invalidation, les snapshots serviraient
 *     l'ancienne grille (et des métriques sans les champs employés) jusqu'au prochain earnings.
 * 6 — critère n°5 croisé avec la croissance du CA total : Oui seulement si les deux CAGR
 *     atteignent 10 %/an, Partiel dans les deux combinaisons 10 % / [5 %, 10 %[ définies
 *     par la méthode. Sans invalidation, notes et statuts continueraient de refléter le palier
 *     historique du seul CA par employé (> 5 %/an).
 */
export const SNAPSHOT_LOGIC_VERSION = 6;

/**
 * P/FCF « live » = capitalisation au prix courant ÷ FCF ajusté TTM.
 *
 * Recalculé à cinq endroits (chemin rapide d'analyze, percentile d'opportunité, watchlist,
 * screener ×2) et la cohérence entre eux est le principe fondateur de ce cache : la formule
 * vit donc ICI, pas dupliquée. Un percentile calculé sur une base différente de l'historique
 * bascule les cas limites (cas réel DOCU : 24,54 vs 25,30).
 *
 * `fcfFxToQuote` ramène le FCF dans la devise du prix (cf `CachedQuantSnapshot`). Absent ou
 * null → 1, ce qui reproduit exactement le comportement d'avant pour les émetteurs qui
 * publient dans leur devise de cotation.
 */
export function computeLivePfcf(
  price: number | null | undefined,
  sharesOutstanding: number | null | undefined,
  adjFcfTtm: number | null | undefined,
  fcfFxToQuote?: number | null,
): number | null {
  if (price == null || !(price > 0)) return null;
  if (sharesOutstanding == null || !(sharesOutstanding > 0)) return null;
  if (adjFcfTtm == null || adjFcfTtm === 0) return null;
  const fcfInQuoteCurrency = adjFcfTtm * (fcfFxToQuote ?? 1);
  const pfcf = (price * sharesOutstanding) / fcfInQuoteCurrency;
  return Number.isFinite(pfcf) && pfcf > 0 ? pfcf : null;
}

/**
 * Composants du recompute live (`sharesOutstanding` + `adjFcfTtm`) extraits d'un compute
 * frais. La logique vivait EN TROIS COPIES (analyze, scoreSnapshot, watchlistSnapshot) — et
 * les trois portaient le même défaut : sur le chemin Yahoo, `metrics.pfcfTTM` inclut DÉJÀ la
 * conversion de devise, donc la rétro-dérivation `marketCap / pfcfTTM` tombe en devise de
 * COTATION ; or `computeLivePfcf` attend un FCF en devise de REPORTING (contrat du chemin
 * Finnhub, où /financials-reported publie en devise native) et remultiplie par `fcfFxToQuote`.
 * Résultat : fx appliqué DEUX fois, P/FCF live ~7× trop cher pour un ADR chinois — vraies
 * opportunités tuées et percentile biaisé. On divise donc par le facteur pour retomber en
 * reporting. fx = 1 (la quasi-totalité des titres) : strictement identique à avant.
 */
export function extractLivePfcfInputs(quant: {
  fundamentalsSource: 'finnhub' | 'yahoo' | null;
  metrics: Pick<DerivedMetrics, 'marketCap' | 'price' | 'pfcfTTM'>;
  rawFhFcfAdj: { ttmFcfAdj: number | null } | null;
  rawFhCapEmp: { sharesLatest: number | null } | null;
  fcfFxToQuote: number | null;
}): { adjFcfTtm: number | null; sharesOutstanding: number | null } {
  if (quant.fundamentalsSource === 'finnhub' && quant.rawFhFcfAdj && quant.rawFhCapEmp) {
    return { adjFcfTtm: quant.rawFhFcfAdj.ttmFcfAdj, sharesOutstanding: quant.rawFhCapEmp.sharesLatest };
  }
  if (quant.fundamentalsSource === 'yahoo') {
    const m = quant.metrics;
    const sharesOutstanding = (m.marketCap != null && m.price != null && m.price > 0)
      ? m.marketCap / m.price : null;
    const fx = (quant.fcfFxToQuote != null && Number.isFinite(quant.fcfFxToQuote) && quant.fcfFxToQuote > 0)
      ? quant.fcfFxToQuote : 1;
    const adjFcfTtm = (m.marketCap != null && m.pfcfTTM != null && m.pfcfTTM > 0)
      ? m.marketCap / m.pfcfTTM / fx : null;
    return { adjFcfTtm, sharesOutstanding };
  }
  return { adjFcfTtm: null, sharesOutstanding: null };
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
  // Snapshot calculé par une logique périmée → on recalcule, quelle que soit sa fraîcheur.
  // Sans ce test, un correctif de formule n'atteint l'utilisateur qu'au prochain earnings.
  if ((snap.logicVersion ?? 0) < SNAPSHOT_LOGIC_VERSION) return null;
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
    // Critère n°5 = CA/employé, avec fcfMargin en repli : calculable si L'UN des deux l'est
    // (même logique que buildQuantitativeCriteria — compter les deux gonflerait le total à 11
    // et déclarerait « dégradé » tout recompute qui perd l'un en gagnant l'autre).
    m.netMargin, m.revenueCagr, m.fcfPerShareCagr, m.shareCagr, m.revenuePerEmployeeCagr ?? m.fcfMargin,
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
    ab(m.revenuePerEmployeeCagr, x => Math.abs(x) > 5) ||
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
export async function writeCachedSnapshot(ticker: string, snapshotIn: CachedQuantSnapshot): Promise<CachedQuantSnapshot> {
  // Estampille de génération posée ICI, au point de passage unique des trois producteurs
  // (analyze, watchlist, scoring) → aucun d'eux ne peut oublier de la mettre.
  const snapshot: CachedQuantSnapshot = { ...snapshotIn, logicVersion: SNAPSHOT_LOGIC_VERSION };
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
