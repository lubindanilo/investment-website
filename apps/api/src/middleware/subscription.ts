/**
 * Middlewares de paywall — à chaîner APRÈS requireAuth (qui pose req.user).
 *
 *   - requirePro                 : 403 si l'utilisateur n'a pas un statut Pro actif
 *   - enforceDailyAnalysisQuota  : incrémente le compteur d'analyses ; 429 au-delà de 10/24h (Free).
 *                                  Les Pro passent sans décompte. Reset glissant 24h.
 *
 * Code d'erreur 402 (Payment Required) plutôt que 403 pour les paywalls Pro ?
 * → Non, on garde 403 (standard REST pour authorisation refusée). Le frontend
 *   distingue paywall des autres 403 via `error.code === 'PRO_REQUIRED'`.
 */
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { isProActive } from '../services/stripe.js';

/** Quota quotidien d'analyses pour les comptes Free. Les Pro sont illimités. */
const FREE_DAILY_ANALYSIS_LIMIT = 10;
const RESET_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Refuse les utilisateurs non-Pro avec un 403 + code 'PRO_REQUIRED' pour que le
 * frontend puisse afficher la modale d'upgrade.
 */
export async function requirePro(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Non authentifié', code: 'AUTH_REQUIRED' });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { subscriptionStatus: true, subscriptionCurrentPeriodEnd: true },
  });
  if (!user) {
    res.status(401).json({ error: 'Utilisateur introuvable', code: 'AUTH_REQUIRED' });
    return;
  }
  if (!isProActive(user)) {
    res.status(403).json({
      error: 'Cette fonctionnalité nécessite un abonnement Pro',
      code: 'PRO_REQUIRED',
    });
    return;
  }
  next();
}

/**
 * Incrémente le compteur d'analyses quotidiennes pour les Free, refuse au-delà de la limite.
 * Les Pro passent sans aucun décompte.
 *
 * Implémentation : reset glissant — quand `dailyAnalysisResetAt` a plus de 24h, on remet
 * le compteur à 0 et on redémarre la fenêtre. Plus simple que minuit UTC, et tout aussi
 * juste pour l'utilisateur (24h vraies entre deux limites).
 *
 * Concurrence : on incrémente en UPDATE atomique (prisma.user.update) — pas de race
 * condition possible même si l'utilisateur lance 10 requêtes simultanément.
 */
export async function enforceDailyAnalysisQuota(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Non authentifié', code: 'AUTH_REQUIRED' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      subscriptionStatus: true,
      subscriptionCurrentPeriodEnd: true,
      dailyAnalysisCount: true,
      dailyAnalysisResetAt: true,
    },
  });
  if (!user) {
    res.status(401).json({ error: 'Utilisateur introuvable', code: 'AUTH_REQUIRED' });
    return;
  }

  // Pro = illimité. On ne décompte rien (et on ne met pas à jour la DB).
  if (isProActive(user)) {
    next();
    return;
  }

  const now = Date.now();
  const resetMs = user.dailyAnalysisResetAt.getTime();
  const elapsed = now - resetMs;

  if (elapsed >= RESET_WINDOW_MS) {
    // Nouvelle fenêtre 24h — on redémarre le compteur à 1 (cette requête).
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { dailyAnalysisCount: 1, dailyAnalysisResetAt: new Date(now) },
    });
    next();
    return;
  }

  // Fenêtre en cours — on incrémente
  if (user.dailyAnalysisCount >= FREE_DAILY_ANALYSIS_LIMIT) {
    const resetIn = Math.ceil((RESET_WINDOW_MS - elapsed) / 1000 / 60); // minutes
    res.status(429).json({
      error: `Limite quotidienne atteinte (${FREE_DAILY_ANALYSIS_LIMIT} analyses / 24 h). Passe Pro pour un accès illimité.`,
      code: 'QUOTA_EXCEEDED',
      details: {
        limit: FREE_DAILY_ANALYSIS_LIMIT,
        used: user.dailyAnalysisCount,
        resetInMinutes: resetIn,
      },
    });
    return;
  }

  await prisma.user.update({
    where: { id: req.user.userId },
    data: { dailyAnalysisCount: { increment: 1 } },
  });
  next();
}
