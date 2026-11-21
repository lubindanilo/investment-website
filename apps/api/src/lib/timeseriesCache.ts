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
 * 6 = purge unique après le backfill du 11/08/2026. Ce bump-là ne suit AUCUN changement de code :
 *     c'est un événement de DONNÉE. Le backfill a enrichi 161 titres (Vinci : FCF de 4 exercices
 *     à 20 semestres) avant que la purge par ticker de #291 n'existe, donc ces entrées-là ne
 *     seront balayées par rien — leur TTL court jusqu'aux prochains résultats. Un bump global les
 *     périme d'un coup. À ne refaire que dans ce cas précis : un rattrapage de masse antérieur au
 *     mécanisme de purge. Les enrichissements suivants sont couverts par #291, ticker par ticker,
 *     sans rien reconstruire ailleurs.
 * 7 = CA par employé étendu par le CA annuel profond (page /revenue/ de stockanalysis, jusqu'à
 *     2005) : la stratégie de source du graphe change, donc bump — y compris pour une clé
 *     récente dont le cache paraît froid, cf. la leçon de #295 (toute vérification réchauffe).
 * 8 = effectifs profonds via la cotation US des dual-listed : l'enrichissement arrive par le
 *     STORE (retro-upgrade paresseux à la lecture), donc AUCUN mécanisme ne purge les entrées
 *     de graphe déjà réchauffées — même famille d'événement de donnée que la génération 6.
 * 9 = 20/11/2026, résolution du graphe P/FCF passée en quotidien (≤1 an) / hebdo (≤5 ans) au lieu
 *     de hebdo/mensuel, ET le chemin de repli annuel EU/ADR corrigé (il ne posait qu'UN point par
 *     exercice fiscal — litt. 4-5 points sur tout l'historique — au lieu d'un point par prix,
 *     cf. getPfcfHistoryAnnualYahoo). Sans ce bump, NVDA et tout titre déjà en cache avant ce
 *     correctif aurait continué de servir l'ancien graphe pauvre jusqu'à expiration du TTL
 *     (jusqu'à 35j) — exactement le symptôme remonté en prod sur Nvidia le jour même du fix.
 * 10 = 20/11/2026, `rollingYearSum` (intraYearStore.ts) écarte désormais les outliers de
 *     magnitude avant de sommer : stockanalysis.com glisse le total ANNUEL complet dans la case
 *     du dernier trimestre de chaque exercice pour le FCF d'ASML (et probablement d'autres
 *     titres) — marge FCF/CA à 95-113 % sur ces lignes, impossible pour un vrai trimestre. Sans
 *     filtre, ce point entrait dans la fenêtre glissante de 4 trimestres et DOUBLAIT le FCF
 *     douze mois — P/FCF ASML.AS mesuré à 21,8× au lieu de 42,2× à la même date, exactement la
 *     divergence carte/graphe remontée en prod. Le fix change la valeur de `flow()` pour tout
 *     titre dont le store contient un tel outlier : bump obligatoire, pas facultatif.
 * 11 = 20/11/2026, suite immédiate de la 10 : un trimestre outlier fait désormais basculer
 *     TOUT le chemin intra-annuel sur l'annuel complet (pfcfHistory.ts), au lieu de juste
 *     percer un trou dans la série — la génération 10 perçait un trou qui coupait le graphe
 *     bien avant aujourd'hui (ASML.AS : s'arrêtait en avril 2025) dès que l'outlier touchait
 *     la fenêtre la plus récente. Changement de valeur pour tout titre concerné : bump.
 * 12 = 20/11/2026, chemin US du P/FCF : le nombre d'actions est toléré jusqu'à 400 jours (au
 *     lieu de 200), le 4e trimestre fiscal manquant toujours dans la série. Sans ça chaque
 *     titre perdait ses dernières semaines de graphe une fois par an (INTU coupé au 16/11).
 *     Les entrées déjà en cache, posées pour 35 jours, garderaient la courbe tronquée : bump.
 * 13 = 20/11/2026, trimestres de flux faux réparés dans le store par recoupement SEC (CA,
 *     résultat net, CFO : cf. edgarQuarterReconcile). Les ratios (marges) et le P/FCF (via le
 *     CFO) en dépendent : bump pour ne pas servir les courbes calculées sur les valeurs fausses.
 */
const CHART_STRATEGY_GENERATION = 13;

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

/**
 * Invalide TOUS les graphes d'un ticker (toutes familles, toutes fenêtres, toutes générations).
 *
 * Le TTL de ce cache est calé sur les prochains résultats, sur l'hypothèse que la donnée sous-
 * jacente ne bouge qu'à ce moment-là. L'accumulation du store la dément : un backfill, une source
 * réparée ou un rattrapage d'historique ENRICHISSENT la série entre deux publications. Mesuré le
 * 11/08/2026 sur Vinci — le backfill a porté son FCF de 4 exercices à 20 semestres remontant à
 * 2016, et l'API a continué de servir les 4 exercices, parce que l'entrée de cache avait été
 * écrite quelques heures plus tôt et courait jusqu'aux résultats suivants. Sans cet appel, tout
 * utilisateur ayant ouvert le graphe avant le rattrapage gardait la version courte des semaines.
 *
 * Appelé par les accumulations quand elles ont RÉELLEMENT ajouté des périodes — pas à chaque
 * passage, un backfill ne doit pas invalider les 24 000 tickers qu'il visite pour rien.
 *
 * Limite connue et bornée : le L1 des instances web déjà chaudes n'est pas touché (il vit dans un
 * autre process que l'accumulation). Ces instances resservent leur copie jusqu'à recyclage, de
 * l'ordre de la minute à l'heure — sans commune mesure avec les semaines que dure le L2.
 */
export async function purgeTicker(ticker: string): Promise<number> {
  const prefix = `${ticker.toUpperCase()}|`;
  for (const k of l1.keys()) if (k.startsWith(prefix)) l1.delete(k);
  try {
    const { count } = await prisma.chartCache.deleteMany({ where: { key: { startsWith: prefix } } });
    return count;
  } catch {
    return 0; // best-effort : une purge ratée se rattrape au TTL, elle ne doit rien casser
  }
}
