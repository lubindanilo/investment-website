/**
 * GET /api/ccc-history?ticker=AAPL&years=5
 *
 * Renvoie l'historique du Cash Conversion Cycle (CCC = DSO + DIO − DPO) sur N années, avec
 * la décomposition par trimestre. Sert le graphique d'historique CCC (barres empilées + ligne).
 *
 * Réutilise computeCccSeries qui lit le store FundamentalsSeries → quasi instantané quand
 * les séries trimestrielles sont déjà persistées.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getCccHistory } from '../services/cccHistory.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePro } from '../middleware/subscription.js';
import { analyzeLimiter } from '../middleware/rateLimit.js';

export const cccHistoryRouter: Router = Router();

const Schema = z.object({
  ticker: z.string().trim().toUpperCase().regex(/^[A-Z0-9.\-]{1,15}$/),
  years:  z.coerce.number().int().min(1).max(20).default(5),
});

// Graphique détaillé du cycle de conversion du cash — Pro only.
cccHistoryRouter.get('/', analyzeLimiter, requireAuth, requirePro, asyncHandler(async (req: Request, res: Response) => {
  const parsed = Schema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, 'Paramètres invalides', parsed.error.flatten());
  const { ticker, years } = parsed.data;

  const r = await getCccHistory(ticker, Math.max(years + 1, 6));
  res.json({
    ticker,
    points: r.points,
    slopeDaysPerYear: r.slopeDaysPerYear,
    approximated: ('approximated' in r ? (r as { approximated?: boolean }).approximated : false) ?? false,
    hasInventory: r.hasInventory,
    reason: r.reason,
  });
}));
