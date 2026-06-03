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
import { readSeries, isFresh, appendMergePersist, type ExpiryCadence } from './fundamentalsStore.js';

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

  // Persistance append-only de chaque type (persistEmpty : un type non fourni est mis en
  // cache négatif borné → ne re-déclenche pas un fetch à chaque appel).
  const out = new Map<string, TimeseriesPoint[]>();
  for (const type of types) {
    const built = fetched.get(type) ?? [];
    const source = built.length === 0 ? 'yahoo-empty' : 'yahoo';
    const eff = await appendMergePersist(ticker, type, stored.get(type) ?? null, built, source, nowMs,
      { freq: 'annual', cadence: ANNUAL_CADENCE, persistEmpty: true });
    out.set(type, eff);
  }
  return out;
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
