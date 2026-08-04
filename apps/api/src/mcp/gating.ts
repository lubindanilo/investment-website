/**
 * Gating membre / Pro pour les tools MCP.
 *
 * Réutilise la MÊME source de vérité que le site (`isProActive`) et la même logique
 * de quota que `enforceDailyAnalysisQuota` (fenêtre glissante 24 h, 10 analyses/jour
 * en Free). Le statut est chargé une fois par requête et passé aux handlers de tools.
 */
import { prisma } from '../db/client.js';
import { effectiveSeoTier, isProActive, type SeoTier } from '../services/stripe.js';

/** Comparaison : 2 titres max en Free/membre, 5 en Pro (mêmes valeurs que /api/compare). */
export const FREE_MAX_COMPARE = 2;
export const MAX_COMPARE = 5;

const FREE_DAILY_ANALYSIS_LIMIT = 10;
const RESET_WINDOW_MS = 24 * 60 * 60 * 1000;

// ─── Offre SEO : plafonds par palier ─────────────────────────────────────────

/**
 * Audits complets par fenêtre de 30 jours. `null` = illimité.
 *
 * Le test de visibilité IA n'apparaît PAS ici, volontairement : c'est l'outil
 * d'acquisition, il reste gratuit et illimité pour tout le monde, y compris sans compte.
 * Rationner l'hameçon serait rationner sa propre distribution.
 */
export const AUDITS_PER_MONTH: Record<SeoTier, number | null> = {
  free: 1,
  solo: null,
  studio: null,
  agency: null,
};

/**
 * Pages examinées par audit.
 *
 * C'est le plafond qui se défend le mieux commercialement : il correspond à un coût
 * serveur réel (chaque page = deux requêtes sortantes), pas à une restriction inventée.
 */
export const CRAWL_PAGE_CAP: Record<SeoTier, number> = {
  free: 25,
  solo: 500,
  studio: 5_000,
  agency: 50_000,
};

/** Nombre de sites distincts suivis dans l'historique. `null` = illimité. */
export const SITES_TRACKED: Record<SeoTier, number | null> = {
  free: 0, // pas d'historique du tout
  solo: 1,
  studio: 10,
  agency: null,
};

/** Historique avant/après et courbes. */
export const HAS_HISTORY: Record<SeoTier, boolean> = {
  free: false, solo: true, studio: true, agency: true,
};

/** Comparatif sectoriel (médiane par stack et par taille). */
export const HAS_BENCHMARK: Record<SeoTier, boolean> = {
  free: false, solo: false, studio: true, agency: true,
};

/** Rapport en marque blanche. */
export const HAS_WHITE_LABEL: Record<SeoTier, boolean> = {
  free: false, solo: false, studio: false, agency: true,
};

const AUDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface McpContext {
  userId: string;
  email: string;
  isPro: boolean;
  /** Palier de l'offre SEO, déjà ramené à `free` si l'abonnement n'est plus honoré. */
  seoTier: SeoTier;
  /** Origine publique du site — sert à construire le lien d'upgrade des messages d'upsell. */
  baseUrl: string;
}

/** Charge le contexte MCP (statut Pro + palier SEO) à partir de l'utilisateur authentifié. */
export async function loadMcpContext(
  auth: { userId: string; email: string },
  baseUrl: string,
): Promise<McpContext> {
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { subscriptionStatus: true, subscriptionCurrentPeriodEnd: true, seoTier: true },
  });
  return {
    userId: auth.userId,
    email: auth.email,
    isPro: user ? isProActive(user) : false,
    seoTier: user ? effectiveSeoTier(user) : 'free',
    baseUrl,
  };
}

/**
 * Décompte un audit complet sur la fenêtre glissante de 30 jours.
 *
 * Miroir exact de `consumeAnalysisQuota` : reset paresseux au premier appel arrivant après
 * expiration (pas de cron), incrément atomique, et les paliers payants passent sans
 * décompte. À appeler AVANT de lancer le crawl, pas après — un audit qui échoue en cours
 * de route a déjà coûté les requêtes sortantes.
 */
export async function consumeAuditQuota(userId: string): Promise<QuotaResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      subscriptionCurrentPeriodEnd: true,
      seoTier: true,
      monthlyAuditCount: true,
      monthlyAuditResetAt: true,
    },
  });
  if (!user) return { ok: false };

  const tier = effectiveSeoTier(user);
  const limit = AUDITS_PER_MONTH[tier];
  if (limit === null) return { ok: true };

  const now = Date.now();
  const elapsed = now - user.monthlyAuditResetAt.getTime();

  if (elapsed >= AUDIT_WINDOW_MS) {
    await prisma.user.update({
      where: { id: userId },
      data: { monthlyAuditCount: 1, monthlyAuditResetAt: new Date(now) },
    });
    return { ok: true };
  }
  if (user.monthlyAuditCount >= limit) {
    return {
      ok: false,
      used: user.monthlyAuditCount,
      limit,
      resetInMinutes: Math.ceil((AUDIT_WINDOW_MS - elapsed) / 60000),
    };
  }
  await prisma.user.update({
    where: { id: userId },
    data: { monthlyAuditCount: { increment: 1 } },
  });
  return { ok: true };
}

/**
 * Message d'upsell d'un quota d'audit épuisé. Dit ce qui est atteint, quand ça se libère,
 * et où passer au palier suivant — jamais un simple « refusé ».
 */
export function auditQuotaMessage(q: QuotaResult, baseUrl: string): string {
  const days = q.resetInMinutes ? Math.ceil(q.resetInMinutes / 1440) : null;
  return [
    `Quota d'audits atteint : ${q.used ?? '?'} sur ${q.limit ?? '?'} pour la fenêtre de 30 jours.`,
    days ? `Il se libère dans ${days} jour${days > 1 ? 's' : ''}.` : null,
    `Le test de visibilité IA reste gratuit et illimité : ${baseUrl}/visibilite-ia`,
    `Audits illimités à partir du palier Solo : ${baseUrl}/pricing`,
  ].filter(Boolean).join(' ');
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
