/**
 * /api/screener — veille quantitative automatique.
 *
 *   POST /api/screener/seed?region=US   → ingère l'univers (protégé par secret)
 *   POST /api/screener/tick?n=10        → note un lot de tickers dus (protégé par secret)
 *   GET  /api/screener/top              → meilleures notes (lecture publique)
 *   GET  /api/screener/stats            → progression de la veille (lecture publique)
 *
 * Les endpoints d'écriture (seed/tick) sont appelés par un cron externe (GitHub Actions)
 * et protégés par un header `x-screener-token` = env SCREENER_TOKEN. Fail-closed : si le
 * secret n'est pas configuré, ils sont refusés.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import type { TickerSuggestion } from '@lubin/shared';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { seedRegion, tick, getTop, getStats, getSectors, refreshOpportunitiesLive } from '../services/screener.js';
import { getMarketBeat, getForwardCompare } from '../services/marketBeat.js';
import { prisma } from '../db/client.js';

export const screenerRouter: Router = Router();

/** Garde : exige le secret partagé. Refuse si SCREENER_TOKEN absent côté serveur. */
function requireScreenerToken(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env.SCREENER_TOKEN;
  if (!expected) { next(new ApiError(503, 'Screener non configuré', 'SCREENER_TOKEN manquant côté serveur')); return; }
  const got = req.header('x-screener-token');
  if (got !== expected) { next(new ApiError(401, 'Non autorisé')); return; }
  next();
}

// ── POST /seed?region=US ────────────────────────────────────────────────────
screenerRouter.post('/seed', requireScreenerToken, asyncHandler(async (req: Request, res: Response) => {
  const region = String(req.query.region ?? 'US').toUpperCase();
  const result = await seedRegion(region);
  res.json(result);
}));

// ── POST /tick?n=10 ─────────────────────────────────────────────────────────
screenerRouter.post('/tick', requireScreenerToken, asyncHandler(async (req: Request, res: Response) => {
  const n = Math.max(1, Math.min(Number(req.query.n ?? 10) || 10, 25));
  const result = await tick(n);
  res.json(result);
}));

// ── GET /top ────────────────────────────────────────────────────────────────
screenerRouter.get('/top', asyncHandler(async (req: Request, res: Response) => {
  const num = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const sectors = typeof req.query.sector === 'string' && req.query.sector.trim()
    ? req.query.sector.split(',').map(s => s.trim()).filter(Boolean)
    : undefined;
  const onlyOpportunities = req.query.opportunities === 'true';
  // Vue « opportunités » : on ré-évalue le flag AU PRIX DU JOUR avant de filtrer (auto-throttlé
  // ~10 min). La pépite dépend du cours → on ne veut pas servir un flag figé au dernier earnings.
  // Best-effort : si Yahoo flanche, on sert les flags en cache.
  if (onlyOpportunities) {
    await refreshOpportunitiesLive().catch(() => {});
  }
  const rows = await getTop({
    minRatio: num(req.query.minRatio),
    maxPfcf: num(req.query.maxPfcf),
    minMax: num(req.query.minMax),
    limit: num(req.query.limit),
    onlyOpportunities,
    sectors,
  });
  res.json(rows);
}));

// ── GET /market-beat (panier value+momentum « bat le marché », lecture publique) ──
screenerRouter.get('/market-beat', asyncHandler(async (req: Request, res: Response) => {
  const num = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const u = req.query.universe;
  const rows = await getMarketBeat({
    topPct: num(req.query.topPct) ?? 0.5,
    nPicks: num(req.query.n) ?? 20,
    universe: u === 'ALL' ? 'ALL' : u === 'US' ? 'US' : 'SP500',
  });
  res.json(rows);
}));

// ── GET /forward-compare (suivi forward : ma sélection vs value+momentum vs S&P500) ──
screenerRouter.get('/forward-compare', asyncHandler(async (_req: Request, res: Response) => {
  res.json(await getForwardCompare());
}));

// ── GET /sectors (industries distinctes pour le filtre) ──────────────────────
screenerRouter.get('/sectors', asyncHandler(async (_req: Request, res: Response) => {
  res.json(await getSectors());
}));

// ── GET /stats ──────────────────────────────────────────────────────────────
screenerRouter.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  res.json(await getStats());
}));

// ── GET /search?q=app ─────────────────────────────────────────────────────────
// Autocomplétion (sélecteur de comparaison) : titres scorés dont le ticker ou le nom
// matche. Priorité au ticker exact/préfixe, puis aux mieux notés.
screenerRouter.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 1) { res.json([] as TickerSuggestion[]); return; }
  const rows = await prisma.screenerTicker.findMany({
    where: {
      status: 'scored',
      OR: [
        { ticker: { startsWith: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: [{ scoreRatio: 'desc' }],
    take: 8,
    select: { ticker: true, name: true, sector: true, scoreChiffres: true, scoreChiffresMax: true },
  });
  // Remonte les préfixes exacts de ticker en tête (UX recherche).
  const qu = q.toUpperCase();
  rows.sort((a, b) => Number(b.ticker.startsWith(qu)) - Number(a.ticker.startsWith(qu)));
  res.json(rows as TickerSuggestion[]);
}));
