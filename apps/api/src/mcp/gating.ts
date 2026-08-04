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
    select: { subscriptionStatus: true, subscriptionCurrentPeriodEnd: true, seoTier: true },
  });
  if (!user) return { ok: false };

  const limit = AUDITS_PER_MONTH[effectiveSeoTier(user)];
  if (limit === null) return { ok: true };
  return consumeWindowedQuota({ userId, limit, windowMs: AUDIT_WINDOW_MS, kind: 'audit' });
}

/**
 * Décompte ATOMIQUE sur une fenêtre glissante, commun aux deux quotas.
 *
 * Le motif naïf — lire le compteur, comparer à la limite, puis incrémenter — laisse passer
 * autant de requêtes qu'il y en a en parallèle : dix appels simultanés lisent tous 0 et
 * passent tous, sur un plan qui autorise un seul audit. Sur un endpoint payant c'est un
 * contournement trivial du palier gratuit.
 *
 * On fait donc porter la CONDITION par la requête d'écriture elle-même, en deux temps :
 *
 *   1. Réarmement de la fenêtre, conditionné sur `resetAt < début de fenêtre`. Postgres
 *      sérialise les UPDATE concurrents sur la même ligne : le premier passe et repose
 *      `resetAt = maintenant`, les suivants ne matchent plus et affectent 0 ligne.
 *   2. Incrément conditionné sur `count < limite`. Même sérialisation, donc jamais plus de
 *      `limite` incréments réussis dans la fenêtre.
 *
 * `count === 1` identifie donc le gagnant sans transaction explicite ni verrou applicatif.
 */
async function consumeWindowedQuota(opts: {
  userId: string;
  limit: number;
  windowMs: number;
  kind: 'analysis' | 'audit';
}): Promise<QuotaResult> {
  const { userId, limit, windowMs, kind } = opts;
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  // 1. La fenêtre est-elle expirée ? Si oui, un seul concurrent la réarme.
  const reset = kind === 'audit'
    ? await prisma.user.updateMany({
        where: { id: userId, monthlyAuditResetAt: { lt: windowStart } },
        data: { monthlyAuditCount: 1, monthlyAuditResetAt: now },
      })
    : await prisma.user.updateMany({
        where: { id: userId, dailyAnalysisResetAt: { lt: windowStart } },
        data: { dailyAnalysisCount: 1, dailyAnalysisResetAt: now },
      });
  if (reset.count === 1) return { ok: true };

  // 2. Fenêtre courante : incrément conditionné sur la limite.
  const bumped = kind === 'audit'
    ? await prisma.user.updateMany({
        where: { id: userId, monthlyAuditCount: { lt: limit } },
        data: { monthlyAuditCount: { increment: 1 } },
      })
    : await prisma.user.updateMany({
        where: { id: userId, dailyAnalysisCount: { lt: limit } },
        data: { dailyAnalysisCount: { increment: 1 } },
      });
  if (bumped.count === 1) return { ok: true };

  // Refusé : on relit uniquement pour renseigner le message (used / reset dans X minutes).
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      monthlyAuditCount: true, monthlyAuditResetAt: true,
      dailyAnalysisCount: true, dailyAnalysisResetAt: true,
    },
  });
  if (!u) return { ok: false };
  const used = kind === 'audit' ? u.monthlyAuditCount : u.dailyAnalysisCount;
  const resetAt = kind === 'audit' ? u.monthlyAuditResetAt : u.dailyAnalysisResetAt;
  const elapsed = now.getTime() - resetAt.getTime();
  return {
    ok: false,
    used,
    limit,
    resetInMinutes: Math.max(1, Math.ceil((windowMs - elapsed) / 60000)),
  };
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
    select: { subscriptionStatus: true, subscriptionCurrentPeriodEnd: true },
  });
  if (!user) return { ok: false };
  if (isProActive(user)) return { ok: true };
  return consumeWindowedQuota({
    userId,
    limit: FREE_DAILY_ANALYSIS_LIMIT,
    windowMs: RESET_WINDOW_MS,
    kind: 'analysis',
  });
}
