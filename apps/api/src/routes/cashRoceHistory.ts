/**
 * GET /api/cash-roce-history?ticker=BKNG&years=5
 *   → renvoie la timeseries Cash ROCE = FCF_adj / (Equity + Debt)
 *
 * Calcul join FCF_adj_TTM (Finnhub quarterly, rolling) avec equity + totalDebt
 * snapshot par quarter (Finnhub financials-reported). EU/ADRs : annual Yahoo.
 * Cache earnings-based (réutilise timeseriesCache, comme pfcfHistory).
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePro } from '../middleware/subscription.js';
import { getCashRoceHistory } from '../services/cashRoceHistory.js';
import { getNextEarningsDate, ttlUntilNextEarnings } from '../services/earnings.js';
import * as cache from '../lib/timeseriesCache.js';

export const cashRoceHistoryRouter: Router = Router();

const TickerSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9.\-]{1,15}$/);
const YearsSchema = z.coerce.number().int().min(1).max(50).default(5);

// Graphique détaillé du Cash ROCE (rendement du capital) — Pro only.
cashRoceHistoryRouter.get('/', requireAuth, requirePro, asyncHandler(async (req: Request, res: Response) => {
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
  // Cache key dédié — namespace différent de pfcf-history pour éviter collisions.
  // Génération partagée (cf FCF_CHART_GENERATION) : le Cash ROCE a le FCF ajusté au numérateur,
  // sa stratégie de source ET la formule du FCF doivent donc l'invalider. Générations manuelles
  // précédentes : 'computed' (origine), 'computed2' (contiguïté TTM + refus de la colonne USD
  // d'EDGAR), 'computed3' (repli annuel sur le store enrichi EDGAR, profondeur 14-18 exercices
  // pour les ADR 20-F), 'computed4' (chemin EU intra-annuel, cf. l'oubli de #281 rattrapé par #284).
  const key = cache.cacheKey(ticker, 'cash-roce-history', `computed-${cache.FCF_CHART_GENERATION}`, years);

  const hit = await cache.get(key);
  if (hit) {
    res.json({
      ticker,
      years,
      points: hit.points.map(p => ({ date: p.date, cashRoce: p.value })),
      freq: hit.servedFreq ?? 'quarterly',
      annualOnly: hit.servedFreq === 'annual',
      cached: true,
      ageMs: Date.now() - hit.storedAt,
    });
    return;
  }

  const startedAt = Date.now();
  const earningsPromise = getNextEarningsDate(ticker);
  const { points, freq } = await getCashRoceHistory(ticker, years);
  const elapsedMs = Date.now() - startedAt;

  const nextEarnings = await earningsPromise;
  const ttlMs = ttlUntilNextEarnings(nextEarnings);
  await cache.set(
    key,
    points.map(p => ({ date: p.date, value: p.cashRoce })),
    'finnhub',
    ttlMs,
    { servedFreq: freq },
  );

  res.json({
    ticker,
    years,
    points,
    // Granularité servie, remontée telle quelle à l'UI : elle s'en sert pour étiqueter les
    // points (exercice vs trimestre) et non plus pour masquer les boutons de période, qui
    // restent offerts à tous les titres. Vaut aussi pour les ADR 20-F cotant en USD, que la
    // détection page-level (`fundamentalsSource === 'yahoo'`) classait à tort en trimestriel.
    freq,
    annualOnly: freq === 'annual',
    cached: false,
    fetchedInMs: elapsedMs,
    cacheTtlHours: Math.round(ttlMs / 3_600_000),
  });
}));
