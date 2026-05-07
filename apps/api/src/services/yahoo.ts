/**
 * Service Yahoo Finance — source brute pour l'historique du nombre d'actions.
 *
 * Endpoints utilisés (free, server-side uniquement) :
 *   - https://fc.yahoo.com  → cookies de session (best effort)
 *   - https://query1.finance.yahoo.com/v1/test/getcrumb  → crumb token
 *   - https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/{ticker}
 *       ?type=annualDilutedAverageShares,annualOrdinarySharesNumber&period1=…&period2=…&crumb=…
 *
 * ⚠ Yahoo a vidé `quoteSummary.incomeStatementHistory.dilutedAverageShares` (tout null).
 * Le bon endpoint pour les séries historiques est `fundamentals-timeseries`.
 *
 * Si Yahoo échoue (cookie/crumb/parsing) → on retourne null et le caller fallback
 * sur la dérivation Finnhub (revenueGrowth5Y vs revenueShareGrowth5Y).
 */
import { yahooLimiter } from '../lib/limiter.js';

const TIMESERIES_BASE = 'https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries';
const CRUMB_URL = 'https://query1.finance.yahoo.com/v1/test/getcrumb';
const SESSION_URL = 'https://fc.yahoo.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Lubin-Investment/0.1';
const CRUMB_TTL_MS = 60 * 60 * 1000;          // 1h

interface YahooSession { crumb: string; cookies: string; expiresAt: number }
let cachedSession: YahooSession | null = null;

async function fetchSession(): Promise<YahooSession> {
  // Étape 1 — session cookies (best effort)
  let cookies = '';
  try {
    const sessionRes = await fetch(SESSION_URL, {
      headers: { 'User-Agent': UA, Accept: '*/*' },
      redirect: 'manual',
    });
    const setCookies = sessionRes.headers.getSetCookie?.() ?? [];
    cookies = setCookies.map(c => c.split(';')[0]).filter(Boolean).join('; ');
  } catch (e) {
    console.warn('[yahoo session] cookies non récupérés —', (e as Error).message);
  }

  // Étape 2 — crumb
  const headers: Record<string, string> = { 'User-Agent': UA, Accept: 'text/plain' };
  if (cookies) headers.Cookie = cookies;
  const crumbRes = await fetch(CRUMB_URL, { headers });
  if (!crumbRes.ok) throw new Error(`Yahoo crumb HTTP ${crumbRes.status}`);
  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.length > 64 || crumb.includes('<')) throw new Error('Yahoo : crumb invalide');

  return { crumb, cookies, expiresAt: Date.now() + CRUMB_TTL_MS };
}

async function getSession(): Promise<YahooSession> {
  if (cachedSession && Date.now() < cachedSession.expiresAt) return cachedSession;
  cachedSession = await fetchSession();
  console.log(`[yahoo] session refresh — crumb=${cachedSession.crumb.slice(0, 6)}…`);
  return cachedSession;
}

function invalidateSession() { cachedSession = null; }

interface TimeseriesValue {
  asOfDate?: string;
  reportedValue?: { raw?: number };
}
interface TimeseriesResult {
  meta?: { type?: string[]; symbol?: string[] };
  timestamp?: number[];
  // La clé exacte dépend du type demandé, on indexe dynamiquement par chaîne.
  [key: string]: unknown;
}
interface TimeseriesResponse {
  timeseries?: { result?: TimeseriesResult[]; error?: { description?: string } | null };
}

async function fetchTimeseries(ticker: string, types: string[]): Promise<TimeseriesResponse> {
  // 6 ans en arrière → couvre 5 années fiscales pleines
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - 6 * 365 * 24 * 3600;
  const typeParam = types.join(',');

  const tryOnce = async (session: YahooSession): Promise<Response> => {
    const url = `${TIMESERIES_BASE}/${encodeURIComponent(ticker)}`
      + `?symbol=${encodeURIComponent(ticker)}`
      + `&type=${encodeURIComponent(typeParam)}`
      + `&period1=${period1}&period2=${period2}`
      + `&crumb=${encodeURIComponent(session.crumb)}`;
    const headers: Record<string, string> = { 'User-Agent': UA, Accept: 'application/json' };
    if (session.cookies) headers.Cookie = session.cookies;
    return fetch(url, { headers });
  };

  let session = await getSession();
  let res = await tryOnce(session);
  if (res.status === 401 || res.status === 403) {
    invalidateSession();
    session = await getSession();
    res = await tryOnce(session);
  }
  if (!res.ok) throw new Error(`Yahoo timeseries HTTP ${res.status}`);
  return res.json() as Promise<TimeseriesResponse>;
}

/** Pour la dérivation CAGR annuelle (ne garde que l'année + valeurs strictement > 0). */
function extractSeries(response: TimeseriesResponse, type: string): { fiscalYear: number; value: number }[] {
  return extractSeriesFull(response, type)
    .filter(p => p.value > 0)
    .map(p => ({ fiscalYear: Number(p.date.slice(0, 4)), value: p.value }))
    .filter(p => Number.isFinite(p.fiscalYear));
}

/** Pour l'UI histogramme — garde la date complète, accepte valeurs négatives ou nulles. */
function extractSeriesFull(response: TimeseriesResponse, type: string): { date: string; value: number }[] {
  const result = response.timeseries?.result?.find(r => r.meta?.type?.includes(type));
  const rows = (result?.[type] as TimeseriesValue[] | undefined) ?? [];
  return rows
    .map(row => {
      const date = row.asOfDate;
      const val = row.reportedValue?.raw;
      if (!date || typeof val !== 'number') return null;
      return { date, value: val };
    })
    .filter((x): x is { date: string; value: number } => x !== null);
}

export interface SharesHistoryPoint {
  fiscalYear: number;
  /** Préférence : actions diluées moyennes ; fallback : ordinary shares de fin d'année */
  dilutedShares: number;
}

/**
 * Renvoie l'historique des actions sur 4-5 ans, trié du plus ancien au plus récent.
 * Préfère `annualDilutedAverageShares` (moyenne pondérée diluée, métrique standard pour EPS) ;
 * fallback sur `annualOrdinarySharesNumber` (snapshot fin d'année).
 * Null si Yahoo plante ou ne renvoie pas assez de points.
 */
export async function getSharesHistory(ticker: string): Promise<SharesHistoryPoint[] | null> {
  return yahooLimiter.schedule(async () => {
    try {
      const data = await fetchTimeseries(ticker, ['annualDilutedAverageShares', 'annualOrdinarySharesNumber']);
      if (data.timeseries?.error) {
        console.warn(`[yahoo ${ticker}]`, data.timeseries.error.description);
        return null;
      }

      const diluted = extractSeries(data, 'annualDilutedAverageShares');
      const ordinary = extractSeries(data, 'annualOrdinarySharesNumber');
      const series = diluted.length >= 2 ? diluted : ordinary;
      const source = diluted.length >= 2 ? 'diluted' : 'ordinary';

      if (series.length < 2) {
        console.log(`[yahoo ${ticker}] < 2 points (diluted=${diluted.length}, ordinary=${ordinary.length}) — fallback Finnhub`);
        return null;
      }

      const points: SharesHistoryPoint[] = series
        .map(s => ({ fiscalYear: s.fiscalYear, dilutedShares: s.value }))
        .sort((a, b) => a.fiscalYear - b.fiscalYear);

      console.log(`[yahoo ${ticker}] ${points.length} années via ${source} (${points[0]!.fiscalYear} → ${points[points.length - 1]!.fiscalYear})`);
      return points;
    } catch (e) {
      console.warn(`[yahoo ${ticker}] échec — fallback Finnhub :`, (e as Error).message);
      return null;
    }
  });
}

/** CAGR à partir de la série brute. Null si série trop courte ou aberrante. */
export function computeSharesCagr(history: SharesHistoryPoint[] | null): number | null {
  if (!history || history.length < 2) return null;
  const oldest = history[0]!;
  const newest = history[history.length - 1]!;
  const years = newest.fiscalYear - oldest.fiscalYear;
  if (years < 1 || oldest.dilutedShares <= 0) return null;
  return Math.pow(newest.dilutedShares / oldest.dilutedShares, 1 / years) - 1;
}

// ═══════════════════════════════════════════════════════════════
// ── Séries temporelles trimestrielles (pour histogrammes UI) ────
// ═══════════════════════════════════════════════════════════════

export interface TimeseriesPoint {
  /** Date de fin de trimestre (YYYY-MM-DD) */
  date: string;
  /** Valeur du trimestre (devise locale pour montants, ratio pour marges, etc.) */
  value: number;
}

/**
 * Récupère une série temporelle trimestrielle Yahoo sur N années.
 * Renvoie [] si Yahoo répond mal. Cibles supportées (exemples) :
 *   - quarterlyTotalRevenue
 *   - quarterlyFreeCashFlow
 *   - quarterlyNetIncomeContinuousOperations
 *   - quarterlyOperatingMargin
 *   - quarterlyDilutedAverageShares
 *   - quarterlyBasicAverageShares
 *   - quarterlyTotalDebt
 *   - quarterlyCashAndCashEquivalents
 *   - etc. (cf. Yahoo doc fundamentals-timeseries)
 */
export async function getQuarterlyTimeseries(
  ticker: string,
  type: string,
  years: number,
): Promise<TimeseriesPoint[]> {
  // Validation simple — on n'accepte que des types qui commencent par "quarterly"
  // pour éviter les abus (l'endpoint Yahoo accepte aussi annual*, trailing*, etc.)
  if (!/^quarterly[A-Z]/.test(type)) return [];
  // Cap raisonnable : 50 ans (= "All")
  const safeYears = Math.max(1, Math.min(years, 50));

  return yahooLimiter.schedule(async () => {
    try {
      // Hack : fetchTimeseries calcule period1 = 6 ans en arrière par défaut, ce qui est
      // insuffisant pour 10Y/20Y/All. On passe par fetchTimeseriesCustomPeriod ci-dessous.
      const data = await fetchTimeseriesCustomPeriod(ticker, [type], safeYears + 1);
      if (data.timeseries?.error) {
        console.warn(`[yahoo ts ${ticker}/${type}]`, data.timeseries.error.description);
        return [];
      }
      const points = extractSeriesFull(data, type);
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - safeYears);
      const cutoffIso = cutoffDate.toISOString().slice(0, 10);
      const filtered = points
        .filter(p => p.date >= cutoffIso)
        .sort((a, b) => a.date.localeCompare(b.date));
      console.log(`[yahoo ts ${ticker}/${type}] ${filtered.length} pts sur ${safeYears}Y`);
      return filtered;
    } catch (e) {
      console.warn(`[yahoo ts ${ticker}/${type}] échec :`, (e as Error).message);
      return [];
    }
  });
}

// ─── Mapping high-level metric key (Finnhub-friendly) → Yahoo type ────────
// Permet d'utiliser la même clé (ex: 'revenue', 'fcf') quelle que soit la source.
const METRIC_TO_YAHOO: Record<string, string> = {
  revenue:         'quarterlyTotalRevenue',
  netIncome:       'quarterlyNetIncome',
  operatingIncome: 'quarterlyOperatingIncome',
  fcf:             'quarterlyFreeCashFlow',
  cfo:             'quarterlyOperatingCashFlow',
  capex:           'quarterlyCapitalExpenditure',
  shares:          'quarterlyDilutedAverageShares',
  totalDebt:       'quarterlyTotalDebt',
};

/**
 * Wrapper de haut niveau : prend une clé métier (revenue, fcf, …) et délègue
 * à Yahoo /fundamentals-timeseries via le mapping ci-dessus. Renvoie une liste
 * vide si la clé n'a pas d'équivalent Yahoo (caller doit fallback Finnhub).
 */
export async function getYahooMetricTimeseries(
  ticker: string,
  metricKey: string,
  years: number,
): Promise<TimeseriesPoint[]> {
  const yType = METRIC_TO_YAHOO[metricKey];
  if (!yType) return [];
  return getQuarterlyTimeseries(ticker, yType, years);
}

/** Variant de fetchTimeseries avec fenêtre configurable (jusqu'à 50 ans). */
async function fetchTimeseriesCustomPeriod(ticker: string, types: string[], years: number): Promise<TimeseriesResponse> {
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - years * 365 * 24 * 3600;
  const typeParam = types.join(',');

  const tryOnce = async (session: YahooSession): Promise<Response> => {
    const url = `${TIMESERIES_BASE}/${encodeURIComponent(ticker)}`
      + `?symbol=${encodeURIComponent(ticker)}`
      + `&type=${encodeURIComponent(typeParam)}`
      + `&period1=${period1}&period2=${period2}`
      + `&crumb=${encodeURIComponent(session.crumb)}`;
    const headers: Record<string, string> = { 'User-Agent': UA, Accept: 'application/json' };
    if (session.cookies) headers.Cookie = session.cookies;
    return fetch(url, { headers });
  };

  let session = await getSession();
  let res = await tryOnce(session);
  if (res.status === 401 || res.status === 403) {
    invalidateSession();
    session = await getSession();
    res = await tryOnce(session);
  }
  if (!res.ok) throw new Error(`Yahoo timeseries HTTP ${res.status}`);
  return res.json() as Promise<TimeseriesResponse>;
}
