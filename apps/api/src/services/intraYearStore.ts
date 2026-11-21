/**
 * intraYearStore — lecture des séries INTRA-ANNUELLES du store pour les titres non-US, et
 * garde-fou de définition contre la référence annuelle.
 *
 * Pourquoi ce module existe : trois services servent des graphes de titres EU depuis le même
 * store (séries-ratio, P/FCF, Cash ROCE) et ont tous les trois besoin du même triptyque —
 *   1. lire une série intra-annuelle et savoir si elle est trimestrielle ou SEMESTRIELLE
 *      (~25 % des émetteurs EU ne publient pas de Q1/Q3 : Vinci, LVMH, L'Oréal, Nestlé…) ;
 *   2. la sommer sur DOUZE MOIS pour les flux, parce que H1 et H2 ne sont pas comparables
 *      (le CFO de Vinci est ~4× plus élevé au S2) et que la carte, elle, affiche un 12 mois ;
 *   3. VÉRIFIER que la série ainsi recomposée dit la même chose que la référence annuelle
 *      avant de l'adopter.
 *
 * Le point 3 n'est pas une précaution théorique : « résultat opérationnel » ne désigne pas la
 * même ligne d'une source à l'autre, et sans ce contrôle le graphe de Nestlé affichait 13,66 %
 * quand sa propre carte disait 15,55 %. On préfère une série courte à une série qui contredit
 * la carte — même arbitrage que calibrateAdsShares face à une convention ADS indécidable.
 */
import type { TimeseriesPoint } from '@lubin/shared';
import { readSeries } from './fundamentalsStore.js';
import { detectCadence } from './stockanalysisFundamentals.js';
import { maxTtmGapMs } from './finnhubFundamentals.js';

/** Cadences intra-annuelles servies. L'annuel n'en fait pas partie : c'est l'autre chemin. */
export type IntraCadence = 'quarterly' | 'semiannual';

/** Nombre de périodes qui composent douze mois, par cadence. */
export const PERIODS_PER_YEAR: Record<IntraCadence, number> = { quarterly: 4, semiannual: 2 };

/**
 * Écart relatif MAXIMAL toléré entre une série recomposée depuis le store et la référence
 * annuelle, sur les exercices communs.
 *
 * Mesuré en prod sur la marge opérationnelle du dernier exercice : L'Oréal 0,0 %, Air Liquide
 * 0,8 %, Hermès 1,9 %, LVMH 3,2 %, Vinci 4,5 %, Nestlé 12,2 %. Le résultat net, lui, concorde
 * partout à 0,4 % près. 2 % laisse donc passer les sources qui décrivent la même ligne (bruit
 * d'arrondi et de change) et écarte celles qui en décrivent une autre.
 *
 * L'écart n'est pas un facteur constant (Nestlé : 21 %, 10 %, 6 %, 12 % selon l'exercice), donc
 * pas question de recalibrer comme on le fait pour la convention ADS des `shares` : c'est une
 * différence de DÉFINITION, pas d'unité.
 */
export const DEFINITION_TOLERANCE = 0.02;

/** Sous ce nombre de points, le front affiche « pas de données » — inutile de servir moins. */
export const MIN_INTRA_POINTS = 3;

/**
 * Multiplicateur au-delà de la médiane (en valeur absolue) à partir duquel une période est un
 * outlier de magnitude, pas une vraie volatilité trimestrielle.
 *
 * Mesuré en prod le 20/11/2026 sur le FCF trimestriel d'ASML (stockanalysis.com) : la case du
 * dernier trimestre de CHAQUE exercice (quelle que soit sa date exacte — 2026-09-27, 2025-12-31,
 * 2024-12-31, 2022-12-31…) contient en réalité le total ANNUEL complet, pas la seule contribution
 * du trimestre — marge FCF/CA mesurée à 95-113 % sur ces lignes contre 3-40 % ailleurs dans la
 * même série, impossible pour un vrai trimestre. Sans filtre, `rollingYearSum` fait entrer ce
 * point dans la fenêtre glissante de 4 trimestres et DOUBLE le FCF douze mois dès qu'il y entre —
 * exactement au moment le plus visible : le point le plus récent du graphe (P/FCF ASML.AS mesuré
 * à 21,8× au lieu de 42,2× à la même date). 4× la médiane laisse passer une vraie trimestre
 * exceptionnelle (observé jusqu'à ~3× ailleurs dans la même série) tout en écartant un total
 * annuel glissé dans une case trimestrielle (qui pèse structurellement ~4 fois un trimestre
 * moyen, logiquement).
 */
const MAGNITUDE_OUTLIER_FACTOR = 4;

/**
 * Écarte les périodes dont la magnitude est un outlier statistique vis-à-vis du reste de LA
 * MÊME série — cf. `MAGNITUDE_OUTLIER_FACTOR`. Sous 6 points la médiane n'est pas assez stable
 * pour juger, donc on ne filtre rien (mieux vaut une série courte intacte qu'un filtre aveugle).
 * Le point écarté laisse un TROU que `rollingYearSum` traite déjà comme tel (cf `maxTtmGapMs`) :
 * aucune fenêtre glissante ne l'enjambe, on perd juste les quelques trimestres autour de lui au
 * lieu d'afficher un chiffre faux.
 */
export function dropMagnitudeOutliers(points: TimeseriesPoint[], revenue?: TimeseriesPoint[]): TimeseriesPoint[] {
  if (points.length < 6) return points;
  const abs = points.map(p => Math.abs(p.value)).sort((a, b) => a - b);
  const median = abs[Math.floor(abs.length / 2)]!;
  if (median <= 0) return points;
  return points.filter(p =>
    Math.abs(p.value) <= MAGNITUDE_OUTLIER_FACTOR * median || plausibleAgainstRevenue(p, revenue));
}

/**
 * Part maximale du CA du MÊME trimestre qu'un flux peut représenter pour rester crédible malgré
 * une magnitude hors norme.
 *
 * Le seul test de magnitude confond deux situations : un total annuel glissé dans une case
 * trimestrielle (ASML : FCF à 95-113 % du CA du trimestre) et une vraie croissance explosive.
 * Mesuré sur SK Hynix (000660.KS) en 2026 : FCF trimestriel de 54,7 puis 40,8 T₩ pour une médiane
 * historique de ~4 T₩ — 10 à 14 fois la médiane, mais 69 % et 39 % du CA du trimestre, cohérent
 * avec un supercycle mémoire. Sans ce recoupement, le graphe P/FCF et la carte retombaient sur le
 * FCF de l'exercice 2025 (24,8 T₩) et affichaient ~41× pour un P/FCF réel de ~8×.
 */
const PLAUSIBLE_REVENUE_SHARE = 0.9;

/** Le point a-t-il un CA à la même date (±20 j) dont il reste une part crédible ? */
function plausibleAgainstRevenue(p: TimeseriesPoint, revenue?: TimeseriesPoint[]): boolean {
  if (!revenue?.length) return false;
  const t = Date.parse(p.date);
  const rev = revenue.find(r => Math.abs(Date.parse(r.date) - t) < 20 * 24 * 3600 * 1000);
  return rev != null && rev.value > 0 && Math.abs(p.value) <= PLAUSIBLE_REVENUE_SHARE * rev.value;
}

/**
 * Somme glissante sur DOUZE MOIS, quelle que soit la cadence : 4 trimestres, ou 2 SEMESTRES.
 *
 * Même garde-fou de contiguïté que finnhubFundamentals.rollingTtmSum (cf `maxTtmGapMs`) : un
 * écart anormal entre deux points de la fenêtre → ce n'est pas douze mois, pas de point. Sans
 * ça, une série trouée produirait des « douze mois » étalés sur vingt-quatre.
 */
export function rollingYearSum(points: TimeseriesPoint[], periods: number, revenue?: TimeseriesPoint[]): TimeseriesPoint[] {
  const s = dropMagnitudeOutliers(points, revenue).sort((a, b) => a.date.localeCompare(b.date));
  const maxGap = maxTtmGapMs(s);
  const gaps: number[] = [0];
  for (let i = 1; i < s.length; i++) gaps.push(Date.parse(s[i]!.date) - Date.parse(s[i - 1]!.date));
  const out: TimeseriesPoint[] = [];
  for (let i = periods - 1; i < s.length; i++) {
    let contiguous = true;
    let sum = 0;
    for (let k = 0; k < periods; k++) {
      if (k > 0 && gaps[i - k + 1]! > maxGap) { contiguous = false; break; }
      sum += s[i - k]!.value;
    }
    if (!contiguous) continue;
    out.push({ date: s[i]!.date, value: sum });
  }
  return out;
}

/**
 * Écart relatif MÉDIAN entre une série intra-annuelle et la série annuelle de référence, sur les
 * exercices communs. Médian et non maximal : un exercice retraité isolé ne doit pas condamner une
 * série par ailleurs cohérente. `null` = moins de deux exercices communs, donc rien à conclure.
 */
export function seriesDeviation(intra: TimeseriesPoint[], annual: TimeseriesPoint[]): number | null {
  // Dernier point intra-annuel d'une année = sa clôture d'exercice (série triée ASC), donc le
  // point directement comparable à l'exercice annuel.
  const intraByYear = new Map<string, number>();
  for (const p of [...intra].sort((a, b) => a.date.localeCompare(b.date))) {
    intraByYear.set(p.date.slice(0, 4), p.value);
  }
  const devs: number[] = [];
  for (const a of annual) {
    const i = intraByYear.get(a.date.slice(0, 4));
    if (i == null || a.value === 0) continue;
    devs.push(Math.abs(i - a.value) / Math.abs(a.value));
  }
  if (devs.length < 2) return null;
  devs.sort((x, y) => x - y);
  return devs[Math.floor(devs.length / 2)]!;
}

/**
 * La série recomposée dit-elle la même chose que la référence annuelle ?
 *
 * `null` (invérifiable, moins de deux exercices communs) est traité comme un ÉCHEC dès que la
 * référence est utilisable : on ne parie pas sur une définition qu'on n'a pas pu recouper. Si la
 * référence est trop courte pour servir, l'intra-annuel est notre seule option et on l'accepte.
 */
export function agreesWithAnnual(
  intra: TimeseriesPoint[],
  annual: TimeseriesPoint[],
  tolerance = DEFINITION_TOLERANCE,
): boolean {
  const dev = seriesDeviation(intra, annual);
  if (dev == null) return annual.length < MIN_INTRA_POINTS;
  return dev <= tolerance;
}

/**
 * Le DERNIER exercice annuel est-il recoupé par la série intra-annuelle à sa date de clôture ?
 *
 * Voie d'acceptation complémentaire d'`agreesWithAnnual` : sur deux exercices communs, l'écart
 * « médian » de celle-ci est en fait le PIRE des deux, et un exercice ancien où les sources
 * comptent le capex un peu différemment suffit à tout rejeter. SK Hynix : FCF 2025 recoupé à
 * 0,0 %, 2024 à 5,5 % (13,9 T₩ chez stockanalysis contre 13,1 chez Yahoo) → série écartée, et
 * avec elle les deux trimestres records de 2026. Quand c'est l'exercice le plus récent qui
 * concorde à la tolérance de définition, les deux sources décrivent bien la même ligne au moment
 * qui compte pour un multiple actuel.
 */
export function latestYearAgrees(
  intra: TimeseriesPoint[],
  annual: TimeseriesPoint[],
  tolerance = DEFINITION_TOLERANCE,
): boolean {
  const last = [...annual].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (!last || last.value === 0) return false;
  const t = Date.parse(last.date);
  const match = intra.find(p => Math.abs(Date.parse(p.date) - t) < 20 * 24 * 3600 * 1000);
  return match != null && Math.abs(match.value - last.value) / Math.abs(last.value) <= tolerance;
}

/** Fenêtre une série sur les `years` dernières années, triée ASC. */
function windowSeries(points: TimeseriesPoint[], years: number): TimeseriesPoint[] {
  const cutoff = Date.now() - years * 365.25 * 24 * 3600 * 1000;
  return points
    .filter(p => new Date(p.date + 'T00:00:00Z').getTime() >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Série intra-annuelle du store pour UNE métrique, fenêtrée. [] si absente, trop courte, ou
 * annuelle (une série annuelle rangée sous une clé intra-annuelle n'apporte rien : le chemin
 * annuel la sert déjà, en plus profond).
 *
 * La cadence est REDÉRIVÉE des points au lieu d'être lue dans la colonne `freq` du store : les
 * lignes écrites avant l'introduction de cette colonne valent toutes 'quarterly' par défaut, ce
 * qui ferait annoncer « Trimestre » sur les barres semestrielles d'un Vinci.
 */
export async function readIntraSeries(ticker: string, metric: string, years: number): Promise<TimeseriesPoint[]> {
  const stored = await readSeries(ticker, metric).catch(() => null);
  if (!stored?.points.length) return [];
  const pts = windowSeries(stored.points, years);
  if (pts.length < 2) return [];
  return detectCadence(pts.map(p => p.date)) === 'annual' ? [] : pts;
}

export interface IntraYearSet {
  /** Cadence commune, dérivée de la métrique pivot. */
  freq: IntraCadence;
  /** Périodes composant douze mois (4 ou 2). */
  periods: number;
  /** Série brute — pour les postes de BILAN, qui sont des snapshots de fin de période. */
  snapshot(metric: string): TimeseriesPoint[];
  /** Somme glissante douze mois — pour les FLUX (CA, résultats, FCF, CFO…). */
  flow(metric: string): TimeseriesPoint[];
}

/**
 * Charge un jeu de séries intra-annuelles à cadence COMMUNE, celle de la métrique `pivot`.
 * Renvoie null si le pivot est absent du store ou trop court : sans lui, aucune cadence à
 * appliquer aux autres, et un graphe composé de séries de cadences différentes serait faux.
 */
export async function loadIntraYearSet(
  ticker: string,
  pivot: string,
  metrics: string[],
  years: number,
): Promise<IntraYearSet | null> {
  const wanted = [...new Set([pivot, ...metrics])];
  const loaded = await Promise.all(wanted.map(async m => [m, await readIntraSeries(ticker, m, years)] as const));
  const byMetric = new Map(loaded);
  const pivotPts = byMetric.get(pivot) ?? [];
  if (pivotPts.length < MIN_INTRA_POINTS) return null;
  const cadence = detectCadence(pivotPts.map(p => p.date));
  if (cadence === 'annual') return null;
  const periods = PERIODS_PER_YEAR[cadence];
  const flowCache = new Map<string, TimeseriesPoint[]>();
  return {
    freq: cadence,
    periods,
    snapshot: (metric: string) => byMetric.get(metric) ?? [],
    flow: (metric: string) => {
      const hit = flowCache.get(metric);
      if (hit) return hit;
      // Le CA chargé dans le même jeu sert de recoupement aux magnitudes hors norme des AUTRES
      // flux (cf PLAUSIBLE_REVENUE_SHARE) ; le CA lui-même n'a pas de référence.
      const revenue = metric === 'revenue' ? undefined : byMetric.get('revenue');
      const out = rollingYearSum(byMetric.get(metric) ?? [], periods, revenue);
      flowCache.set(metric, out);
      return out;
    },
  };
}

/**
 * Flux DOUZE MOIS GLISSANTS le plus récent du store pour `metric` (FCF de la carte P/FCF des
 * titres non-US), ou null si on ne peut pas le garantir. Mêmes garde-fous que le graphe P/FCF
 * (pfcfHistory.getPfcfHistoryIntraYear), pour que la carte et la fin de la courbe disent la
 * même chose :
 *   1. aucune période brute aberrante (magnitude hors norme ET non crédible face au CA) ;
 *   2. la série recomposée recoupe l'annuel (agreesWithAnnual ou latestYearAgrees) ;
 *   3. le dernier point est frais (relève attendue : ~200 j en trimestriel, ~400 en semestriel).
 */
export async function latestStoreTtm(
  ticker: string,
  metric: string,
  annual: TimeseriesPoint[],
  nowMs: number,
): Promise<TimeseriesPoint | null> {
  const set = await loadIntraYearSet(ticker, metric, ['revenue'], 4);
  if (!set) return null;
  const raw = set.snapshot(metric);
  if (dropMagnitudeOutliers(raw, set.snapshot('revenue')).length < raw.length) return null;
  const flow = set.flow(metric);
  if (!agreesWithAnnual(flow, annual) && !latestYearAgrees(flow, annual)) return null;
  const last = flow.at(-1);
  if (!last) return null;
  const staleness = (set.freq === 'semiannual' ? 400 : 200) * 24 * 3600 * 1000;
  return nowMs - Date.parse(last.date) <= staleness ? last : null;
}
