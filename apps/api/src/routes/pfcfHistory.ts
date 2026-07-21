/**
 * GET /api/pfcf-history?ticker=BKNG&years=5
 *   → renvoie la timeseries P/FCF computée
 *
 * Le calcul join price (Yahoo, daily/weekly/monthly selon la fenêtre) avec
 * shares et TTM FCF (Finnhub quarterly + split-adjusté). Cache earnings-based
 * (réutilise le même mécanisme que /api/timeseries).
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePro } from '../middleware/subscription.js';
import { getPfcfHistory, getPfcfNegativeIntervals } from '../services/pfcfHistory.js';
import { getNextEarningsDate, ttlUntilNextEarnings } from '../services/earnings.js';
import * as cache from '../lib/timeseriesCache.js';

export const pfcfHistoryRouter: Router = Router();

const TickerSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9.\-]{1,15}$/);
const YearsSchema = z.coerce.number().int().min(1).max(50).default(5);

// Graphique détaillé P/FCF — Pro only.
pfcfHistoryRouter.get('/', requireAuth, requirePro, asyncHandler(async (req: Request, res: Response) => {
  const t = TickerSchema.safeParse(req.query.ticker);
  const y = YearsSchema.safeParse(req.query.years ?? '5');
  if (!t.success || !y.success) {
    throw new ApiError(400, 'Paramètres invalides', {
      ticker: t.success ? 'ok' : 'invalid',
      years: y.success ? 'ok' : 'invalid (1-50)',
    });
  }
  const ticker = t.data;
  const years = y.data;
  // On stocke dans le même cache que timeseries en utilisant un "metric" virtuel "pfcf-history"
  const key = cache.cacheKey(ticker, 'pfcf-history', 'computed-adj', years);

  // 1. Cache hit ? (les intervalles FCF négatif sont recalculés à la volée — lecture DB légère,
  //    pas d'appel Yahoo — pour ne pas alourdir le cache typé TimeseriesPoint.)
  const hit = await cache.get(key);
  if (hit) {
    const negativeFcfIntervals = await getPfcfNegativeIntervals(ticker, years).catch(() => []);
    res.json({
      ticker,
      years,
      // points sont stockés en TimeseriesPoint mais on les présente en {date, pfcf} pour le client
      points: hit.points.map(p => ({ date: p.date, pfcf: p.value })),
      negativeFcfIntervals,
      cached: true,
      ageMs: Date.now() - hit.storedAt,
    });
    return;
  }

  // 2. Fetch + compute
  const startedAt = Date.now();
  const earningsPromise = getNextEarningsDate(ticker);
  const [points, negativeFcfIntervals] = await Promise.all([
    getPfcfHistory(ticker, years),
    getPfcfNegativeIntervals(ticker, years).catch(() => []),
  ]);
  const elapsedMs = Date.now() - startedAt;

  // 3. TTL basé sur le prochain earnings — un nouveau Q recalcule TTM_FCF
  const nextEarnings = await earningsPromise;
  const ttlMs = ttlUntilNextEarnings(nextEarnings);
  // Adaptation au cache typé TimeseriesPoint : on stocke pfcf dans value
  await cache.set(
    key,
    points.map(p => ({ date: p.date, value: p.pfcf })),
    'finnhub', // source virtuelle, juste pour les logs
    ttlMs,
  );

  res.json({
    ticker,
    years,
    points,
    negativeFcfIntervals,
    cached: false,
    fetchedInMs: elapsedMs,
    cacheTtlHours: Math.round(ttlMs / 3_600_000),
  });
}));
