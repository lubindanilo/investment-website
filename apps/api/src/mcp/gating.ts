/**
 * Gating membre / Pro pour les tools MCP.
 *
 * Réutilise la MÊME source de vérité que le site (`isProActive`) et la même logique
 * de quota que `enforceDailyAnalysisQuota` (fenêtre glissante 24 h, 10 analyses/jour
 * en Free). Le statut est chargé une fois par requête et passé aux handlers de tools.
 */
import { prisma } from '../db/client.js';
import { isProActive } from '../services/stripe.js';

/** Comparaison : 2 titres max en Free/membre, 5 en Pro (mêmes valeurs que /api/compare). */
export const FREE_MAX_COMPARE = 2;
export const MAX_COMPARE = 5;

const FREE_DAILY_ANALYSIS_LIMIT = 10;
const RESET_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface McpContext {
  userId: string;
  email: string;
  isPro: boolean;
  /** Origine publique du site — sert à construire le lien d'upgrade des messages d'upsell. */
  baseUrl: string;
}

/** Charge le contexte MCP (statut Pro) à partir de l'utilisateur authentifié. */
export async function loadMcpContext(
  auth: { userId: string; email: string },
  baseUrl: string,
): Promise<McpContext> {
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { subscriptionStatus: true, subscriptionCurrentPeriodEnd: true },
  });
  return { userId: auth.userId, email: auth.email, isPro: user ? isProActive(user) : false, baseUrl };
}

export interface QuotaResult {
  ok: boolean;
  used?: number;
  limit?: number;
  resetInMinutes?: number;
}

/**
 * Décompte une analyse pour un membre Free (incrément atomique, reset glissant 24 h).
 * Les Pro passent sans décompte. Miroir de `enforceDailyAnalysisQuota` côté HTTP.
 */
export async function consumeAnalysisQuota(userId: string): Promise<QuotaResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      subscriptionCurrentPeriodEnd: true,
      dailyAnalysisCount: true,
      dailyAnalysisResetAt: true,
    },
  });
  if (!user) return { ok: false };
  if (isProActive(user)) return { ok: true };

  const now = Date.now();
  const elapsed = now - user.dailyAnalysisResetAt.getTime();

  if (elapsed >= RESET_WINDOW_MS) {
    await prisma.user.update({
      where: { id: userId },
      data: { dailyAnalysisCount: 1, dailyAnalysisResetAt: new Date(now) },
    });
    return { ok: true };
  }
  if (user.dailyAnalysisCount >= FREE_DAILY_ANALYSIS_LIMIT) {
    return {
      ok: false,
      used: user.dailyAnalysisCount,
      limit: FREE_DAILY_ANALYSIS_LIMIT,
      resetInMinutes: Math.ceil((RESET_WINDOW_MS - elapsed) / 60000),
    };
  }
  await prisma.user.update({
    where: { id: userId },
    data: { dailyAnalysisCount: { increment: 1 } },
  });
  return { ok: true };
}
