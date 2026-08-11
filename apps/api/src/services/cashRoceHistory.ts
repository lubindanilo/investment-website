/**
 * Cash ROCE historique — trajectoire du Cash ROCE Bettin/Mauboussin dans le temps.
 *
 * Formule :
 *   cashROCE(t) = FCF_adj_TTM(t) / (TotalAssets(t) − CurrentLiabilities(t) − Goodwill(t))
 *
 * Sources :
 *   - US (Finnhub quarterly) : TTM rolling FCF_adj + snapshot Assets/CurLiab/Goodwill par quarter
 *   - EU + ADRs étrangers (Yahoo annual) : FCF / (Assets − CurLiab − Goodwill) par exercice
 *
 * Cas filtrés (point omis, pas de fallback) :
 *   - FCF_adj_TTM ≤ 0 (entreprise pas profitable cash → ROCE non-pertinent)
 *   - CE ≤ 0 (goodwill > capital productif → ratio non-pertinent)
 *
 * Cohérence avec le single-point : la formule est identique à celle utilisée par
 * derivedMetrics.ts (US Finnhub) et yahooFundamentals.ts (EU). Le dernier point
 * du graphique = la valeur affichée dans le critère.
 */
import { getAdjustedFcfTtmSeries, getCapitalEmployedSeries, computeExcessCash } from './finnhubFundamentals.js';
import { getYahooAnnualBatchCached } from './yahooAnnualStore.js';
import { resolveYahooTicker } from './yahooResolve.js';
import type { TimeseriesPoint } from '@lubin/shared';

export interface CashRoceHistoryPoint {
  /** YYYY-MM-DD — fin de quarter (US) ou fin de FY (EU) */
  date: string;
  /** Ratio Cash ROCE (ex 0.225 pour 22.5 %). Toujours > 0 — points dégénérés omis. */
  cashRoce: number;
}

/**
 * Index : pour une date `t`, retrouve le dernier point ≤ t. Null si trop ancien.
 * (Helper local — duplicate de pfcfHistory pour découpler.)
 */
function findLatestAsOf<T extends { date: string }>(
  series: T[],
  asOfIso: string,
  maxStalenessDays = 200,
): T | null {
  let candidate: T | null = null;
  for (const p of series) {
    if (p.date <= asOfIso) candidate = p;
    else break;
  }
  if (!candidate) return null;
  const ageMs = new Date(asOfIso).getTime() - new Date(candidate.date).getTime();
  if (ageMs > maxStalenessDays * 24 * 3600 * 1000) return null;
  return candidate;
}

/**
 * Nombre de points sous lequel le graphe n'est pas lisible — aligné sur la gate de sparsité
 * du front (CashRoceChartModal : `data.length < 3` affiche « pas assez d'historique »).
 *
 * Sert de critère de SUFFISANCE pour le repli annuel. L'ancien test `length === 0` produisait
 * une incohérence entre fenêtres chez les déposants 20-F : en 5Y le fenêtrage ne laissait pas
 * assez de trimestres pour un seul TTM → 0 point → repli annuel propre ; en 10Y la série
 * trouée en produisait 1 ou 2 → « non vide » → aucun repli → le client affichait « pas assez
 * d'historique » sur la fenêtre LARGE alors que la fenêtre étroite fonctionnait.
 */
const MIN_CHART_POINTS = 3;

export interface CashRoceHistoryResult {
  points: CashRoceHistoryPoint[];
  /** Granularité réellement servie — l'UI s'en sert pour étiqueter les points (exercice vs
   *  trimestre) et calibrer sa détection de trous, pas pour masquer le sélecteur de période. */
  freq: 'quarterly' | 'annual';
}

/**
 * Calcule la timeseries Cash ROCE pour un ticker.
 *
 * @param ticker  Symbole boursier (ex BKNG, MEDP, NESN.SW)
 * @param years   Profondeur (1, 5, 10, 20, 50)
 */
export async function getCashRoceHistory(ticker: string, years: number): Promise<CashRoceHistoryResult> {
  // Route US/EU selon résolution Yahoo (même logique que pfcfHistory.ts)
  // EU / non-US = devise ≠ USD. On se base sur la DEVISE et non sur « symbol ≠ ticker » :
  // un ticker déjà suffixé (EL.PA, NESN.SW) résout vers lui-même, donc l'ancien test le
  // classait à tort en US → Finnhub renvoie 403 sur ces symboles → 502.
  const resolved = await resolveYahooTicker(ticker).catch(() => null);
  const isEuTicker = !!resolved && resolved.currency !== 'USD';

  if (isEuTicker && resolved) {
    return { points: await getCashRoceHistoryAnnualYahoo(ticker, resolved.symbol, years), freq: 'annual' };
  }

  const usResult = await getCashRoceHistoryUs(ticker, years);
  if (usResult.length < MIN_CHART_POINTS) {
    // Trimestriel insuffisant (ADR 20-F sans filing Finnhub, ou série trop trouée pour
    // produire des TTM contigus) → repli annuel (store Yahoo + profondeur EDGAR native),
    // homogène en devise de reporting.
    const annual = await getCashRoceHistoryAnnualYahoo(ticker, resolved?.symbol ?? ticker, years);
    if (annual.length > usResult.length) {
      console.log(`[cashRoce ${ticker}] US insuffisant (${usResult.length} pt) → annual ${annual.length} pts`);
      return { points: annual, freq: 'annual' };
    }
  }
  return { points: usResult, freq: 'quarterly' };
}

/** Path US : Finnhub quarterly. Join FCF_adj_TTM par quarter avec equity+debt par quarter. */
async function getCashRoceHistoryUs(ticker: string, years: number): Promise<CashRoceHistoryPoint[]> {
  // FCF a besoin d'1 an supplémentaire pour calculer le TTM du premier point
  const [fcfTtmSeries, ceSeries] = await Promise.all([
    getAdjustedFcfTtmSeries(ticker, years + 1),
    getCapitalEmployedSeries(ticker, years + 1),
  ]);

  if (fcfTtmSeries.length === 0 || ceSeries.length === 0) {
    console.warn(`[cashRoce ${ticker}] US insuffisant (fcfTtm=${fcfTtmSeries.length}, ce=${ceSeries.length})`);
    return [];
  }

  // Cutoff de la fenêtre demandée
  const cutoffMs = Date.now() - years * 365.25 * 24 * 3600 * 1000;

  const points: CashRoceHistoryPoint[] = [];
  // On itère sur la série FCF_TTM (granularité quarterly) et joint avec le capital employé
  // au quarter le plus proche (snapshot point-in-time).
  for (const fcfPoint of fcfTtmSeries) {
    if (fcfPoint.ts < cutoffMs) continue;
    if (fcfPoint.value <= 0) continue; // FCF négatif → ROCE non pertinent
    const ce = findLatestAsOf(ceSeries, fcfPoint.date);
    if (!ce) continue;
    const ratio = fcfPoint.value / ce.value;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    points.push({ date: fcfPoint.date, cashRoce: Math.round(ratio * 10000) / 10000 });
  }

  console.log(`[cashRoce ${ticker}] US ${points.length} pts — fcfTtm=${fcfTtmSeries.length} ce=${ceSeries.length}`);
  return points;
}

/**
 * Path "annual Yahoo" — utilisé pour :
 *   1. Tickers européens (NESN.SW, MC.PA, COPN.SW…)
 *   2. ADRs étrangers cotés US (ASML, NSRGY, TSM…) qui filent en 20-F annuel
 *
 * Formule annuelle :
 *   cashROCE(N) = FCF(N) / (Assets(N) − CurLiab(N) − Goodwill(N) − ExcessCash(N))
 *   où ExcessCash(N) = max(0, cash(N) − 2% × revenue(N))
 *
 * Cohérent avec yahooFundamentals.ts (snapshot) et derivedMetrics.ts.
 */
async function getCashRoceHistoryAnnualYahoo(ticker: string, yahooSymbol: string, years: number): Promise<CashRoceHistoryPoint[]> {
  // UN batch via le store persistant (Yahoo + profondeur EDGAR native pour les ADR 20-F).
  // Avant : 9 fetches Yahoo directs par cache-miss, plafonnés à ~4 exercices.
  const TYPES = [
    'annualFreeCashFlow', 'annualTotalAssets', 'annualCurrentLiabilities', 'annualGoodwill',
    'annualCashAndShortTermInvestments', 'annualCashAndCashEquivalents', 'annualTotalRevenue',
    'annualStockholdersEquity', 'annualTotalDebt',
  ];
  const batch = await getYahooAnnualBatchCached(ticker, yahooSymbol, TYPES, Date.now());
  const get = (type: string) => batch?.get(type) ?? [];
  const [fcf, assets, curLiab, goodwill, cashSti, cashOnly, revenue, equity, totalDebt] = [
    get('annualFreeCashFlow'), get('annualTotalAssets'), get('annualCurrentLiabilities'),
    get('annualGoodwill'), get('annualCashAndShortTermInvestments'), get('annualCashAndCashEquivalents'),
    get('annualTotalRevenue'), get('annualStockholdersEquity'), get('annualTotalDebt'),
  ];
  if (fcf.length === 0 || assets.length === 0) {
    console.warn(`[cashRoce ${yahooSymbol}] EU pas assez de données (fcf=${fcf.length}, assets=${assets.length})`);
    return [];
  }
  // Préférence : cash+STI agrégé. Fallback : cash seul.
  const cash = cashSti.length > 0 ? cashSti : cashOnly;

  const cutoffMs = Date.now() - years * 365.25 * 24 * 3600 * 1000;

  const assetsByYear = new Map<string, number>();
  const curLiabByYear = new Map<string, number>();
  const goodwillByYear = new Map<string, number>();
  const cashByYear = new Map<string, number>();
  const revenueByYear = new Map<string, number>();
  const equityByYear = new Map<string, number>();
  const debtByYear = new Map<string, number>();
  for (const p of assets) assetsByYear.set(p.date.slice(0, 4), p.value);
  for (const p of curLiab) curLiabByYear.set(p.date.slice(0, 4), p.value);
  for (const p of goodwill) goodwillByYear.set(p.date.slice(0, 4), p.value);
  for (const p of cash) cashByYear.set(p.date.slice(0, 4), p.value);
  for (const p of revenue) revenueByYear.set(p.date.slice(0, 4), p.value);
  for (const p of equity) equityByYear.set(p.date.slice(0, 4), p.value);
  for (const p of totalDebt) debtByYear.set(p.date.slice(0, 4), p.value);

  const points: CashRoceHistoryPoint[] = [];
  for (const p of fcf) {
    const ts = new Date(p.date + 'T00:00:00Z').getTime();
    if (ts < cutoffMs) continue;
    if (p.value <= 0) continue;
    const yr = p.date.slice(0, 4);
    const a = assetsByYear.get(yr);
    if (a == null) continue;
    const gw = goodwillByYear.get(yr) ?? 0;
    const cl = curLiabByYear.get(yr);
    let ce: number;
    if (cl == null) {
      // Fallback secteur financier (bilan unclassified)
      const eq = equityByYear.get(yr);
      if (eq == null) continue;
      const dt = debtByYear.get(yr) ?? 0;
      const ceFinancial = eq + dt - gw;
      if (ceFinancial <= 0) continue;
      ce = ceFinancial;
    } else {
      // Formule standard avec fallback chain : strict → no-excess → no-goodwill
      const ch = cashByYear.get(yr) ?? 0;
      const rev = revenueByYear.get(yr) ?? null;
      const excess = computeExcessCash(ch, rev);
      const ceStrict = a - cl - gw - excess;
      if (ceStrict > 0) {
        ce = ceStrict;
      } else {
        const ceNoExcess = a - cl - gw;
        if (ceNoExcess > 0) {
          ce = ceNoExcess;
        } else {
          // Dernier recours : Buffett classique avec goodwill inclus (MEDP-style)
          const ceNoGoodwill = a - cl;
          if (ceNoGoodwill <= 0) continue;
          ce = ceNoGoodwill;
        }
      }
    }
    const ratio = p.value / ce;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    points.push({ date: p.date, cashRoce: Math.round(ratio * 10000) / 10000 });
  }

  points.sort((a, b) => a.date.localeCompare(b.date));

  console.log(`[cashRoce ${yahooSymbol}] EU ${points.length} pts annual — fcf=${fcf.length} assets=${assets.length} curLiab=${curLiab.length} goodwill=${goodwill.length} cash=${cash.length} rev=${revenue.length}`);
  return points;
}

// Type re-export pour faciliter l'usage par les routes/tests
export type { TimeseriesPoint };
