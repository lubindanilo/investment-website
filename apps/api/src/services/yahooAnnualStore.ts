/**
 * yahooAnnualStore — source CANONIQUE et persistée des séries ANNUELLES Yahoo (non-US).
 *
 * Unifie les deux consommateurs qui fetchaient l'annuel Yahoo séparément :
 *   - getYahooFundamentals (métriques / note) — batch de ~14 types,
 *   - route timeseries.ts (graphiques)         — 1 type à la fois.
 * Ils convergent désormais sur les MÊMES lignes FundamentalsSeries (freq='annual'), clé
 * (ticker, type Yahoo) → cohérence garantie carte ↔ graphique + moins d'appels Yahoo.
 *
 * Même modèle que le store quarterly : APPEND-ONLY (on n'ajoute que les exercices absents,
 * jamais d'écrasement) ; expiration ~400j (un nouvel exercice ~1×/an) avec re-check 30j.
 * Pas d'ajustement splits (l'annuel Yahoo est déjà en base courante).
 */
import type { TimeseriesPoint } from '@lubin/shared';
import { readSeries, isFresh, appendMergePersist, appendOnlyMerge, type ExpiryCadence } from './fundamentalsStore.js';
import { getYahooQuarterlyBatch } from './yahoo.js';
import { getEdgarAnnualNative, EDGAR_ANNUAL_TYPES } from './secEdgar.js';
import { getStockanalysisQuarterlyBatch, getStockanalysisAnnualBatch } from './stockanalysisFundamentals.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Lubin-Investment/0.1';
const TIMESERIES_BASE = 'https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries';
const ANNUAL_CADENCE: ExpiryCadence = { cadenceDays: 400, floorDays: 30 };

interface YahooRow { asOfDate?: string; reportedValue?: { raw?: number } }
interface YahooResult { meta?: { type?: string[] }; [k: string]: unknown }

/** Fetch d'un batch de types annuels Yahoo en 1 requête → Map<type, TimeseriesPoint[]>. */
async function fetchYahooAnnualBatch(symbol: string, types: string[]): Promise<Map<string, TimeseriesPoint[]>> {
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - 7 * 365 * 24 * 3600; // 7 ans → 5 exercices pleins + buffer
  const url = `${TIMESERIES_BASE}/${encodeURIComponent(symbol)}`
    + `?symbol=${encodeURIComponent(symbol)}`
    + `&type=${encodeURIComponent(types.join(','))}`
    + `&period1=${period1}&period2=${period2}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Yahoo annual HTTP ${res.status}`);
  const data = await res.json() as { timeseries?: { result?: YahooResult[]; error?: { description?: string } | null } };
  if (data.timeseries?.error) throw new Error(data.timeseries.error.description ?? 'Yahoo annual error');

  const out = new Map<string, TimeseriesPoint[]>();
  for (const type of types) {
    const result = data.timeseries?.result?.find(r => r.meta?.type?.includes(type));
    const rows = (result?.[type] as YahooRow[] | undefined) ?? [];
    const pts = rows
      .map(r => (r.asOfDate && typeof r.reportedValue?.raw === 'number' ? { date: r.asOfDate, value: r.reportedValue.raw } : null))
      .filter((x): x is TimeseriesPoint => x !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    out.set(type, pts);
  }
  return out;
}

/**
 * Batch annuel store-caché. Renvoie Map<type, TimeseriesPoint[]> (full ~7 ans, à fenêtrer
 * par le caller), ou null en cas d'échec réseau SANS cache exploitable.
 * Si toutes les lignes sont fraîches → ZÉRO appel Yahoo.
 */
export async function getYahooAnnualBatchCached(
  ticker: string,
  symbol: string,
  types: string[],
  nowMs: number,
): Promise<Map<string, TimeseriesPoint[]> | null> {
  // Lecture des lignes stockées
  const stored = new Map<string, Awaited<ReturnType<typeof readSeries>>>();
  let allFresh = true;
  for (const type of types) {
    const s = await readSeries(ticker, type);
    stored.set(type, s);
    if (!isFresh(s, nowMs)) allFresh = false;
  }
  if (allFresh) {
    const out = new Map<string, TimeseriesPoint[]>();
    for (const type of types) out.set(type, stored.get(type)!.points);
    // Même frais, un store peu profond peut être enrichi par EDGAR (one-shot, cf. helper).
    // Sans ce passage, un ticker dont les lignes viennent d'être posées par Yahoo resterait
    // à ~4 exercices jusqu'à leur expiration (~400 j).
    await enrichWithEdgarAnnualDepth(ticker, types, stored, out, nowMs);
    return out;
  }

  // (Re)fetch : 1 seule requête Yahoo pour tous les types
  let fetched: Map<string, TimeseriesPoint[]>;
  try {
    console.log(`[yahoo annual ${ticker}] (re)fetch batch (${types.length} types) → ${symbol}`);
    fetched = await fetchYahooAnnualBatch(symbol, types);
  } catch (e) {
    // Échec réseau : dégradation sur le cache (même périmé) s'il existe, sinon null.
    const anyCache = types.some(t => (stored.get(t)?.points.length ?? 0) > 0);
    if (!anyCache) {
      console.warn(`[yahoo annual ${symbol}] échec batch sans cache :`, (e as Error).message);
      return null;
    }
    const out = new Map<string, TimeseriesPoint[]>();
    for (const type of types) out.set(type, stored.get(type)?.points ?? []);
    return out;
  }

  // Profondeur EDGAR (devise native) fusionnée AVANT la persistance → une seule écriture.
  // `fetched` sert de référence de vérification (dette) : ce sont les valeurs Yahoo du jour.
  const deep = await edgarAnnualDepth(ticker, types, stored, nowMs, fetched);

  // Persistance append-only de chaque type (persistEmpty : un type non fourni est mis en
  // cache négatif borné → ne re-déclenche pas un fetch à chaque appel).
  const out = new Map<string, TimeseriesPoint[]>();
  for (const type of types) {
    const built0 = fetched.get(type) ?? [];
    let built = built0;
    const deepPts = calibrateAdsIfShares(ticker, type, built0, deep?.get(type));
    // Yahoo PRIME sur collision de date (±20j) : le dernier exercice reste celui de la carte.
    if (deepPts?.length) built = appendOnlyMerge(built, deepPts);
    const source = built.length === 0 ? 'yahoo-empty' : (deepPts?.length ? 'yahoo+edgar-annual' : 'yahoo');
    const eff = await appendMergePersist(ticker, type, stored.get(type) ?? null, built, source, nowMs,
      { freq: 'annual', cadence: ANNUAL_CADENCE, persistEmpty: true });
    out.set(type, eff);
  }
  return out;
}

// ─── Profondeur annuelle EDGAR (devise native, déposants 20-F étrangers) ─────
//
// Yahoo plafonne à ~4 exercices ; les 20-F d'EDGAR en re-publient 14-18 (colonne devise
// NATIVE, homogène avec Yahoo). L'append-only rend l'opération one-shot : une fois les
// exercices anciens en base, ils n'expirent jamais et le seuil de profondeur ci-dessous
// court-circuite tout nouvel appel EDGAR.

/** Un historique qui remonte à plus de ~6,5 ans ne peut pas venir de Yahoo (~4 exercices) :
 *  l'enrichissement EDGAR a déjà eu lieu → plus rien à faire pour ce ticker. */
const DEEP_HISTORY_MS = 6.5 * 365.25 * 24 * 3600 * 1000;
function hasDeepHistory(points: TimeseriesPoint[], nowMs: number): boolean {
  return points.length > 0 && Date.parse(points[0]!.date) <= nowMs - DEEP_HISTORY_MS;
}

/** Cache négatif process : tickers sans profondeur EDGAR (pas de CIK, reporting USD, concepts
 *  absents). Évite de re-sonder la SEC à chaque lecture pour les ~totalité des titres. */
const edgarDepthNone = new Set<string>();

// ─── Ratio ADS : les shares EDGAR ne sont pas dans la même unité que Yahoo ────
//
// Un ADS représente N actions ORDINAIRES (BABA 8, TSM 5, PDD 4…). Yahoo compte en ADS —
// c'est la bonne convention ici, puisque le prix qu'on croise est celui de l'ADS (vérifié :
// prix × sharesYahoo / marketCap = 1,00 sur BABA). EDGAR, lui, publie le nombre d'actions
// ORDINAIRES. Fusionner les deux dans `annualDilutedAverageShares` injecte donc des exercices
// profonds N× trop grands, et le P/FCF de ces années sort N× trop cher (mesuré sur BABA :
// ratio Yahoo/EDGAR = 0,13 ≈ 1/8). Comme un P/FCF historique gonflé fait passer le multiple
// courant pour bas, c'est un faux « opportunité du moment » en puissance.
//
// Parade : calibrer EDGAR sur Yahoo via les exercices COMMUNS, puis étendre. Un écart de
// convention est un facteur CONSTANT — si les ratios annuels ne convergent pas, c'est autre
// chose (rachats mal datés, changement de flottant) et on préfère renoncer à la profondeur
// plutôt que servir une série d'unité douteuse.
//
// Le contrôle de cohérence est fait à la MAJORITÉ, pas au pire cas : EDGAR sort parfois un
// exercice aberrant (PDD 2022 : 5,1 M d'actions au lieu de ~5 400 M) qui, sur un critère de
// dispersion max, condamnerait une calibration par ailleurs nette (PDD 3,71 / 3,74 / 3,77 pour
// un ratio officiel de 4). Ratios mesurés en prod, tous des entiers ADS : BABA 8, FUTU 8,
// NTES 5, PDD 4, JD 2, TCOM 1.
// Note : un exercice EDGAR aberrant TOMBANT dans la fenêtre Yahoo est neutralisé à la fusion
// (Yahoo prime sur collision de date) ; hors de cette fenêtre, aucun recoupement n'existe.

/** Tolérance de dispersion des ratios annuels (±8 %) et d'écart à 1 au-delà duquel on rescale. */
const ADS_SPREAD_TOLERANCE = 0.08;
const ADS_RESCALE_THRESHOLD = 0.05;

const medianOf = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/**
 * Aligne les shares EDGAR sur la convention Yahoo (ADS). Renvoie la série EDGAR telle quelle
 * si les deux conventions coïncident déjà, rescalée si un facteur constant les sépare, ou
 * `undefined` s'il n'y a pas de quoi trancher (mieux vaut une série courte qu'une série fausse).
 * Exporté pour tests.
 */
export function calibrateAdsShares(
  yahooPts: TimeseriesPoint[],
  edgarPts: TimeseriesPoint[],
): { points: TimeseriesPoint[]; ratio: number } | null {
  const yByYear = new Map(yahooPts.filter(p => p.value > 0).map(p => [p.date.slice(0, 4), p.value]));
  const ratios: number[] = [];
  for (const e of edgarPts) {
    if (e.value <= 0) continue;
    const y = yByYear.get(e.date.slice(0, 4));
    if (y != null) ratios.push(y / e.value);
  }
  // Moins de 2 exercices communs : un ratio isolé peut venir d'un décalage de date ou d'une
  // année de restatement, pas d'une convention. On renonce.
  if (ratios.length < 2) return null;
  const seed = medianOf(ratios);
  if (!Number.isFinite(seed) || seed <= 0) return null;
  // Cohérence à la MAJORITÉ : on garde les exercices qui s'accordent avec la médiane, et on
  // exige qu'ils soient au moins deux ET majoritaires. Un exercice EDGAR aberrant isolé ne
  // condamne donc plus la calibration, mais deux lectures contradictoires si.
  const inliers = ratios.filter(r => Math.abs(r / seed - 1) <= ADS_SPREAD_TOLERANCE);
  if (inliers.length < 2 || inliers.length * 2 < ratios.length) return null;
  const ratio = medianOf(inliers);
  if (Math.abs(ratio - 1) <= ADS_RESCALE_THRESHOLD) return { points: edgarPts, ratio: 1 };
  return { points: edgarPts.map(p => ({ date: p.date, value: p.value * ratio })), ratio };
}

/** Applique la calibration ADS au seul type `shares` ; passe-plat pour tous les autres. */
function calibrateAdsIfShares(
  ticker: string,
  type: string,
  yahooPts: TimeseriesPoint[],
  deepPts: TimeseriesPoint[] | undefined,
): TimeseriesPoint[] | undefined {
  if (type !== 'annualDilutedAverageShares' || !deepPts?.length) return deepPts;
  const cal = calibrateAdsShares(yahooPts, deepPts);
  if (!cal) {
    console.warn(`[ads ${ticker}] convention shares EDGAR non calibrable sur Yahoo → profondeur abandonnée pour ce type`);
    return undefined;
  }
  if (cal.ratio !== 1) console.log(`[ads ${ticker}] shares EDGAR rescalées ×${cal.ratio.toFixed(4)} (≈1/${(1 / cal.ratio).toFixed(2)} ADS)`);
  return cal.points;
}

/**
 * Sonde EDGAR pour les types demandés encore PEU PROFONDS. Renvoie null si rien à faire
 * (ticker suffixé → pas de CIK, déjà profond, déjà connu vide, ou EDGAR sans données).
 */
async function edgarAnnualDepth(
  ticker: string,
  types: string[],
  stored: Map<string, Awaited<ReturnType<typeof readSeries>>>,
  nowMs: number,
  /** Séries Yahoo de référence (fraîchement fetchées ou stockées) : la dette EDGAR n'est
   *  fusionnée QUE si sa composition reconstitue Yahoo (cf composeVerifiedDebt). */
  reference?: Map<string, TimeseriesPoint[]>,
): Promise<Map<string, TimeseriesPoint[]> | null> {
  if (ticker.includes('.')) return null;
  if (edgarDepthNone.has(ticker)) return null;
  const shallow = types.filter(t => EDGAR_ANNUAL_TYPES.has(t) && !hasDeepHistory(stored.get(t)?.points ?? [], nowMs));
  if (shallow.length === 0) return null;
  const debtRef = reference?.get('annualTotalDebt') ?? stored.get('annualTotalDebt')?.points ?? [];
  const deep = await getEdgarAnnualNative(ticker, shallow, { debtRef }).catch(() => new Map<string, TimeseriesPoint[]>());
  if (deep.size === 0) {
    edgarDepthNone.add(ticker);
    return null;
  }
  return deep;
}

/** Variante du chemin FRAIS : enrichit + persiste les types concernés, et met à jour `out`. */
async function enrichWithEdgarAnnualDepth(
  ticker: string,
  types: string[],
  stored: Map<string, Awaited<ReturnType<typeof readSeries>>>,
  out: Map<string, TimeseriesPoint[]>,
  nowMs: number,
): Promise<void> {
  const deep = await edgarAnnualDepth(ticker, types, stored, nowMs);
  if (!deep) return;
  for (const type of types) {
    // Même calibration ADS que le chemin (re)fetch — ici la référence de convention est la
    // série DÉJÀ stockée (posée par Yahoo), puisqu'aucun fetch Yahoo n'a eu lieu.
    const deepPts = calibrateAdsIfShares(ticker, type, stored.get(type)?.points ?? [], deep.get(type));
    if (!deepPts?.length) continue;
    // appendMergePersist garde l'existant (Yahoo) et n'ajoute que les exercices absents.
    const eff = await appendMergePersist(ticker, type, stored.get(type) ?? null, deepPts, 'yahoo+edgar-annual', nowMs,
      { freq: 'annual', cadence: ANNUAL_CADENCE, persistEmpty: true });
    out.set(type, eff);
  }
}

/**
 * ACCUMULE l'historique TRIMESTRIEL Yahoo des titres non-US dans le store (freq='quarterly',
 * sous les clés MetricKey, comme l'US). Yahoo ne donne qu'une fenêtre glissante (~5 trimestres) ;
 * l'append-only fait qu'à chaque résultat le nouveau trimestre vient s'ajouter → l'historique se
 * complète tout seul au fil des années (et le chemin CAGR trimestriel finira par s'activer pour l'EU).
 * No-op pour les émetteurs semestriels (LVMH, Nestlé…) que Yahoo n'expose pas en trimestriel.
 * Best-effort : appelé en arrière-plan au scoring (cadence earnings = quand le trimestre paraît).
 */
export async function accumulateYahooQuarterly(ticker: string, symbol: string, nowMs: number): Promise<number> {
  const batch = await getYahooQuarterlyBatch(symbol, 6).catch(() => null);
  if (!batch || batch.size === 0) return 0;
  let metricsStored = 0;
  for (const [metricKey, pts] of batch) {
    if (!pts.length) continue;
    const stored = await readSeries(ticker, metricKey);
    // freq='quarterly' + cadence trimestrielle (défaut) → se rafraîchit ~chaque trimestre.
    await appendMergePersist(ticker, metricKey, stored, pts, 'yahoo-q', nowMs, { freq: 'quarterly' });
    metricsStored++;
  }
  if (metricsStored > 0) console.log(`[yahoo Q-accum ${ticker}] ${metricsStored} métriques trimestrielles accumulées (append-only)`);
  return metricsStored;
}

/**
 * ACCUMULE l'historique TRIMESTRIEL / SEMESTRIEL stockanalysis.com des titres non-US dans
 * le store. Vs Yahoo (5 trimestres glissants) : stockanalysis renvoie ~20 périodes (5 ans
 * trimestriel OU 10 ans semestriel selon la cadence native). Append-only : on conserve aussi
 * tout ce que Yahoo a déjà mis (clé date), on ajoute les périodes manquantes.
 *
 * La fréquence détectée (`quarterly` | `semiannual` | `annual`) est PROPAGÉE dans la colonne
 * `freq` du store — important : ~25 % des EU (LVMH, L'Oréal, Air Liquide…) publient nativement
 * en semestriel et n'ont PAS de Q1/Q3 (directive Transparence UE 2013).
 *
 * Best-effort : ~3 fetches par ticker (income, cash-flow, balance-sheet), throttle 1 req/s.
 * Renvoie le nb de métriques accumulées (0 = source indisponible pour ce ticker).
 */
export async function accumulateStockanalysisQuarterly(ticker: string, nowMs: number): Promise<number> {
  const batch = await getStockanalysisQuarterlyBatch(ticker).catch(() => null);
  if (!batch || batch.series.size === 0) return 0;
  let metricsStored = 0;
  for (const [metricKey, pts] of batch.series) {
    if (!pts.length) continue;
    const stored = await readSeries(ticker, metricKey);
    await appendMergePersist(ticker, metricKey, stored, pts, 'stockanalysis', nowMs, { freq: batch.freq });
    metricsStored++;
  }
  if (metricsStored > 0) console.log(`[sa Q-accum ${ticker}] ${metricsStored} métriques accumulées (freq=${batch.freq}, append-only)`);
  return metricsStored;
}

// ─── Profondeur annuelle stockanalysis (titres non-US sans dépôt SEC) ────────
//
// EDGAR ne peut rien pour un émetteur qui ne dépose pas aux États-Unis : Vinci, Air Liquide,
// LVMH… n'ont pas de CIK, et edgarAnnualDepth les écarte de toute façon d'entrée (ticker
// suffixé). Ces titres restaient donc plafonnés aux ~4 exercices de Yahoo, quelle que soit la
// fenêtre demandée — d'où des boutons 1Y/5Y/10Y/All qui rendaient tous le même graphe.
//
// stockanalysis en publie ~5 en accès libre. Le gain immédiat est d'un exercice, mais le store
// étant APPEND-ONLY il ne se perd plus : chaque exercice qui tombe s'ajoute, donc la profondeur
// croît d'un an par an sans re-fetch de l'historique.
//
// ⚠ Effet de bord ASSUMÉ sur la note : yahooFundamentals fenêtre à 5,5 ans et prend le point le
// plus ancien comme base de CAGR. Un 5ᵉ exercice fait donc passer les CAGR revenus / FCF par
// action des titres EU d'une base à 3-4 ans à une base à 5 ans — c'est-à-dire à la définition
// que le libellé « croissance 5 ans » annonce déjà, et à celle du chemin US.

/** Mapping clé métrique interne (stockanalysis) → type annuel Yahoo du store. */
const SA_TO_YAHOO_ANNUAL: Record<string, string> = {
  revenue:             'annualTotalRevenue',
  netIncome:           'annualNetIncome',
  operatingIncome:     'annualOperatingIncome',
  fcf:                 'annualFreeCashFlow',
  cfo:                 'annualOperatingCashFlow',
  capex:               'annualCapitalExpenditure',
  totalDebt:           'annualTotalDebt',
  cash:                'annualCashAndCashEquivalents',
  totalAssets:         'annualTotalAssets',
  currentAssets:       'annualCurrentAssets',
  currentLiabilities:  'annualCurrentLiabilities',
  equity:              'annualStockholdersEquity',
};

/** Profondeur (en exercices) au-delà de laquelle stockanalysis n'a plus rien à apporter. */
const SA_ANNUAL_DEPTH_TARGET = 5;

/** Cache négatif process : tickers dont stockanalysis n'a pas de page annuelle exploitable. */
const saAnnualNone = new Set<string>();

/**
 * Complète le store ANNUEL avec les exercices de stockanalysis. Append-only : les valeurs Yahoo
 * déjà stockées restent la référence (mêmes chiffres carte ↔ graphe), on n'ajoute que les
 * exercices dont la date est absente (±20j). Renvoie le nb de types enrichis (0 = rien à faire).
 *
 * Gaté sur la profondeur de `annualTotalRevenue` : une fois la cible atteinte, plus aucun fetch.
 */
export async function accumulateStockanalysisAnnual(ticker: string, nowMs: number): Promise<number> {
  if (saAnnualNone.has(ticker)) return 0;
  const pivot = await readSeries(ticker, 'annualTotalRevenue');
  if ((pivot?.points.length ?? 0) >= SA_ANNUAL_DEPTH_TARGET) return 0;

  const batch = await getStockanalysisAnnualBatch(ticker).catch(() => null);
  if (!batch || batch.series.size === 0) {
    saAnnualNone.add(ticker);
    return 0;
  }
  // Une page annuelle qui se lit comme du trimestriel signalerait un mauvais parsing (ou une
  // page servie dans la mauvaise périodicité) : on préfère ne rien écrire.
  if (batch.freq !== 'annual') {
    console.warn(`[sa annual ${ticker}] cadence détectée « ${batch.freq} » sur la page annuelle → ignorée`);
    return 0;
  }

  let enriched = 0;
  for (const [metricKey, pts] of batch.series) {
    const type = SA_TO_YAHOO_ANNUAL[metricKey];
    if (!type || !pts.length) continue;
    const stored = await readSeries(ticker, type);
    const before = stored?.points.length ?? 0;
    const eff = await appendMergePersist(ticker, type, stored, pts, 'yahoo+stockanalysis-annual', nowMs,
      { freq: 'annual', cadence: ANNUAL_CADENCE, persistEmpty: true });
    if (eff.length > before) enriched++;
  }
  if (enriched > 0) {
    console.log(`[sa annual ${ticker}] ${enriched} types annuels approfondis (append-only)`);
  } else {
    // Page lisible mais qui n'apporte aucun exercice de plus (même profondeur que Yahoo) : sans
    // ce marquage, le gate sur `annualTotalRevenue` resterait sous la cible et on re-fetcherait
    // 3 pages à CHAQUE scoring de ce ticker, pour rien. Cache process → réévalué au cold start.
    saAnnualNone.add(ticker);
  }
  return enriched;
}

/** Série annuelle store-cachée pour UN type Yahoo (graphiques). [] si indisponible. */
export async function getYahooAnnualSingleCached(
  ticker: string,
  symbol: string,
  type: string,
  nowMs: number,
): Promise<TimeseriesPoint[]> {
  const batch = await getYahooAnnualBatchCached(ticker, symbol, [type], nowMs);
  return batch?.get(type) ?? [];
}
