/**
 * employeesStore — historique du nombre d'employés + CA par employé.
 *
 * Source : stockanalysis /employees/ (historique ANNUEL, dates = fins d'exercice fiscal,
 * couverture mondiale y compris micro-caps — cf. getStockanalysisEmployees). Persisté dans
 * FundamentalsSeries sous la métrique 'employees' (append-only, cadence annuelle ~400 j,
 * cache négatif 30 j pour ne pas re-sonder en boucle les titres non couverts).
 *
 * Le CA par employé croise cette série avec le CA DÉJÀ en base (aucun fetch de plus) :
 *   - 'annualTotalRevenue' (store annuel Yahoo/stockanalysis/EDGAR) rapproché par date
 *     de fin d'exercice (±45 j) ;
 *   - à défaut, la série intra-annuelle 'revenue' (Finnhub+EDGAR US, stockanalysis EU)
 *     recomposée en exercice complet à la date de l'effectif (somme des périodes contiguës).
 * Les deux grandeurs sont en devise de REPORTING, constante dans le temps → la CROISSANCE
 * du ratio est neutre en devise (contrairement au niveau, jamais comparé entre titres).
 *
 * La croissance est une régression log-linéaire sur la fenêtre 5,5 ans (même définition
 * « 5 ans » que les autres critères : cf. windowCutoff de yahooFundamentals et
 * windowYears=5 côté Finnhub).
 */
import type { TimeseriesPoint, DerivedMetrics } from '@lubin/shared';
import { readSeries, isFresh, appendMergePersist, type ExpiryCadence } from './fundamentalsStore.js';
import { getStockanalysisEmployees, getStockanalysisEmployeesUs, getStockanalysisRevenueHistory, detectCadence } from './stockanalysisFundamentals.js';
import { findUsListingByName, companyNamesMatch } from './usListingResolve.js';
import { resolveYahooTicker } from './yahooResolve.js';

const EMPLOYEES_METRIC = 'employees';
/**
 * CA annuel PROFOND (page /revenue/ de stockanalysis, jusqu'à 2005) — série séparée de
 * 'annualTotalRevenue', qui appartient au store annuel Yahoo et suit sa propre cadence.
 * Ne sert qu'à étendre l'appariement CA/employé vers le passé (cf. extendWithDeepRevenue).
 */
const DEEP_REVENUE_METRIC = 'annualRevenueDeep';
/** L'effectif tombe une fois par an (rapport annuel) : re-check ~400 j après le dernier point. */
const ANNUAL_CADENCE: ExpiryCadence = { cadenceDays: 400, floorDays: 30 };

const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;
/** Fenêtre de calcul de la croissance — mêmes 5,5 ans ≈ 5 exercices pleins que les autres critères. */
const WINDOW_YEARS = 5.5;
/** Points minimum (exercices) pour estimer une tendance. */
const MIN_POINTS = 3;
/** Étendue minimale entre premier et dernier point de la fenêtre (années). */
const MIN_SPAN_YEARS = 2;
/**
 * Effectif plancher : sous ~20 personnes, une embauche fait « croître la productivité »
 * de plusieurs points — le ratio ne mesure plus rien.
 */
const EMPLOYEE_MIN = 20;
/** Tolérance de rapprochement entre fin d'exercice de l'effectif et du CA annuel. */
const ALIGN_TOLERANCE_MS = 45 * DAY_MS;

export interface RevenuePerEmployeeResult {
  /** Croissance annualisée du CA par employé (régression log-linéaire, fenêtre 5,5 ans). */
  cagr: number | null;
  /** CA par employé du dernier exercice apparié (devise de REPORTING — jamais comparé entre titres). */
  latest: number | null;
  /** Effectif du dernier exercice connu. */
  employeesLatest: number | null;
  /** Série complète du ratio (pour le graphe), ordre chronologique ASC. */
  points: TimeseriesPoint[];
  /** Raison quand cagr est null (copy FR, cf. principe notCalculableReasons). */
  reason?: string;
}

/**
 * Marqueur : la recherche d'une cotation US (historique profond) a été menée À TERME pour ce
 * ticker suffixé — trouvée ou pas. Sans lui, chaque lecture retenterait la résolution ; avec
 * lui, les lignes déjà écrites en 5 exercices (pages exchange) sont RETRO-UPGRADÉES à la
 * première lecture suivant ce déploiement, sans attendre leur expiry (~400 j).
 */
const DEEP_SOURCE = 'stockanalysis-deep';

/**
 * Tentative d'historique PROFOND via une cotation NYSE/NASDAQ de la même société : les pages
 * /stocks/ de stockanalysis servent l'intégralité gratuitement (ASML 25 exercices) là où les
 * pages exchange plafonnent à 5. Deux candidats : le symbole domestique nu (TTE.PA → /stocks/tte)
 * et le symbole trouvé par NOM dans le référentiel SEC (NOVO-B.CO → NVO). Chaque candidat est
 * validé par le nom de société du payload — piège réel : /stocks/mc = Moelis, pas LVMH.
 *
 *  - 'found'  → points profonds vérifiés ;
 *  - 'none'   → recherche menée à terme, pas de cotation US exploitable (résultat durable) ;
 *  - 'error'  → échec TRANSITOIRE (résolution du nom) → à retenter, pas à mémoriser.
 */
async function fetchDeepViaUsListing(
  ticker: string,
): Promise<{ status: 'found'; points: TimeseriesPoint[] } | { status: 'none' } | { status: 'error' }> {
  const resolved = await resolveYahooTicker(ticker).catch(() => null);
  const expected = resolved?.longName ?? null;
  if (!expected) return { status: 'error' };
  const base = ticker.slice(0, ticker.lastIndexOf('.'));
  const candidates = [base];
  const viaSec = await findUsListingByName(expected).catch(() => null);
  if (viaSec && !candidates.some(c => c.toUpperCase() === viaSec.toUpperCase())) candidates.push(viaSec);
  let best: TimeseriesPoint[] | null = null;
  for (const candidate of candidates) {
    const r = await getStockanalysisEmployeesUs(candidate).catch(() => null);
    if (!r?.name || r.points.length === 0) continue;
    if (!companyNamesMatch(r.name, expected)) continue; // autre société sous le même code
    if (!best || r.points.length > best.length) best = r.points;
  }
  return best ? { status: 'found', points: best } : { status: 'none' };
}

/**
 * Historique d'effectif d'un ticker, lecture-traversante : store frais → zéro réseau ;
 * périmé/absent → fetch stockanalysis puis persistance append-only (série vide comprise :
 * cache négatif borné pour les titres que la source ne couvre pas).
 *
 * Tickers suffixés : la cotation US de la société est tentée d'abord (historique intégral
 * gratuit), la page exchange (5 exercices) n'est que le repli. Une ligne fraîche écrite AVANT
 * ce mécanisme (source 'stockanalysis') est re-tentée une fois malgré sa fraîcheur.
 */
export async function getEmployeesHistory(ticker: string, nowMs: number): Promise<TimeseriesPoint[]> {
  const stored = await readSeries(ticker, EMPLOYEES_METRIC);
  const isSuffixed = ticker.includes('.');
  // startsWith : le backfill rapports annuels suffixe la source ('stockanalysis-deep+annual-report')
  // sans invalider le marqueur « recherche de cotation US déjà menée à terme ».
  if (isFresh(stored, nowMs) && (!isSuffixed || stored!.source.startsWith(DEEP_SOURCE))) return stored!.points;

  const persist = (built: TimeseriesPoint[], source: string) =>
    appendMergePersist(ticker, EMPLOYEES_METRIC, stored, built, source, nowMs, {
      freq: 'annual',
      cadence: ANNUAL_CADENCE,
      persistEmpty: true,
    });

  if (!isSuffixed) {
    // Ticker US : la page /stocks/ porte déjà l'historique intégral.
    const built = await getStockanalysisEmployees(ticker).catch(() => null);
    return persist(built ?? [], 'stockanalysis');
  }

  const deep = await fetchDeepViaUsListing(ticker).catch(() => ({ status: 'error' as const }));
  if (deep.status === 'found') return persist(deep.points, DEEP_SOURCE);
  // Repli : page exchange (5 exercices gratuits). 'none' = recherche aboutie → on mémorise
  // DEEP_SOURCE pour ne pas la refaire à chaque lecture ; 'error' = transitoire → source
  // ordinaire, la prochaine lecture retentera la cotation US.
  const built = await getStockanalysisEmployees(ticker).catch(() => null);
  return persist(built ?? [], deep.status === 'none' ? DEEP_SOURCE : 'stockanalysis');
}

/**
 * CA annuel profond, lecture-traversante (mêmes conventions que getEmployeesHistory).
 * N'est sollicité par getRevenuePerEmployee que si l'effectif remonte plus loin que le CA
 * déjà en base — la plupart des tickers n'en ont donc besoin qu'une fois.
 */
export async function getDeepAnnualRevenueHistory(ticker: string, nowMs: number): Promise<TimeseriesPoint[]> {
  const stored = await readSeries(ticker, DEEP_REVENUE_METRIC);
  if (isFresh(stored, nowMs)) return stored!.points;
  const built = await getStockanalysisRevenueHistory(ticker).catch(() => null);
  return appendMergePersist(ticker, DEEP_REVENUE_METRIC, stored, built ?? [], 'stockanalysis', nowMs, {
    freq: 'annual',
    cadence: ANNUAL_CADENCE,
    persistEmpty: true,
  });
}

const byDate = (a: TimeseriesPoint, b: TimeseriesPoint) => a.date.localeCompare(b.date);

/** Valeur du point le plus proche de `t` à ±tolérance, null sinon. */
function matchNear(sorted: TimeseriesPoint[], t: number, toleranceMs: number): number | null {
  let best: { dist: number; value: number } | null = null;
  for (const p of sorted) {
    const dist = Math.abs(Date.parse(p.date) - t);
    if (dist <= toleranceMs && (best == null || dist < best.dist)) best = { dist, value: p.value };
  }
  return best?.value ?? null;
}

/**
 * Recompose le CA d'un exercice complet se terminant vers `t` à partir de la série
 * intra-annuelle (décumulée) : somme des N dernières périodes CONTIGUËS (4 trimestres ou
 * 2 semestres selon la cadence détectée sur les points eux-mêmes — la colonne `freq` du
 * store peut mentir sur les lignes anciennes, cf. detectCadence).
 */
function fiscalYearFromIntra(sorted: TimeseriesPoint[], t: number): number | null {
  if (sorted.length === 0) return null;
  const cadence = detectCadence(sorted.map(p => p.date));
  if (cadence === 'annual') return matchNear(sorted, t, ALIGN_TOLERANCE_MS);
  const periods = cadence === 'semiannual' ? 2 : 4;
  const maxGapMs = (cadence === 'semiannual' ? 250 : 135) * DAY_MS;
  // Dernière période dont la fin tombe à ±60 j de la date d'effectif.
  let end = -1;
  let bestDist = Infinity;
  for (let i = 0; i < sorted.length; i++) {
    const dist = Math.abs(Date.parse(sorted[i]!.date) - t);
    if (dist <= 60 * DAY_MS && dist < bestDist) { end = i; bestDist = dist; }
  }
  if (end < periods - 1) return null;
  let sum = 0;
  for (let i = end - periods + 1; i <= end; i++) {
    if (i > end - periods + 1) {
      const gap = Date.parse(sorted[i]!.date) - Date.parse(sorted[i - 1]!.date);
      if (gap > maxGapMs) return null; // série trouée → pas un exercice, pas de point
    }
    sum += sorted[i]!.value;
  }
  return sum;
}

/**
 * Écart médian toléré entre le CA profond et le CA de référence sur les exercices communs.
 * Au-delà, les deux séries ne parlent pas la même convention — cas réel : la page /revenue/
 * d'un ADR publie des USD convertis quand le store annuel est en devise de reporting (CNY,
 * JPY…) — et on écarte la profondeur plutôt que de tracer une marche de change (×7 sur PDD).
 * 25 % absorbe les vraies divergences bénignes (restatements, arrondis, périmètres).
 */
const DEEP_AGREEMENT_TOLERANCE = 0.25;

/**
 * Étend la série de CA de référence avec les exercices ANTÉRIEURS du CA profond, après
 * recoupement de convention sur les exercices communs (médiane des ratios par année).
 * Jamais d'écrasement : sur une année couverte par les deux, la référence gagne. Sans
 * exercice commun ET avec une référence non vide, la profondeur est refusée (invérifiable).
 * Pur → testable.
 */
export function extendWithDeepRevenue(primary: TimeseriesPoint[], deep: TimeseriesPoint[]): TimeseriesPoint[] {
  if (deep.length === 0) return primary;
  if (primary.length === 0) return [...deep].sort(byDate);
  const primaryByYear = new Map(primary.map(p => [p.date.slice(0, 4), p.value]));
  const ratios: number[] = [];
  for (const d of deep) {
    const ref = primaryByYear.get(d.date.slice(0, 4));
    if (ref != null && ref > 0 && d.value > 0) ratios.push(d.value / ref);
  }
  if (ratios.length === 0) return primary; // aucun exercice commun → convention invérifiable
  ratios.sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)]!;
  if (Math.abs(median - 1) > DEEP_AGREEMENT_TOLERANCE) return primary; // devise/convention différente
  const extension = deep.filter(d => !primaryByYear.has(d.date.slice(0, 4)));
  return [...primary, ...extension].sort(byDate);
}

/**
 * Série du CA par employé : pour chaque point d'effectif (≥ EMPLOYEE_MIN), le CA de
 * l'exercice qui se termine à la même date — annuel d'abord (étendu par le CA profond
 * après recoupement), recomposition intra-annuelle en repli. Pur → testable.
 */
export function buildRevenuePerEmployeePoints(
  employees: TimeseriesPoint[],
  annualRevenue: TimeseriesPoint[],
  intraRevenue: TimeseriesPoint[],
  deepAnnualRevenue: TimeseriesPoint[] = [],
): TimeseriesPoint[] {
  const annual = extendWithDeepRevenue([...annualRevenue].sort(byDate), deepAnnualRevenue);
  const intra = [...intraRevenue].sort(byDate);
  const out: TimeseriesPoint[] = [];
  for (const emp of [...employees].sort(byDate)) {
    if (!Number.isFinite(emp.value) || emp.value < EMPLOYEE_MIN) continue;
    const t = Date.parse(emp.date);
    const rev = matchNear(annual, t, ALIGN_TOLERANCE_MS) ?? fiscalYearFromIntra(intra, t);
    if (rev == null || rev <= 0) continue;
    out.push({ date: emp.date, value: rev / emp.value });
  }
  return out;
}

/**
 * Croissance annualisée du ratio par régression log-linéaire sur la fenêtre 5,5 ans.
 * Garde-fous : ≥ 3 exercices étalés sur ≥ 2 ans ; |croissance| > 100 %/an = dégénéré
 * (variation d'effectif structurelle — fusion, cession — pas une tendance de productivité).
 */
export function computeRevenuePerEmployeeGrowth(
  points: TimeseriesPoint[],
  nowMs: number,
): { value: number | null; reason?: string } {
  const cutoff = nowMs - WINDOW_YEARS * YEAR_MS;
  const pts = points
    .filter(p => p.value > 0 && Date.parse(p.date) >= cutoff)
    .sort(byDate);
  if (pts.length < MIN_POINTS) {
    return { value: null, reason: 'Historique d\'effectifs insuffisant pour estimer la tendance sur 5 ans' };
  }
  const t0 = Date.parse(pts[0]!.date);
  const spanYears = (Date.parse(pts[pts.length - 1]!.date) - t0) / YEAR_MS;
  if (spanYears < MIN_SPAN_YEARS) {
    return { value: null, reason: 'Historique d\'effectifs insuffisant pour estimer la tendance sur 5 ans' };
  }
  const xs = pts.map(p => (Date.parse(p.date) - t0) / YEAR_MS);
  const ys = pts.map(p => Math.log(p.value));
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i]! - mx) * (ys[i]! - my); den += (xs[i]! - mx) ** 2; }
  if (den === 0) return { value: null, reason: 'Historique d\'effectifs insuffisant pour estimer la tendance sur 5 ans' };
  const growth = Math.exp(num / den) - 1;
  if (!Number.isFinite(growth) || Math.abs(growth) > 1) {
    return { value: null, reason: 'Évolution du CA par employé dégénérée (variation d\'effectif structurelle)' };
  }
  return { value: growth };
}

/**
 * Orchestrateur : effectifs (lecture-traversante) × CA du store → ratio + croissance.
 * Ne lit le CA QUE depuis la base : au moment où il est appelé (fin de loadQuantData ou
 * graphe), les séries 'revenue'/'annualTotalRevenue' viennent d'être écrites par le chemin
 * fondamental. Jamais de throw (les erreurs deviennent une raison de non-calcul).
 */
export async function getRevenuePerEmployee(ticker: string, nowMs: number): Promise<RevenuePerEmployeeResult> {
  const employees = await getEmployeesHistory(ticker, nowMs).catch(() => [] as TimeseriesPoint[]);
  if (employees.length === 0) {
    return { cagr: null, latest: null, employeesLatest: null, points: [], reason: 'Effectif indisponible pour ce titre' };
  }
  const employeesLatest = employees[employees.length - 1]!.value;
  const [annualRev, intraRev] = await Promise.all([
    readSeries(ticker, 'annualTotalRevenue').catch(() => null),
    readSeries(ticker, 'revenue').catch(() => null),
  ]);
  // CA profond (page /revenue/, jusqu'à 2005) : sollicité SEULEMENT si l'effectif remonte
  // au moins un an plus loin que le CA déjà en base — les effectifs stockanalysis couvrent
  // souvent 20-40 exercices quand le CA ordinaire s'arrête à 5-16, et sans cette extension
  // le graphe perd tout ce passé. Le gate épargne le fetch aux tickers déjà couverts.
  const oldestEmployeeTs = Date.parse(employees[0]!.date);
  const oldestRevTs = Math.min(
    annualRev?.points?.[0] ? Date.parse(annualRev.points[0].date) : Infinity,
    intraRev?.points?.[0] ? Date.parse(intraRev.points[0].date) : Infinity,
  );
  const deepRev = oldestEmployeeTs < oldestRevTs - YEAR_MS
    ? await getDeepAnnualRevenueHistory(ticker, nowMs).catch(() => [] as TimeseriesPoint[])
    : [];
  const points = buildRevenuePerEmployeePoints(employees, annualRev?.points ?? [], intraRev?.points ?? [], deepRev);
  if (points.length === 0) {
    return {
      cagr: null, latest: null, employeesLatest, points: [],
      reason: 'Chiffre d\'affaires indisponible sur les exercices couverts par l\'effectif',
    };
  }
  const growth = computeRevenuePerEmployeeGrowth(points, nowMs);
  return {
    cagr: growth.value,
    latest: points[points.length - 1]!.value,
    employeesLatest,
    points,
    reason: growth.reason,
  };
}

/**
 * Applique le résultat sur les métriques dérivées (post-traitement commun aux chemins
 * Finnhub et Yahoo — évite de faire transiter la donnée par computeDerivedMetrics et
 * getYahooFundamentals). Un résultat absent laisse le critère en repli fcfMargin.
 */
export function applyRevenuePerEmployee(metrics: DerivedMetrics, r: RevenuePerEmployeeResult | null): void {
  metrics.revenuePerEmployeeCagr = r?.cagr ?? null;
  metrics.revenuePerEmployee = r?.latest ?? null;
  metrics.employees = r?.employeesLatest ?? null;
  if (r?.cagr == null) {
    metrics.notCalculableReasons = {
      ...(metrics.notCalculableReasons ?? {}),
      revenuePerEmployeeCagr: r?.reason ?? 'Historique d\'effectifs indisponible',
    };
  }
}
