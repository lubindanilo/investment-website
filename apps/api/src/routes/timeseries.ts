/**
 * GET /api/timeseries?ticker=FI&metric=revenue&freq=quarterly&years=5
 *   → renvoie { ticker, metric, freq, years, points: [{date, value}, ...], source, cached }
 *
 * `metric`  : clé haut-niveau ('revenue', 'netIncome', 'fcf', 'shares', 'totalDebt', etc.)
 * `freq`    : 'quarterly' (défaut) ou 'annual'
 * `years`   : 1, 5, 10, 20, 50 ('All')
 *
 * Stratégie source :
 *   • years ≤ 10 → Yahoo /fundamentals-timeseries (rapide, ~500 KB)
 *                  Fallback Finnhub si Yahoo renvoie < 4 points
 *   • years > 10 → Finnhub /stock/financials-reported direct (historique plus profond)
 *
 * Cache :
 *   • TTL ≈ prochaine date d'earnings du ticker + 1 jour (typique 2-3 mois)
 *   • Fallback 24 h si date d'earnings inconnue
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { getReportedTimeseries, METRICS, type MetricKey } from '../services/finnhubFundamentals.js';
import { getYahooMetricTimeseries } from '../services/yahoo.js';
import { getNextEarningsDate, ttlUntilNextEarnings } from '../services/earnings.js';
import * as cache from '../lib/timeseriesCache.js';

export const timeseriesRouter: Router = Router();

const TickerSchema = z.string().trim().toUpperCase().regex(/^[A-Z.\-]{1,8}$/);
const MetricSchema = z.string().refine((v): v is MetricKey => v in METRICS, { message: 'metric inconnu' });
const FreqSchema = z.enum(['quarterly', 'annual']).default('quarterly');
const YearsSchema = z.coerce.number().int().min(1).max(50).default(5);

/**
 * Yahoo /fundamentals-timeseries plafonne à ~5 points quarterly quelle que soit
 * la fenêtre demandée. Donc utile uniquement pour 1Y quarterly (où on attend 4 pts).
 * Au-delà, on tape Finnhub directement (qui a 10-15 ans d'historique).
 */
const YAHOO_MAX_YEARS_QUARTERLY = 1;

/** Calcule le nombre minimum de points attendus pour valider la source */
function minPointsExpected(freq: 'quarterly' | 'annual', years: number): number {
  if (freq === 'quarterly') return Math.max(Math.floor(years * 3), 3); // 3 trimestres/an minimum
  return Math.max(years - 1, 2);
}

timeseriesRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const t = TickerSchema.safeParse(req.query.ticker);
  const m = MetricSchema.safeParse(req.query.metric);
  const f = FreqSchema.safeParse(req.query.freq ?? 'quarterly');
  const y = YearsSchema.safeParse(req.query.years ?? '5');
  if (!t.success || !m.success || !f.success || !y.success) {
    throw new ApiError(400, 'Paramètres invalides', {
      ticker: t.success ? 'ok' : 'invalid',
      metric: m.success ? 'ok' : `invalid (valeurs possibles : ${Object.keys(METRICS).join(', ')})`,
      freq: f.success ? 'ok' : 'invalid (quarterly | annual)',
      years: y.success ? 'ok' : 'invalid (1-50)',
    });
  }
  const ticker = t.data;
  const metric = m.data;
  const freq = f.data;
  const years = y.data;
  const key = cache.cacheKey(ticker, metric, freq, years);

  // ─── 1. Cache hit ? ────────────────────────────────────────────
  const hit = cache.get(key);
  if (hit) {
    res.json({
      ticker, metric, freq, years,
      points: hit.points,
      source: hit.source,
      cached: true,
      ageMs: Date.now() - hit.storedAt,
    });
    return;
  }

  // ─── 2. Cache miss : on fetch + on calcule le TTL en parallèle ──
  const earningsPromise = getNextEarningsDate(ticker);
  const startedAt = Date.now();

  // Décide la source :
  //   • quarterly 1Y → Yahoo (rapide, exact, 4 points)
  //   • tout le reste → Finnhub direct (le cache compensera)
  const useYahooPrimary = freq === 'quarterly' && years <= YAHOO_MAX_YEARS_QUARTERLY;
  const minPoints = minPointsExpected(freq, years);

  let points = [] as Awaited<ReturnType<typeof getReportedTimeseries>>;
  let source: 'yahoo' | 'finnhub' = 'finnhub';

  if (useYahooPrimary) {
    points = await getYahooMetricTimeseries(ticker, metric, years);
    source = 'yahoo';
    if (points.length < minPoints) {
      console.log(`[timeseries ${ticker}/${metric}] Yahoo a renvoyé ${points.length} pts (< ${minPoints} attendus) → fallback Finnhub`);
      points = await getReportedTimeseries(ticker, metric, freq, years);
      source = 'finnhub';
    }
  } else {
    points = await getReportedTimeseries(ticker, metric, freq, years);
    source = 'finnhub';
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`[timeseries ${ticker}/${metric}] ${source} OK ${points.length} pts en ${elapsedMs}ms`);

  // ─── 3. Calcule le TTL basé sur les earnings ───────────────────
  const nextEarnings = await earningsPromise;
  const ttlMs = ttlUntilNextEarnings(nextEarnings);
  cache.set(key, points, source, ttlMs);

  res.json({
    ticker, metric, freq, years,
    points,
    source,
    cached: false,
    fetchedInMs: elapsedMs,
    cacheTtlHours: Math.round(ttlMs / 3_600_000),
    nextEarnings,
  });
}));
