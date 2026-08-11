/**
 * Séries-RATIO dérivées pour les histogrammes (marges, conversion, dette/FCF).
 *
 * Problème résolu : /api/timeseries ne sait servir qu'une grandeur ABSOLUE (revenue, fcf…).
 * Les cartes qui sont des ratios (marge nette, marge FCF, levier op, dette/FCF, conversion
 * cash) ouvraient donc un graphe du NUMÉRATEUR brut, pas du ratio. Ce service calcule le
 * vrai ratio dans le temps.
 *
 * Méthode = TTM glissant (cohérent avec cashRoceHistory / pfcfHistory et avec la valeur de
 * la carte → le dernier point du graphe ≈ la valeur affichée) :
 *   marge(t)        = numérateur_TTM(t) / dénominateur_TTM(t)         (en %)
 *   netDebtFcf(t)   = (dette(t) − cash(t)) [snapshot] / FCF_adj_TTM(t) (en ×)
 *
 * Garde-fou commun aux ratios en × (dette/FCF, conversion cash) et à tous les tickers : un
 * point n'est tracé que si son dénominateur est MATÉRIEL (≥ 0,1 % du CA de la période).
 * Cf. dropImmaterialDenominator.
 *
 * Sources, comme les autres graphes-ratio :
 *   - US (Finnhub quarterly) : TTM glissant sur ~20 trimestres
 *   - EU + ADRs étrangers 20-F (store annuel Yahoo + EDGAR natif + stockanalysis) : ratio par
 *     exercice (~5 ans pour l'EU, 14-18 exercices pour les ADR 20-F)
 *
 * Le FCF utilisé côté US est le FCF ajusté SBC (getAdjustedFcfTtmSeries) — identique à la
 * carte. Côté annuel Yahoo c'est le FCF brut (comme pfcfHistory/cashRoceHistory).
 */
import type { RatioMetricKey, TimeseriesFreq, TimeseriesPoint } from '@lubin/shared';
import { getReportedTimeseries, getAdjustedFcfTtmSeries, maxTtmGapMs } from './finnhubFundamentals.js';
import { getYahooAnnualBatchCached } from './yahooAnnualStore.js';
import { readSeries } from './fundamentalsStore.js';
import { detectCadence } from './stockanalysisFundamentals.js';
import { resolveYahooTicker } from './yahooResolve.js';

/** Unité d'affichage de chaque ratio (alignée sur CriterionHistogram.unit côté shared). */
const RATIO_UNIT: Record<RatioMetricKey, 'percent' | 'multiple'> = {
  netMargin: 'percent',
  fcfMargin: 'percent',
  operatingMargin: 'percent',
  cashConversion: 'multiple', // ratio FCF/RN (ex 1.05×) — même unité que la carte (fmtRaw)
  netDebtFcf: 'multiple',
};

/**
 * Clés des métriques-ratio — source de vérité runtime CÔTÉ API.
 * Dérivé de RATIO_UNIT (pas d'import de VALEUR depuis @lubin/shared : son package résout
 * vers src/index.ts, non chargeable par Node en prod → crash lambda). Le type RatioMetricKey,
 * lui, reste défini dans shared et n'est importé qu'en `import type` (effacé au build).
 */
export const RATIO_METRIC_KEYS = Object.keys(RATIO_UNIT) as RatioMetricKey[];

/** Facteur d'échelle : 100 pour exprimer une marge en points de %, 1 pour un multiple ×. */
function scaleFor(ratio: RatioMetricKey): number {
  return RATIO_UNIT[ratio] === 'percent' ? 100 : 1;
}

export interface RatioTimeseriesResult {
  points: TimeseriesPoint[];
  unit: 'percent' | 'multiple';
  /**
   * Granularité réellement produite : 'quarterly' (TTM glissant US, ou EU trimestriel du store),
   * 'semiannual' (émetteurs EU sans Q1/Q3, 12 mois glissants sur 2 semestres) ou 'annual'.
   */
  freq: TimeseriesFreq;
  /** Origine de la série : store intra-annuel, Yahoo annuel, ou Finnhub trimestriel. */
  source: 'store' | 'yahoo' | 'finnhub';
  /**
   * true quand ce titre n'a QUE de l'annuel pour ce ratio — donc plus systématiquement vrai pour
   * l'EU depuis que le chemin intra-annuel existe : il ne reste allumé que si le store n'a pas
   * les composantes intra-annuelles du ratio (typiquement dette/FCF, dont la dette n'a pas de
   * série intra-annuelle chez la plupart des émetteurs EU).
   *
   * Purement informatif : l'UI garde le sélecteur de période pour tout le monde et se contente
   * de signaler la granularité servie. Le masquer revenait à présenter un trou de données comme
   * une caractéristique du titre — c'est la profondeur qu'il faut corriger, pas l'affichage.
   */
  annualOnly: boolean;
}

/**
 * Nombre de points sous lequel un graphe n'est pas lisible. Aligné sur la gate de sparsité
 * du front (HistogramModal : `data.length < 3` affiche « pas de données trimestrielles »).
 *
 * Sert de critère de SUFFISANCE pour décider du repli annuel. L'ancien test `us.length === 0`
 * laissait passer les cas 1-2 points : chez TCOM, la fenêtre 10Y/20Y/All produisait 2 points
 * depuis une série trouée, donc « non vide », donc AUCUN repli, donc un graphe vide côté
 * client — alors que la fenêtre 5Y, elle, tombait à 0 point et basculait proprement sur les
 * 4 barres annuelles Yahoo. D'où le « 5Y marche, 10Y dit no data » incohérent.
 */
const MIN_CHART_POINTS = 3;

// ─── Helpers de combinaison de séries ────────────────────────────────────────

/**
 * Somme glissante TTM (4 trimestres) sur une série quarterly triée.
 *
 * Même garde-fou de contiguïté que finnhubFundamentals.rollingTtmSum (cf `maxTtmGapMs`) :
 * un écart anormal entre deux points CONSÉCUTIFS de la fenêtre → pas un TTM, pas de point.
 * Sans ça, une série trouée (déposants 20-F dont la source ne couvre que quelques exercices
 * épars) produisait des « TTM » étalés sur plusieurs années.
 */
function rollingTtmSum(points: TimeseriesPoint[]): TimeseriesPoint[] {
  return rollingYearSum(points, 4);
}

/**
 * Somme glissante sur DOUZE MOIS, quelle que soit la cadence de publication : 4 trimestres,
 * ou 2 SEMESTRES pour les émetteurs qui ne publient pas de Q1/Q3 (Vinci, LVMH, Nestlé…).
 *
 * Sommer 12 mois plutôt que rapporter la période brute n'est pas cosmétique : chez un émetteur
 * semestriel, H1 et H2 ne sont pas comparables (le CFO de Vinci est ~4× plus élevé au S2), donc
 * une marge par semestre dessinerait une dent de scie saisonnière et le dernier point ne
 * correspondrait pas à la valeur de la carte, qui est un 12 mois. Exporté pour tests.
 */
export function rollingYearSum(points: TimeseriesPoint[], periods: number): TimeseriesPoint[] {
  const s = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const maxGap = maxTtmGapMs(s);
  const gaps: number[] = [0];
  for (let i = 1; i < s.length; i++) gaps.push(Date.parse(s[i]!.date) - Date.parse(s[i - 1]!.date));
  const out: TimeseriesPoint[] = [];
  for (let i = periods - 1; i < s.length; i++) {
    // Un écart anormal DANS la fenêtre → ce n'est pas un 12 mois, on n'émet pas de point.
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

/** num(t) / den(t) joint par date exacte. scale=100 pour les %, 1 pour les multiples. */
function divideByDate(num: TimeseriesPoint[], den: TimeseriesPoint[], scale: number): TimeseriesPoint[] {
  const denByDate = new Map(den.map(p => [p.date, p.value]));
  const out: TimeseriesPoint[] = [];
  for (const n of num) {
    const d = denByDate.get(n.date);
    if (d == null || d <= 0) continue; // dénominateur ≤ 0 → ratio non pertinent (skip)
    const r = n.value / d;
    if (!Number.isFinite(r)) continue;
    out.push({ date: n.date, value: r * scale });
  }
  return out;
}

/**
 * Seuil de MATÉRIALITÉ du dénominateur des ratios en × : dette/FCF (den = FCF ajusté TTM)
 * et conversion cash (den = résultat net TTM).
 *
 * Un dénominateur qui frôle 0 fait exploser le multiple et produit du bruit affiché comme
 * une donnée. Cas constatés en prod :
 *   - AMZN Q1-2025 : FCF ajusté TTM de 0,07 Md$ (CFO 114 − CapEx 93 − SBC 21) pour une dette
 *     nette de −41 Md$ → point à −580×, seul et hors échelle, qui écrasait les deux autres
 *     points de la série
 *   - LUV Q3-2021 : résultat net TTM à 0,008 % du CA → conversion cash à +1064×
 *   - INTC Q4-2025 : résultat net TTM à 0,049 % du CA → conversion cash à −283×
 * Ce ne sont pas « une dette énorme » ni « une conversion parfaite », ce sont des ratios non
 * définis : le dénominateur n'est que le résidu d'arrondi entre des agrégats géants.
 *
 * Calibrage du seuil (mesuré sur les séries de prod d'une vingtaine de tickers, dont les
 * profils à marge fine : WMT, KR, TGT, CVS, DAL, AAL, LUV, F, GM, INTC, BA) :
 *   - les cas aberrants sont à 0,008-0,05 % du CA
 *   - les périodes à dénominateur faible mais RÉEL (mauvaise année de cash ou de profit :
 *     WMT 18×, NKE 14×, CVS 13×, KR 2×) vivent à 0,11 % du CA et au-delà
 * → 0,1 % laisse un facteur 10 de marge sous le bruit et reste sous le plus serré des points
 * légitimes. Un seuil à 1 % aurait supprimé 4 trimestres sensés chez WMT.
 * Mieux vaut un trou qu'un chiffre faux, mais pas au prix d'un signal vrai.
 */
export const MIN_DENOMINATOR_PCT_OF_REVENUE = 0.001;

/**
 * Écarte du dénominateur les périodes où il est immatériel face au CA (cf seuil ci-dessus).
 *
 * `keyOf` permet de servir les deux granularités du service : date exacte côté US
 * trimestriel, année côté Yahoo annuel (les exercices Yahoo ne tombent pas au même jour
 * d'une série à l'autre). Pur → testable.
 */
export function dropImmaterialDenominator(
  den: TimeseriesPoint[],
  revenue: TimeseriesPoint[],
  keyOf: (date: string) => string,
): TimeseriesPoint[] {
  const revByKey = new Map(revenue.map(p => [keyOf(p.date), p.value]));
  return den.filter(p => {
    const rev = revByKey.get(keyOf(p.date));
    // Pas de CA de référence → on ne juge pas (garde-fou conservateur, aligné sur
    // computeExcessCash : on ne coupe pas un point sur la base d'une hypothèse vide).
    if (rev == null || rev <= 0) return true;
    return Math.abs(p.value) >= rev * MIN_DENOMINATOR_PCT_OF_REVENUE;
  });
}

/** a(t) − b(t) joint par date exacte (pour netDebt = dette − cash). */
function subtractByDate(a: TimeseriesPoint[], b: TimeseriesPoint[]): TimeseriesPoint[] {
  const bByDate = new Map(b.map(p => [p.date, p.value]));
  const out: TimeseriesPoint[] = [];
  for (const p of a) {
    const other = bByDate.get(p.date);
    if (other == null) continue;
    out.push({ date: p.date, value: p.value - other });
  }
  return out;
}

/** Filtre une série sur la fenêtre demandée. */
function filterWindow(points: TimeseriesPoint[], years: number): TimeseriesPoint[] {
  const cutoff = Date.now() - years * 365.25 * 24 * 3600 * 1000;
  return points
    .filter(p => new Date(p.date + 'T00:00:00Z').getTime() >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Path US : Finnhub quarterly + TTM glissant ──────────────────────────────

async function ttmOf(ticker: string, metric: 'revenue' | 'netIncome' | 'operatingIncome', windowYears: number): Promise<TimeseriesPoint[]> {
  return rollingTtmSum(await getReportedTimeseries(ticker, metric, 'quarterly', windowYears));
}

async function fcfAdjTtm(ticker: string, years: number): Promise<TimeseriesPoint[]> {
  return (await getAdjustedFcfTtmSeries(ticker, years)).map(p => ({ date: p.date, value: p.value }));
}

async function computeUsRatio(ticker: string, ratio: RatioMetricKey, years: number): Promise<TimeseriesPoint[]> {
  const W = years + 1; // +1 an pour amorcer le premier TTM
  const scale = scaleFor(ratio);
  let raw: TimeseriesPoint[];
  switch (ratio) {
    case 'fcfMargin': {
      const [fcf, rev] = await Promise.all([fcfAdjTtm(ticker, years), ttmOf(ticker, 'revenue', W)]);
      raw = divideByDate(fcf, rev, scale);
      break;
    }
    case 'netMargin': {
      const [ni, rev] = await Promise.all([ttmOf(ticker, 'netIncome', W), ttmOf(ticker, 'revenue', W)]);
      raw = divideByDate(ni, rev, scale);
      break;
    }
    case 'operatingMargin': {
      const [op, rev] = await Promise.all([ttmOf(ticker, 'operatingIncome', W), ttmOf(ticker, 'revenue', W)]);
      raw = divideByDate(op, rev, scale);
      break;
    }
    case 'cashConversion': {
      // FCF_adj_TTM / Net Income_TTM (×). Skip les trimestres à NI ≤ 0 (ratio non pertinent)
      // ou à NI immatériel vs CA (bénéfice qui frôle 0 → conversion absurde).
      const [fcf, ni, rev] = await Promise.all([
        fcfAdjTtm(ticker, years),
        ttmOf(ticker, 'netIncome', W),
        ttmOf(ticker, 'revenue', W),
      ]);
      raw = divideByDate(fcf, dropImmaterialDenominator(ni, rev, d => d), scale);
      break;
    }
    case 'netDebtFcf': {
      // (dette − cash) snapshot / FCF_adj_TTM (×). Skip si FCF ≤ 0 ou immatériel vs CA.
      const [fcf, rev, debt, cash] = await Promise.all([
        fcfAdjTtm(ticker, years),
        ttmOf(ticker, 'revenue', W),
        getReportedTimeseries(ticker, 'totalDebt', 'quarterly', W),
        getReportedTimeseries(ticker, 'cashAndEquivalents', 'quarterly', W),
      ]);
      const netDebt = subtractByDate(debt, cash);
      raw = divideByDate(netDebt, dropImmaterialDenominator(fcf, rev, d => d), scale);
      break;
    }
  }
  return filterWindow(raw, years);
}

// ─── Path EU/ADR : annuel via le STORE (Yahoo + profondeur EDGAR native) ─────
//
// Avant, ce chemin fetchait Yahoo en DIRECT à chaque cache-miss, en contournant le store
// canonique : les mêmes exercices étaient re-téléchargés par la carte et par chaque graphe,
// et surtout la profondeur EDGAR (14-18 exercices pour les ADR 20-F, contre ~4 chez Yahoo)
// n'atteignait jamais les graphes. getYahooAnnualBatchCached persiste et enrichit tout seul.

/** num(année) / den(année) indexé par année, scale=100 pour %, 1 pour ×. */
function divideByYear(num: TimeseriesPoint[], den: TimeseriesPoint[], scale: number): TimeseriesPoint[] {
  const denByYear = new Map(den.map(p => [p.date.slice(0, 4), p.value]));
  const out: TimeseriesPoint[] = [];
  for (const n of num) {
    const d = denByYear.get(n.date.slice(0, 4));
    if (d == null || d <= 0) continue;
    const r = n.value / d;
    if (!Number.isFinite(r)) continue;
    out.push({ date: n.date, value: r * scale });
  }
  return out;
}

function subtractByYear(a: TimeseriesPoint[], b: TimeseriesPoint[]): TimeseriesPoint[] {
  const bByYear = new Map(b.map(p => [p.date.slice(0, 4), p.value]));
  const out: TimeseriesPoint[] = [];
  for (const p of a) {
    const other = bByYear.get(p.date.slice(0, 4));
    if (other == null) continue;
    out.push({ date: p.date, value: p.value - other });
  }
  return out;
}

async function computeAnnualRatio(ticker: string, symbol: string, ratio: RatioMetricKey, years: number): Promise<TimeseriesPoint[]> {
  const scale = scaleFor(ratio);
  // UN batch par ratio (les types manquants reviennent []), lu à travers le store persistant.
  const TYPES: Record<RatioMetricKey, string[]> = {
    netMargin:       ['annualNetIncome', 'annualTotalRevenue'],
    operatingMargin: ['annualOperatingIncome', 'annualTotalRevenue'],
    fcfMargin:       ['annualFreeCashFlow', 'annualTotalRevenue'],
    cashConversion:  ['annualFreeCashFlow', 'annualNetIncome', 'annualTotalRevenue'],
    netDebtFcf:      ['annualFreeCashFlow', 'annualTotalRevenue', 'annualTotalDebt', 'annualCashAndCashEquivalents'],
  };
  const batch = await getYahooAnnualBatchCached(ticker, symbol, TYPES[ratio], Date.now());
  const get = (type: string) => batch?.get(type) ?? [];

  let raw: TimeseriesPoint[] = [];
  if (ratio === 'fcfMargin' || ratio === 'netMargin' || ratio === 'operatingMargin') {
    const numType = ratio === 'fcfMargin' ? 'annualFreeCashFlow' : ratio === 'netMargin' ? 'annualNetIncome' : 'annualOperatingIncome';
    raw = divideByYear(get(numType), get('annualTotalRevenue'), scale);
  } else if (ratio === 'cashConversion') {
    raw = divideByYear(get('annualFreeCashFlow'), dropImmaterialDenominator(get('annualNetIncome'), get('annualTotalRevenue'), d => d.slice(0, 4)), scale);
  } else { // netDebtFcf
    const netDebt = subtractByYear(get('annualTotalDebt'), get('annualCashAndCashEquivalents'));
    // Même garde-fou qu'en trimestriel US, indexé par exercice.
    raw = divideByYear(netDebt, dropImmaterialDenominator(get('annualFreeCashFlow'), get('annualTotalRevenue'), d => d.slice(0, 4)), scale);
  }
  // Plancher à 5 ans : Yahoo seul plafonne à ~4 exercices, donc une fenêtre de 1 an ne
  // rendrait qu'un point. Avec la profondeur EDGAR des ADR, 10Y/20Y/All fenêtrent maintenant
  // un historique qui existe vraiment.
  return filterWindow(raw, Math.max(years, 5));
}

// ─── Path EU intra-annuel : ratios 12 mois glissants depuis le STORE ─────────
//
// Le chemin EU ne connaissait que l'annuel Yahoo, soit ~4 exercices : marge nette, marge FCF,
// marge opérationnelle, conversion cash et dette/FCF d'un titre européen commençaient toutes en
// 2022, alors que le store porte jusqu'à 10 ans de périodes intra-annuelles pour les grandeurs
// qui les composent (Vinci : CA et résultats semestriels depuis 2016).
//
// Le FCF utilisé est le FCF BRUT du store, pas le FCF ajusté SBC du chemin US : c'est ce que
// fait déjà le chemin annuel EU, et donc ce que montre la carte. Mieux vaut un graphe cohérent
// avec la carte qu'un graphe « plus juste » qui ne recoupe rien.

/** Série intra-annuelle du store, fenêtrée. [] si absente, trop courte, ou annuelle. */
async function readIntraSeries(ticker: string, metric: string, years: number): Promise<TimeseriesPoint[]> {
  const stored = await readSeries(ticker, metric).catch(() => null);
  if (!stored?.points.length) return [];
  const pts = filterWindow(stored.points, years);
  if (pts.length < 2) return [];
  // Cadence redérivée des points : la colonne `freq` vaut 'quarterly' par défaut sur les lignes
  // écrites avant son introduction, y compris pour des séries semestrielles.
  return detectCadence(pts.map(p => p.date)) === 'annual' ? [] : pts;
}

/** Le poste de trésorerie porte deux clés selon la source qui a alimenté le store. */
async function readIntraCash(ticker: string, years: number): Promise<TimeseriesPoint[]> {
  const sa = await readIntraSeries(ticker, 'cash', years);
  return sa.length ? sa : readIntraSeries(ticker, 'cashAndEquivalents', years);
}

async function computeEuIntraYearRatio(
  ticker: string,
  ratio: RatioMetricKey,
  years: number,
): Promise<{ points: TimeseriesPoint[]; freq: 'quarterly' | 'semiannual' } | null> {
  const W = years + 1; // +1 an pour amorcer le premier 12 mois glissant
  const scale = scaleFor(ratio);
  const rev = await readIntraSeries(ticker, 'revenue', W);
  if (rev.length < MIN_CHART_POINTS) return null;
  const cadence = detectCadence(rev.map(p => p.date));
  if (cadence === 'annual') return null;
  const periods = cadence === 'semiannual' ? 2 : 4;
  const sum = (pts: TimeseriesPoint[]): TimeseriesPoint[] => rollingYearSum(pts, periods);
  const revYear = sum(rev);

  let raw: TimeseriesPoint[];
  switch (ratio) {
    case 'netMargin':
    case 'operatingMargin':
    case 'fcfMargin': {
      const numKey = ratio === 'netMargin' ? 'netIncome' : ratio === 'operatingMargin' ? 'operatingIncome' : 'fcf';
      const num = await readIntraSeries(ticker, numKey, W);
      if (num.length < MIN_CHART_POINTS) return null;
      raw = divideByDate(sum(num), revYear, scale);
      break;
    }
    case 'cashConversion': {
      const [fcf, ni] = await Promise.all([
        readIntraSeries(ticker, 'fcf', W),
        readIntraSeries(ticker, 'netIncome', W),
      ]);
      if (fcf.length < MIN_CHART_POINTS || ni.length < MIN_CHART_POINTS) return null;
      raw = divideByDate(sum(fcf), dropImmaterialDenominator(sum(ni), revYear, d => d), scale);
      break;
    }
    case 'netDebtFcf': {
      // La dette et le cash sont des SNAPSHOTS de fin de période : pas de somme glissante sur
      // eux, seulement sur le FCF qui les rapporte à douze mois d'activité.
      const [fcf, debt, cash] = await Promise.all([
        readIntraSeries(ticker, 'fcf', W),
        readIntraSeries(ticker, 'totalDebt', W),
        readIntraCash(ticker, W),
      ]);
      if (fcf.length < MIN_CHART_POINTS || !debt.length || !cash.length) return null;
      raw = divideByDate(subtractByDate(debt, cash), dropImmaterialDenominator(sum(fcf), revYear, d => d), scale);
      break;
    }
  }
  const points = filterWindow(raw, years);
  return points.length >= MIN_CHART_POINTS ? { points, freq: cadence } : null;
}

// ─── Point d'entrée ──────────────────────────────────────────────────────────

/**
 * Série temporelle d'un ratio dérivé. US → TTM glissant Finnhub ; EU/ADR → annuel Yahoo.
 */
export async function getRatioTimeseries(ticker: string, ratio: RatioMetricKey, years: number): Promise<RatioTimeseriesResult> {
  const unit = RATIO_UNIT[ratio];
  const resolved = await resolveYahooTicker(ticker).catch(() => null);
  // Détection EU par DEVISE (≠ USD) et non « symbol ≠ ticker » : un ticker déjà suffixé
  // (AF.PA, MC.PA…) résout vers lui-même → l'ancien test le classait à tort en US → Finnhub SEC
  // renvoyait des ratios faux. Aligné sur pfcfHistory / cashRoceHistory / cccHistory / timeseries.
  const isEuTicker = !!resolved && resolved.currency !== 'USD';

  if (isEuTicker && resolved) {
    const [intra, annual] = await Promise.all([
      computeEuIntraYearRatio(ticker, ratio, years),
      computeAnnualRatio(ticker, resolved.symbol, ratio, years),
    ]);
    // On sert la série qui REMONTE LE PLUS LOIN, l'annuel gagnant à égalité (ses points sont des
    // exercices, plus lisibles qu'un 12 mois glissant). Même arbitrage que la route timeseries
    // pour les grandeurs absolues, donc même profondeur affichée d'une carte à l'autre.
    if (intra && (annual.length < MIN_CHART_POINTS || intra.points[0]!.date < annual[0]!.date)) {
      console.log(`[ratio ${ticker}/${ratio}] EU ${intra.freq} (store) ${intra.points.length} pts vs ${annual.length} annuels`);
      return { points: intra.points, unit, freq: intra.freq, source: 'store', annualOnly: false };
    }
    console.log(`[ratio ${ticker}/${ratio}] EU annual ${annual.length} pts`);
    return { points: annual, unit, freq: 'annual', source: 'yahoo', annualOnly: true };
  }

  const us = await computeUsRatio(ticker, ratio, years);
  if (us.length < MIN_CHART_POINTS) {
    // Trimestriel US insuffisant (ADR 20-F sans filing Finnhub, ou série trop trouée pour
    // produire des TTM contigus) → repli annuel Yahoo. On ne garde l'annuel que s'il fait
    // mieux : sinon on préserve le peu de trimestriel plutôt que de dégrader.
    const annual = await computeAnnualRatio(ticker, resolved?.symbol ?? ticker, ratio, years);
    if (annual.length > us.length) {
      console.log(`[ratio ${ticker}/${ratio}] US TTM insuffisant (${us.length} pt) → Yahoo annual ${annual.length} pts`);
      // annualOnly reste false : on n'escamote pas le sélecteur de période pour un ADR.
      return { points: annual, unit, freq: 'annual', source: 'yahoo', annualOnly: false };
    }
    console.log(`[ratio ${ticker}/${ratio}] US TTM ${us.length} pt, repli annuel pas mieux (${annual.length}) → on garde l'US`);
  } else {
    console.log(`[ratio ${ticker}/${ratio}] US TTM ${us.length} pts`);
  }
  return { points: us, unit, freq: 'quarterly', source: 'finnhub', annualOnly: false };
}
