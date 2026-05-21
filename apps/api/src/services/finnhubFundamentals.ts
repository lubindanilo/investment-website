/**
 * Service Finnhub `/stock/financials-reported` — extrait les états financiers
 * directement depuis les 10-K / 10-Q SEC. Beaucoup plus profond que Yahoo
 * (16+ années annuelles, 29+ trimestres pour la plupart des US tickers).
 *
 * ⚠ Particularité des 10-Q : les chiffres income statement et cash flow sont
 *   CUMULATIFS YTD (Q3 contient Q1+Q2+Q3). On décumule pour avoir des vrais
 *   trimestres individuels. Les balance sheet items (BS) sont des snapshots
 *   à date, pas cumulatifs.
 */
import { finnhubLimiter } from '../lib/limiter.js';
import { fetchWithRetry } from '../lib/retry.js';
import type { TimeseriesPoint } from '@lubin/shared';
import { fetchSplitEvents, splitAdjustWithDiscontinuity } from './yahooSplits.js';

const BASE = 'https://finnhub.io/api/v1';
const TOKEN = process.env.FINNHUB_API_KEY ?? '';

type Section = 'bs' | 'cf' | 'ic';
type Frequency = 'annual' | 'quarterly';

interface FinnhubReportItem {
  concept: string;
  label?: string;
  unit?: string;
  value: number;
}
interface FinnhubFiling {
  year: number;
  quarter: number;
  startDate: string;
  endDate: string;
  form: '10-K' | '10-Q' | string;
  report: { bs?: FinnhubReportItem[]; cf?: FinnhubReportItem[]; ic?: FinnhubReportItem[] };
}
interface FinnhubReportedResponse {
  data?: FinnhubFiling[];
  error?: string;
}

/**
 * Mapping des métriques (clés haut-niveau utilisées dans l'UI) vers les concepts XBRL US-GAAP.
 * Plusieurs concepts candidats par métrique car les boîtes utilisent des tags différents.
 */
export interface MetricConfig {
  /** Section du rapport (bilan, cash flow, income statement) */
  section: Section;
  /** Concepts XBRL candidats, testés dans l'ordre */
  concepts: string[];
  /**
   * True si la valeur est cumulative YTD dans les 10-Q (résultat net, CA, etc.).
   * False si snapshot à date (cash, dette, actions outstanding).
   */
  cumulative: boolean;
}

export const METRICS: Record<string, MetricConfig> = {
  revenue: {
    section: 'ic',
    concepts: [
      'us-gaap_Revenues',
      'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax',
      'us-gaap_RevenueFromContractWithCustomerIncludingAssessedTax',
      'us-gaap_SalesRevenueNet',
      'us-gaap_SalesRevenueGoodsNet',
    ],
    cumulative: true,
  },
  netIncome: {
    section: 'ic',
    concepts: [
      'us-gaap_NetIncomeLoss',
      'us-gaap_ProfitLoss',
    ],
    cumulative: true,
  },
  operatingIncome: {
    section: 'ic',
    concepts: ['us-gaap_OperatingIncomeLoss'],
    cumulative: true,
  },
  fcf: {
    // FCF = CashFlowFromOperations − CapEx — calculé en aval
    section: 'cf',
    concepts: ['__computed_fcf__'],
    cumulative: true,
  },
  cfo: {
    section: 'cf',
    concepts: [
      'us-gaap_NetCashProvidedByUsedInOperatingActivities',
      'us-gaap_NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
    ],
    cumulative: true,
  },
  capex: {
    section: 'cf',
    concepts: [
      'us-gaap_PaymentsToAcquirePropertyPlantAndEquipment',
      'us-gaap_PaymentsToAcquireProductiveAssets',
    ],
    cumulative: true,
  },
  shares: {
    section: 'ic',
    concepts: [
      'us-gaap_WeightedAverageNumberOfDilutedSharesOutstanding',
      'us-gaap_WeightedAverageNumberOfSharesOutstandingBasic',
    ],
    cumulative: false, // moyenne pondérée → pas cumulative
  },
  totalDebt: {
    section: 'bs',
    concepts: [
      'us-gaap_LongTermDebt',
      'us-gaap_LongTermDebtNoncurrent',
      'us-gaap_DebtCurrent',
    ],
    cumulative: false,
  },
};

export type MetricKey = keyof typeof METRICS;

async function fetchReported(ticker: string, freq: Frequency): Promise<FinnhubFiling[]> {
  return finnhubLimiter.schedule(async () => {
    const url = `${BASE}/stock/financials-reported?symbol=${ticker}&freq=${freq}&token=${TOKEN}`;
    const r = await fetchWithRetry(url, undefined, { label: `finnhub reported ${freq}`, attempts: 3 });
    const j = await r.json() as FinnhubReportedResponse;
    if (j.error) throw new Error(`Finnhub reported: ${j.error}`);
    return j.data ?? [];
  });
}

function extractValue(filing: FinnhubFiling, cfg: MetricConfig): number | null {
  if (cfg.concepts.includes('__computed_fcf__')) {
    const cfo = extractFirst(filing, 'cf', METRICS.cfo!.concepts);
    const capex = extractFirst(filing, 'cf', METRICS.capex!.concepts);
    if (cfo == null) return null;
    // CapEx est habituellement signé négatif dans les filings (paiements). FCF = CFO + CapEx.
    return cfo + (capex ?? 0);
  }
  return extractFirst(filing, cfg.section, cfg.concepts);
}

function extractFirst(filing: FinnhubFiling, section: Section, concepts: string[]): number | null {
  const items = filing.report?.[section];
  if (!items) return null;
  for (const concept of concepts) {
    const found = items.find(i => i.concept === concept);
    if (found && typeof found.value === 'number' && Number.isFinite(found.value)) return found.value;
  }
  return null;
}

/**
 * Récupère une série temporelle (quarterly ou annual) depuis Finnhub financials-reported.
 *
 * Pour le quarterly + métrique cumulative (revenue, NI, FCF, etc.) :
 *   1. Décumule les Q1/Q2/Q3 YTD pour avoir des valeurs trimestrielles individuelles.
 *   2. Récupère AUSSI les filings annuels (10-K) et calcule Q4 = annuel − Q3 cumulé YTD.
 *      Sans cette étape, on aurait Q1/Q2/Q3 seulement (les 10-Q ne couvrent pas Q4).
 *
 * Pour le quarterly + métrique non-cumulative (shares, dette à instant T) :
 *   Renvoie les valeurs Q1/Q2/Q3 telles quelles. Pas de Q4 dérivé (l'annuel
 *   serait juste une moyenne pondérée FY qui n'est pas comparable à Q4 seul).
 *
 * Pour l'annual : valeurs telles que dans les 10-K.
 */
export async function getReportedTimeseries(
  ticker: string,
  metric: MetricKey,
  freq: Frequency,
  years: number,
): Promise<TimeseriesPoint[]> {
  const cfg = METRICS[metric];
  if (!cfg) return [];
  const cap = Math.max(1, Math.min(years, 50));

  // Pour quarterly + cumulative : fetch en parallèle les deux fréquences pour dériver Q4
  const needAnnualForQ4 = freq === 'quarterly' && cfg.cumulative;
  const [quarterlyFilings, annualFilings] = await Promise.all([
    freq === 'quarterly' ? fetchReported(ticker, 'quarterly') : Promise.resolve([]),
    freq === 'annual' || needAnnualForQ4 ? fetchReported(ticker, 'annual') : Promise.resolve([]),
  ]);

  // Cas simple : annual
  if (freq === 'annual') {
    const points = extractAndPack(annualFilings, cfg);
    return splitAdjustIfNeeded(filterWindow(points, cap), ticker, metric);
  }

  // Cas quarterly
  type Raw = { date: string; value: number; year: number; quarter: number };
  const quarterlyRaw: Raw[] = quarterlyFilings
    .map(f => {
      const value = extractValue(f, cfg);
      if (value == null) return null;
      return { date: f.endDate.slice(0, 10), value, year: f.year, quarter: f.quarter };
    })
    .filter((x): x is Raw => x !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Décumulation Q1/Q2/Q3 si cumulative.
  //
  // Cas piégeux : si Q1 manque pour une année (ex : changement de ticker FISV→FI en plein
  // milieu de 2023, Finnhub ne renvoie alors que Q2/Q3 sous l'ancien symbol), on ne peut PAS
  // décumuler — la valeur "Q2" est en réalité la valeur YTD = Q1+Q2 actuelle. Si on remontait
  // cette valeur comme si c'était Q2 seul, on aurait des chiffres 2-3× trop hauts (bug constaté
  // sur FISV : Q2 2021 reporté à $7.8B au lieu de $4.0B réel, Q3 2025 à $15.9B au lieu de ~$5B).
  // → On SKIP le point quand on ne peut pas décumuler proprement.
  const points: TimeseriesPoint[] = [];
  const ytdByYear: Record<number, number> = {};
  // Trace la quarter le plus récent vu pour chaque année (pour valider qu'on a la chaîne complète)
  const lastQuarterByYear: Record<number, number> = {};
  let skippedQ: { date: string; quarter: number }[] = [];
  for (const r of quarterlyRaw) {
    if (!cfg.cumulative) {
      points.push({ date: r.date, value: r.value });
      continue;
    }
    if (r.quarter === 1) {
      points.push({ date: r.date, value: r.value });
      ytdByYear[r.year] = r.value;
      lastQuarterByYear[r.year] = 1;
    } else {
      // Pour décumuler Q_n on a besoin du Q_(n-1) YTD de la MÊME année.
      // Si lastQuarterByYear[r.year] !== r.quarter - 1, il manque un quarter intermédiaire
      // (Q1 absent, ou Q1+Q2 absents, etc.) → on ne peut pas décumuler.
      const expectedPrior = r.quarter - 1;
      if (lastQuarterByYear[r.year] !== expectedPrior) {
        skippedQ.push({ date: r.date, quarter: r.quarter });
        continue;
      }
      const priorYtd = ytdByYear[r.year]!;
      points.push({ date: r.date, value: r.value - priorYtd });
      ytdByYear[r.year] = r.value;
      lastQuarterByYear[r.year] = r.quarter;
    }
  }
  if (skippedQ.length > 0) {
    console.warn(`[finnhub fundamentals ${ticker}/${metric}] ${skippedQ.length} Q skipped (impossible à décumuler, Q1 ou intermédiaire manquant) :`, skippedQ.slice(0, 5));
  }

  // Dérivation Q4 : annuel − Q3 YTD (cumulative only)
  if (needAnnualForQ4) {
    let q4Count = 0;
    for (const a of annualFilings) {
      const annualValue = extractValue(a, cfg);
      if (annualValue == null) continue;
      const q3Ytd = ytdByYear[a.year];
      if (q3Ytd == null) continue; // pas de Q3 connu pour cette année → skip
      const q4Date = a.endDate.slice(0, 10);
      // On vérifie qu'on n'a pas déjà ce point (cas rare où un 10-K aurait été parsé comme quarterly)
      if (points.some(p => p.date === q4Date)) continue;
      points.push({ date: q4Date, value: annualValue - q3Ytd });
      q4Count++;
    }
    console.log(`[finnhub fundamentals] ${ticker}/${metric}: ${q4Count} Q4 dérivés du 10-K`);
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return splitAdjustIfNeeded(filterWindow(points, cap), ticker, metric);
}

/**
 * Calcule le CAGR du FCF/action sur 5 ans en reconstituant les annuels depuis
 * les quarterlies Finnhub. Approche robuste : on additionne Q1+Q2+Q3+Q4 pour
 * chaque année fiscale (sans dépendre de annualFreeCashFlow Yahoo qui peut
 * être partial pour l'année en cours, ni de Finnhub annual qui a parfois des
 * valeurs gonflées).
 *
 * Pourquoi cette approche est fiable :
 *   - Q4 est dérivé du 10-K (annual − Q3 YTD) dans getReportedTimeseries → la somme
 *     Q1+Q2+Q3+Q4 EST EXACTEMENT la valeur du 10-K, par construction.
 *   - Si Finnhub fournit < 4 quarters pour une année (réorg, ticker change), on skip.
 *   - Skip aussi les années avec FCF annuel ≤ 0 (CAGR mathématiquement non-pertinent
 *     sur ces bornes).
 *
 * @param ticker  Symbole pour les logs
 * @param years   Profondeur souhaitée (5 par défaut)
 * @returns { value, reason } — value=null si non calculable, reason explique pourquoi
 */
export async function computeFcfPerShareCagrFromQuarterlies(
  ticker: string,
  years = 5,
): Promise<{ value: number | null; reason?: string }> {
  // On fetch 6 ans de quarterlies pour avoir une marge (FCF + shares)
  const [fcfQ, sharesQ] = await Promise.all([
    getReportedTimeseries(ticker, 'fcf', 'quarterly', years + 1),
    getReportedTimeseries(ticker, 'shares', 'quarterly', years + 1),
  ]);

  if (fcfQ.length === 0 || sharesQ.length === 0) {
    return { value: null, reason: 'Trimestrielles Finnhub indisponibles' };
  }

  // Regroupe par année fiscale. Année complète = au moins 4 quarters (Q1+Q2+Q3+Q4).
  type YearAgg = { count: number; fcfSum: number; sharesSum: number };
  const byYear: Record<number, YearAgg> = {};
  for (const p of fcfQ) {
    const yr = Number(p.date.slice(0, 4));
    byYear[yr] ??= { count: 0, fcfSum: 0, sharesSum: 0 };
    byYear[yr].count++;
    byYear[yr].fcfSum += p.value;
  }
  // Pour les shares, on prend la moyenne pondérée des quarters (= dilutedAverageShares pour l'année).
  // Les shares sont non-cumulatives (cf METRICS.shares.cumulative = false), donc on moyenne.
  const sharesByYear: Record<number, { sum: number; count: number }> = {};
  for (const p of sharesQ) {
    const yr = Number(p.date.slice(0, 4));
    sharesByYear[yr] ??= { sum: 0, count: 0 };
    sharesByYear[yr].sum += p.value;
    sharesByYear[yr].count++;
  }

  // Construit la série annuelle [{ year, fcfPs }] uniquement pour les années complètes
  const annual: Array<{ year: number; fcf: number; shares: number; fcfPs: number }> = [];
  for (const yrStr of Object.keys(byYear).sort()) {
    const yr = Number(yrStr);
    const agg = byYear[yr]!;
    const sh = sharesByYear[yr];
    if (agg.count < 4) {
      console.log(`[fcfPsCagr ${ticker}] année ${yr} incomplète (${agg.count}/4 quarters) — skip`);
      continue;
    }
    if (!sh || sh.count === 0) continue;
    const annualFcf = agg.fcfSum;
    const annualShares = sh.sum / sh.count;
    if (annualShares <= 0) continue;
    annual.push({ year: yr, fcf: annualFcf, shares: annualShares, fcfPs: annualFcf / annualShares });
  }

  console.log(`[fcfPsCagr ${ticker}] ${annual.length} années complètes reconstruites :`, annual.map(a => `${a.year}: FCF=${(a.fcf / 1e9).toFixed(1)}B fcfPs=${a.fcfPs.toFixed(2)}`).join(' | '));

  if (annual.length < 2) {
    return { value: null, reason: 'Moins de 2 années complètes (besoin Q1-Q4 par année)' };
  }

  // CAGR sur les bornes : oldest valide (fcfPs > 0) → newest valide (fcfPs > 0)
  const valid = annual.filter(a => a.fcfPs > 0);
  if (valid.length < 2) {
    return { value: null, reason: 'Moins de 2 années avec FCF/action positif' };
  }
  const oldest = valid[0]!;
  const newest = valid[valid.length - 1]!;
  const ny = newest.year - oldest.year;
  if (ny < 1) return { value: null, reason: 'Période < 1 an entre bornes' };

  const cagr = Math.pow(newest.fcfPs / oldest.fcfPs, 1 / ny) - 1;
  return { value: cagr };
}

/**
 * Si la métrique est un share count, on ramène toutes les valeurs en current-basis.
 *
 * Pour Finnhub on utilise un algorithme "discontinuity-based" (≠ Yahoo date-based) :
 * Finnhub fait du restatement automatique des filings publiées POST-split — la 10-Q
 * Q1 publiée juste après un split contient déjà les chiffres post-split, même si le
 * quarter end est avant. Un adjustment date-based double-counterait le facteur.
 *
 * splitAdjustWithDiscontinuity détecte le saut ≈ factor dans la série et n'ajuste que
 * les points avant ce saut. Voir yahooSplits.ts pour le détail de l'algorithme.
 */
async function splitAdjustIfNeeded(
  points: TimeseriesPoint[],
  ticker: string,
  metric: MetricKey,
): Promise<TimeseriesPoint[]> {
  if (metric !== 'shares' || points.length === 0) return points;
  const splits = await fetchSplitEvents(ticker);
  if (splits.length === 0) return points;
  return splitAdjustWithDiscontinuity(points, splits);
}

function extractAndPack(filings: FinnhubFiling[], cfg: MetricConfig): TimeseriesPoint[] {
  return filings
    .map(f => {
      const value = extractValue(f, cfg);
      if (value == null) return null;
      return { date: f.endDate.slice(0, 10), value };
    })
    .filter((x): x is TimeseriesPoint => x !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function filterWindow(points: TimeseriesPoint[], years: number): TimeseriesPoint[] {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return points.filter(p => p.date >= cutoffIso);
}
