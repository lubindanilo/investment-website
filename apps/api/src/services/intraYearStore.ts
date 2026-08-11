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
 * Somme glissante sur DOUZE MOIS, quelle que soit la cadence : 4 trimestres, ou 2 SEMESTRES.
 *
 * Même garde-fou de contiguïté que finnhubFundamentals.rollingTtmSum (cf `maxTtmGapMs`) : un
 * écart anormal entre deux points de la fenêtre → ce n'est pas douze mois, pas de point. Sans
 * ça, une série trouée produirait des « douze mois » étalés sur vingt-quatre.
 */
export function rollingYearSum(points: TimeseriesPoint[], periods: number): TimeseriesPoint[] {
  const s = [...points].sort((a, b) => a.date.localeCompare(b.date));
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
      const out = rollingYearSum(byMetric.get(metric) ?? [], periods);
      flowCache.set(metric, out);
      return out;
    },
  };
}
