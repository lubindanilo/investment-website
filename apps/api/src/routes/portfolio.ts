/**
 * /api/portfolio — portefeuille personnel suivi (page « Stratégie portefeuille », PRIVÉE).
 * Réservé au compte propriétaire (requireAuth + requireOwner). Achats/ventes saisis à la main.
 *
 *   GET    /api/portfolio/positions        → liste des positions du propriétaire
 *   POST   /api/portfolio/positions        → ajoute un achat { ticker, buyDate, buyPrice, note? }
 *   PATCH  /api/portfolio/positions/:id     → clôture une position { sellDate, sellPrice }
 *   DELETE /api/portfolio/positions/:id     → supprime une position
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { PortfolioPositionDTO } from '@lubin/shared';
import { prisma } from '../db/client.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOwner } from '../middleware/owner.js';

export const portfolioRouter: Router = Router();
portfolioRouter.use(requireAuth, requireOwner);

const TickerSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9.\-]{1,15}$/);
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');
const AddSchema = z.object({
  ticker: TickerSchema,
  buyDate: DateSchema,
  buyPrice: z.number().positive(),
  note: z.string().trim().max(500).optional(),
});
const CloseSchema = z.object({ sellDate: DateSchema, sellPrice: z.number().positive() });

type Row = { id: string; ticker: string; buyDate: string; buyPrice: number; sellDate: string | null; sellPrice: number | null; note: string | null };
const toDTO = (p: Row): PortfolioPositionDTO => ({
  id: p.id, ticker: p.ticker, buyDate: p.buyDate, buyPrice: p.buyPrice,
  sellDate: p.sellDate, sellPrice: p.sellPrice, note: p.note,
});

portfolioRouter.get('/positions', asyncHandler(async (req: Request, res: Response) => {
  const rows = await prisma.portfolioPosition.findMany({
    where: { userId: req.user!.userId },
    orderBy: [{ sellDate: { sort: 'asc', nulls: 'first' } }, { buyDate: 'desc' }],
  });
  res.json(rows.map(toDTO));
}));

portfolioRouter.post('/positions', asyncHandler(async (req: Request, res: Response) => {
  const p = AddSchema.parse(req.body);
  const row = await prisma.portfolioPosition.create({
    data: { userId: req.user!.userId, ticker: p.ticker, buyDate: p.buyDate, buyPrice: p.buyPrice, note: p.note ?? null },
  });
  res.status(201).json(toDTO(row));
}));

portfolioRouter.patch('/positions/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const p = CloseSchema.parse(req.body);
  const existing = await prisma.portfolioPosition.findFirst({ where: { id, userId: req.user!.userId } });
  if (!existing) throw new ApiError(404, 'Position introuvable');
  if (p.sellDate < existing.buyDate) throw new ApiError(400, 'La date de vente est antérieure à l\'achat');
  const row = await prisma.portfolioPosition.update({ where: { id: existing.id }, data: { sellDate: p.sellDate, sellPrice: p.sellPrice } });
  res.json(toDTO(row));
}));

portfolioRouter.delete('/positions/:id', asyncHandler(async (req: Request, res: Response) => {
  await prisma.portfolioPosition.deleteMany({ where: { id: String(req.params.id), userId: req.user!.userId } });
  res.json({ ok: true });
}));
