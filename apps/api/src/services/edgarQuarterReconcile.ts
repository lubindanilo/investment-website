/**
 * Recoupement des trimestres d'une série de FLUX (CA, résultat net, CFO, coût des ventes)
 * contre la SEC (EDGAR).
 *
 * POURQUOI
 * Audit du 20/11/2026 sur les 550 plus grosses capitalisations US : la somme des 4 trimestres
 * stockés recoupe le montant annuel du 10-K à ±3 % sur 98 % des exercices — la saisonnalité
 * visible sur les graphes (Intuit et la saison des impôts, la distribution au T4…) est réelle.
 * Une minorité de trimestres est FAUSSE, avec deux signatures :
 *   - un T4 dérivé « annuel Finnhub − cumul T3 » trop haut (CRM T4 FY26 13,62 Md$ au lieu de
 *     11,20 ; CRWD T4 FY24 1,45 au lieu de 0,85 ; FCX T4 2024 8,51 au lieu de 5,88) ;
 *   - un T2 resté en cumul semestriel (BX 06/2024 6,48 au lieu de 2,80 ; BIIB 06/2022 5,12
 *     au lieu de 2,59).
 * Le store étant append-only, ces valeurs ne repartaient jamais d'elles-mêmes.
 *
 * RÈGLE — trois signaux indépendants doivent concorder
 * Le trimestre EDGAR seul ne suffit PAS : son dé-cumul mélange parfois plusieurs tags XBRL dans
 * une même chaîne et sort des aberrations (A : CA trimestriel négatif ; AAP : 0,47 Md$ au lieu
 * de 2,47). Un point stocké P n'est remplacé par la valeur EDGAR E que si :
 *   1. P et E divergent (> MISMATCH_TOL et > MIN_ABS_DIFF) ;
 *   2. P appartient à un exercice dont le 10-K donne un total annuel T, avec exactement 4
 *      trimestres stockés dans cet exercice, et T − (3 autres trimestres stockés) ≈ E :
 *      la valeur EDGAR est exactement celle qui boucle l'exercice ;
 *   3. la somme stockée actuelle, elle, ne boucle PAS l'exercice (sinon rien à corriger) ;
 *   4. les autres trimestres stockés de l'exercice qui ont un équivalent EDGAR le recoupent
 *      (même agrégat chez les deux sources — écarte les banques et les changements de tag) ;
 *   5. pour une grandeur qui ne peut pas être négative (CA), la valeur retenue est ≥ 0.
 * Un second niveau couvre le cas où le trimestre EDGAR est lui-même décalé (voir dans le corps).
 *
 * Bilan de la réparation du 21/11/2026 : la condition 5 manquait et 6 CA sur 308 corrections
 * étaient passés en négatif (GEN 2014 : 1,05 Md$ → −0,87 ; CUZ 2014-2015) — une variante
 * annuelle du 10-K bouclait l'exercice par hasard. Le coût des ventes a été retiré du
 * périmètre : ses tags XBRL varient trop d'un déposant à l'autre (20 corrections négatives
 * sur 220).
 */
import type { TimeseriesPoint } from '@lubin/shared';

const DAY_MS = 86_400_000;
/** Même tolérance de date que la fusion du store (fundamentalsStore.PROXIMITY_MS). */
const MATCH_MS = 20 * DAY_MS;
/** Fenêtre d'un exercice : 4 trimestres finissant entre (fin − 350 j) et (fin + 20 j). */
const FY_SPAN_MS = 350 * DAY_MS;
export const MISMATCH_TOL = 0.02;
/** Écart toléré entre le trimestre déduit du 10-K et le trimestre EDGAR (second niveau). */
const DERIVED_TOL = 0.08;
const MIN_ABS_DIFF = 1_000_000;

export interface QuarterCorrection {
  date: string;
  from: number;
  to: number;
  fiscalYearEnd: string;
  /** 'edgar' : valeur EDGAR qui boucle l'exercice ; 'annual' : déduite du 10-K (second niveau). */
  kind: 'edgar' | 'annual';
}

function nearest(points: TimeseriesPoint[], ts: number): TimeseriesPoint | null {
  let best: TimeseriesPoint | null = null;
  let bestGap = Infinity;
  for (const p of points) {
    const gap = Math.abs(Date.parse(p.date) - ts);
    if (gap <= MATCH_MS && gap < bestGap) { best = p; bestGap = gap; }
  }
  return best;
}

function differs(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  return diff > MIN_ABS_DIFF && diff > MISMATCH_TOL * Math.max(Math.abs(a), Math.abs(b));
}

/**
 * @param points  série stockée (trimestres, ASC)
 * @param edgarQ  trimestres EDGAR (getEdgarQuarterlySeries)
 * @param annual  totaux annuels 10-K par fin d'exercice, toutes variantes de tag
 *                (getEdgarAnnualFlowCandidates)
 * Fonction pure : renvoie la série corrigée (mêmes dates) et la liste des corrections ; renvoie
 * la MÊME référence `points` quand rien n'est corrigé.
 */
export function reconcileWithEdgar(
  points: TimeseriesPoint[],
  edgarQ: TimeseriesPoint[],
  annual: Map<string, number[]>,
  opts: { nonNegative?: boolean } = {},
): { points: TimeseriesPoint[]; corrections: QuarterCorrection[] } {
  if (points.length === 0 || edgarQ.length === 0 || annual.size === 0) return { points, corrections: [] };
  const ts = points.map(p => Date.parse(p.date));
  const fixedValue = new Map<number, number>();
  const corrections: QuarterCorrection[] = [];

  for (const [fyEnd, totals] of annual) {
    const end = Date.parse(fyEnd);
    const idx = ts.map((t, i) => (t > end - FY_SPAN_MS && t <= end + MATCH_MS ? i : -1)).filter(i => i >= 0);
    if (idx.length !== 4) continue;
    const storedSum = idx.reduce((s, i) => s + points[i]!.value, 0);
    // 3. l'exercice boucle déjà avec l'une des variantes annuelles → rien à corriger
    if (totals.some(t => !differs(storedSum, t))) continue;

    const candidates: { i: number; e: number }[] = [];
    for (const i of idx) {
      const e = nearest(edgarQ, ts[i]!);
      if (!e || !differs(points[i]!.value, e.value)) continue;          // 1.
      if (opts.nonNegative && e.value < 0) continue;                    // 5.
      const others = idx.filter(j => j !== i);
      const othersSum = others.reduce((s, j) => s + points[j]!.value, 0);
      if (!totals.some(t => !differs(t - othersSum, e.value))) continue;  // 2.
      const othersAgree = others.every(j => {                            // 4.
        const ej = nearest(edgarQ, ts[j]!);
        return !ej || !differs(points[j]!.value, ej.value);
      });
      if (othersAgree) candidates.push({ i, e: e.value });
    }
    // Une seule correction par exercice : deux candidats ne peuvent pas boucler ensemble.
    if (candidates.length === 1) {
      const { i, e } = candidates[0]!;
      fixedValue.set(i, e);
      corrections.push({ date: points[i]!.date, from: points[i]!.value, to: e, fiscalYearEnd: fyEnd, kind: 'edgar' });
      continue;
    }
    if (candidates.length > 1) continue;

    // ── Second niveau : trimestre déduit du 10-K (cas FCX T4 2024) ──────────────
    // Le trimestre EDGAR est lui-même légèrement décalé (FCX : 5,88 Md$, alors que le 10-K moins
    // les trois autres trimestres donne 5,725 — le vrai chiffre publié) : il ne boucle pas
    // l'exercice, le premier niveau refuse. On retient alors T − (3 autres), à condition que :
    //   - les 3 autres trimestres aient TOUS un équivalent EDGAR qui les recoupe (pas seulement
    //     « ceux qui en ont un ») : même agrégat chez les deux sources, sans exception ;
    //   - un seul trimestre de l'exercice diverge d'EDGAR ;
    //   - la valeur déduite reste proche d'EDGAR (≤ DERIVED_TOL) et bien plus proche que la
    //     valeur stockée (écart divisé par 3 au moins) : on corrige une erreur grossière, on ne
    //     départage pas deux chiffres voisins ;
    //   - le garde-fou de signe tient.
    const edgarOf = idx.map(i => nearest(edgarQ, ts[i]!));
    if (edgarOf.some(e => !e)) continue;
    const off = idx.filter((i, k) => differs(points[i]!.value, edgarOf[k]!.value));
    if (off.length !== 1) continue;
    const i = off[0]!;
    const e = edgarOf[idx.indexOf(i)]!.value;
    const othersSum = idx.filter(j => j !== i).reduce((s, j) => s + points[j]!.value, 0);
    const derived = totals
      .map(t => t - othersSum)
      .reduce((best, c) => (Math.abs(c - e) < Math.abs(best - e) ? c : best));
    const gap = Math.abs(derived - e);
    if (gap > DERIVED_TOL * Math.max(Math.abs(derived), Math.abs(e))) continue;
    if (gap * 3 > Math.abs(points[i]!.value - e)) continue;
    if (opts.nonNegative && derived < 0) continue;
    fixedValue.set(i, derived);
    corrections.push({ date: points[i]!.date, from: points[i]!.value, to: derived, fiscalYearEnd: fyEnd, kind: 'annual' });
  }

  if (corrections.length === 0) return { points, corrections };
  return {
    points: points.map((p, i) => (fixedValue.has(i) ? { date: p.date, value: fixedValue.get(i)! } : p)),
    corrections: corrections.sort((a, b) => a.date.localeCompare(b.date)),
  };
}
