/**
 * Routes de billing : checkout, portail, lecture du statut d'abonnement.
 *
 *   POST /api/billing/checkout      → crée une Checkout Session, renvoie son URL
 *   POST /api/billing/portal        → crée une Portal Session (gérer l'abonnement)
 *   GET  /api/me/subscription       → lit le statut courant (statut, plan, fin de période)
 *
 * Le webhook Stripe est dans une route SÉPARÉE (apps/api/src/routes/stripeWebhook.ts)
 * car il ne doit PAS passer par express.json() (signature calculée sur le raw body).
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import {
  createCheckoutSession,
  createPortalSession,
  isProActive,
  isStripeConfigured,
} from '../services/stripe.js';

export const billingRouter: Router = Router();

// ─── POST /api/billing/checkout ───────────────────────────────────────────────
const CheckoutBody = z.object({ plan: z.enum(['monthly', 'yearly']) });

billingRouter.post(
  '/checkout',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!isStripeConfigured()) {
      res.status(503).json({ error: 'Paiements non configurés sur cet environnement' });
      return;
    }
    const parsed = CheckoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Plan invalide (monthly | yearly)' });
      return;
    }
    const { plan } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, stripeCustomerId: true },
    });
    if (!user) { res.status(401).json({ error: 'Utilisateur introuvable' }); return; }

    const { url } = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
      plan,
    });
    res.json({ url });
  }),
);

// ─── POST /api/billing/portal ─────────────────────────────────────────────────
billingRouter.post(
  '/portal',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!isStripeConfigured()) {
      res.status(503).json({ error: 'Paiements non configurés sur cet environnement' });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: 'Pas encore d\'abonnement à gérer' });
      return;
    }
    const { url } = await createPortalSession({ stripeCustomerId: user.stripeCustomerId });
    res.json({ url });
  }),
);

// ─── GET /api/me/subscription ────────────────────────────────────────────────
// Frontend lit son statut au mount pour décider quoi afficher (UI freemium).
export const meRouter: Router = Router();

meRouter.get(
  '/subscription',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionCurrentPeriodEnd: true,
        stripeCustomerId: true,
        dailyAnalysisCount: true,
        dailyAnalysisResetAt: true,
      },
    });
    if (!user) { res.status(401).json({ error: 'Utilisateur introuvable' }); return; }

    // Recalcule la fenêtre 24h : si reset > 24h, on remet le compteur à 0 côté DB pour
    // la requête suivante. Ici on renvoie déjà la valeur effective (0 si fenêtre périmée)
    // sans bloquer pour faire un update.
    const resetMs = user.dailyAnalysisResetAt.getTime();
    const elapsedHours = (Date.now() - resetMs) / 3_600_000;
    const effectiveCount = elapsedHours >= 24 ? 0 : user.dailyAnalysisCount;

    const isPro = isProActive({
      subscriptionStatus: user.subscriptionStatus,
      subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
    });

    res.json({
      isPro,
      status: user.subscriptionStatus,
      plan: user.subscriptionPlan,
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd?.toISOString() ?? null,
      hasCustomer: !!user.stripeCustomerId,
      dailyAnalysisCount: effectiveCount,
      dailyAnalysisLimit: 10,
    });
  }),
);
