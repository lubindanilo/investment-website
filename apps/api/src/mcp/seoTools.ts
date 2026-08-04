/**
 * Tools MCP de l'offre SEO — audit, historique, comparatif.
 *
 * Séparés de `tools.ts` (analyse d'actions) parce que ce sont deux produits distincts qui
 * partagent seulement l'infrastructure : OAuth, découverte, rotation des refresh tokens et
 * middleware Bearer sont déjà en place, on ne fait que brancher des handlers dessus.
 *
 * Règle de gating, la seule qui compte : le test de visibilité IA est GRATUIT et ILLIMITÉ,
 * y compris pour un palier `free`. C'est l'outil d'acquisition. Ce qui se facture, c'est
 * l'audit de site (coût serveur réel, borné par palier), l'historique et le comparatif.
 */
import { prisma } from '../db/client.js';
import { CheckError, checkAiVisibility } from '../lib/aiVisibility.js';
import { crawlSite, type CrawlReport } from '../lib/seoCrawler.js';
import {
  AUDITS_PER_MONTH,
  CRAWL_PAGE_CAP,
  HAS_BENCHMARK,
  HAS_HISTORY,
  SITES_TRACKED,
  consumeAuditQuota,
  auditQuotaMessage,
  type McpContext,
} from './gating.js';

export interface SeoToolFailure {
  ok: false;
  code: string;
  message: string;
  upgradeUrl?: string;
  extra?: Record<string, unknown>;
}
export type SeoToolResult<T> = ({ ok: true } & T) | SeoToolFailure;

function deny(ctx: McpContext, code: string, message: string, extra?: Record<string, unknown>): SeoToolFailure {
  return { ok: false, code, message, upgradeUrl: `${ctx.baseUrl}/pricing`, extra };
}

/** Hôte canonique : clé de regroupement de l'historique d'un même site. */
function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Visibilité IA — hors quota, tous paliers
// ─────────────────────────────────────────────────────────────────────────────

export async function aiVisibility(url: string) {
  try {
    const r = await checkAiVisibility(url);
    return {
      ok: true as const,
      url: r.finalUrl,
      verdict: r.verdict,
      botWords: r.botWords,
      rawWords: r.rawWords,
      title: r.title,
      titleLength: r.title?.length ?? 0,
      hasJsonLd: r.hasJsonLd,
      findings: r.findings,
      note:
        'Ce test est gratuit et illimité. Le verdict `dynamic` signifie que le site sert du HTML ' +
        'pré-rendu aux user-agents qu’il reconnaît : ça marche, mais la visibilité dépend du ' +
        'maintien de cette liste.',
    };
  } catch (e) {
    if (e instanceof CheckError) return { ok: false as const, code: e.code, message: e.message };
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Audit de site — décompté, borné par palier, historisé
// ─────────────────────────────────────────────────────────────────────────────

export async function auditSite(ctx: McpContext, url: string): Promise<SeoToolResult<{
  host: string;
  tier: string;
  pageCap: number;
  report: Omit<CrawlReport, 'pages'> & { pages?: undefined };
  auditId: string | null;
  historyNote: string;
}>> {
  // Le quota se décompte AVANT le crawl : un audit qui échoue à mi-parcours a déjà coûté
  // les requêtes sortantes, et ne pas le compter ouvrirait un contournement trivial.
  const quota = await consumeAuditQuota(ctx.userId);
  if (!quota.ok) {
    return deny(ctx, 'QUOTA_EXCEEDED', auditQuotaMessage(quota, ctx.baseUrl), {
      resetInMinutes: quota.resetInMinutes,
      aiVisibilityStaysFree: `${ctx.baseUrl}/visibilite-ia`,
    });
  }

  const pageCap = CRAWL_PAGE_CAP[ctx.seoTier];
  let report: CrawlReport;
  try {
    report = await crawlSite(url, pageCap);
  } catch (e) {
    if (e instanceof CheckError) return { ok: false, code: e.code, message: e.message };
    throw e;
  }

  const host = hostOf(report.entryUrl);
  const blockingCount = report.aggregate.filter((a) => a.level === 'blocking').length;
  const warnCount = report.aggregate.filter((a) => a.level === 'warn').length;

  // Historisation : réservée aux paliers qui la vendent. Sur `free`, on rend le rapport mais
  // on n'écrit rien — sinon on facturerait plus tard un historique déjà constitué gratuitement.
  let auditId: string | null = null;
  let historyNote =
    'Historique non inclus dans le palier gratuit : cet audit n’est pas conservé, il n’y aura ' +
    'donc pas d’avant/après. Disponible à partir du palier Solo.';

  if (HAS_HISTORY[ctx.seoTier]) {
    const cap = SITES_TRACKED[ctx.seoTier];
    if (cap !== null) {
      const tracked = await prisma.siteAudit.findMany({
        where: { userId: ctx.userId },
        distinct: ['host'],
        select: { host: true },
      });
      if (!tracked.some((t) => t.host === host) && tracked.length >= cap) {
        return deny(
          ctx,
          'SITE_LIMIT',
          `Votre palier suit ${cap} site${cap > 1 ? 's' : ''} et vous en avez déjà ${tracked.length}. ` +
            'L’audit n’a pas été conservé. Le palier suivant élargit la limite.',
          { tracked: tracked.map((t) => t.host), limit: cap },
        );
      }
    }
    const saved = await prisma.siteAudit.create({
      data: {
        userId: ctx.userId,
        host,
        entryUrl: report.entryUrl,
        tier: ctx.seoTier,
        renderVerdict: report.renderVerdict,
        pagesCrawled: report.pagesCrawled,
        pagesSkipped: report.pagesSkipped,
        blockingCount,
        warnCount,
        medianBotWords: report.medianBotWords,
        orphanCount: report.orphans.length,
        maxDepth: report.maxDepth,
        stack: report.stack,
        report: report as unknown as object,
      },
      select: { id: true },
    });
    auditId = saved.id;
    historyNote = 'Audit conservé — `seo_history` donne l’évolution, `seo_benchmark` la comparaison.';
  }

  // On ne renvoie PAS le détail page par page dans la réponse du tool : sur 5 000 pages ça
  // noie le contexte du modèle. Le détail reste en base, et les constats agrégés portent
  // déjà jusqu'à 20 URL concernées chacun.
  const { pages: _pages, ...summary } = report;
  return {
    ok: true,
    host,
    tier: ctx.seoTier,
    pageCap,
    report: summary,
    auditId,
    historyNote,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Historique — palier Solo et au-delà
// ─────────────────────────────────────────────────────────────────────────────

export async function seoHistory(ctx: McpContext, host?: string): Promise<SeoToolResult<{
  host: string | null;
  points: Array<Record<string, unknown>>;
  interpretation: string;
}>> {
  if (!HAS_HISTORY[ctx.seoTier]) {
    return deny(
      ctx,
      'PLAN_REQUIRED',
      'L’historique avant/après demande le palier Solo. C’est lui qui permet de rattacher une ' +
        'correction à son effet — sur un canal où les effets prennent des semaines, c’est la seule ' +
        'façon de vérifier qu’un geste a servi.',
    );
  }
  const canonical = host ? hostOf(host) : undefined;
  const rows = await prisma.siteAudit.findMany({
    where: { userId: ctx.userId, ...(canonical ? { host: canonical } : {}) },
    orderBy: { createdAt: 'asc' },
    select: {
      createdAt: true, host: true, renderVerdict: true, pagesCrawled: true, pagesSkipped: true,
      blockingCount: true, warnCount: true, medianBotWords: true, orphanCount: true,
      maxDepth: true, stack: true, tier: true,
    },
  });
  if (!rows.length) {
    return {
      ok: true,
      host: canonical ?? null,
      points: [],
      interpretation: 'Aucun audit conservé pour l’instant. Lance `seo_audit` pour créer le premier point.',
    };
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  const delta = first && last && rows.length > 1
    ? `Entre le premier et le dernier passage : constats bloquants ${first.blockingCount} → ${last.blockingCount}, ` +
      `avertissements ${first.warnCount} → ${last.warnCount}, mots médians vus par un robot ` +
      `${first.medianBotWords} → ${last.medianBotWords}, orphelines ${first.orphanCount} → ${last.orphanCount}.`
    : 'Un seul point pour l’instant : il faut au moins deux passages pour lire une évolution.';

  return {
    ok: true,
    host: canonical ?? null,
    points: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    interpretation:
      `${delta} À lire avec prudence : une variation peut venir du site comme du marché. Le corpus ` +
      'rappelle que les éditeurs qui testent une chose à la fois surpassent ceux qui n’en testent aucune.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Comparatif sectoriel — palier Studio et au-delà
// ─────────────────────────────────────────────────────────────────────────────

/** En dessous, une médiane n'a pas de sens et publier un repère serait trompeur. */
const MIN_COHORT = 5;

export async function seoBenchmark(ctx: McpContext, host: string): Promise<SeoToolResult<{
  host: string;
  stack: string | null;
  cohortSize: number;
  you: Record<string, number>;
  median: Record<string, number> | null;
  interpretation: string;
}>> {
  if (!HAS_BENCHMARK[ctx.seoTier]) {
    return deny(
      ctx,
      'PLAN_REQUIRED',
      'Le comparatif sectoriel demande le palier Studio. Il situe le site face à la médiane des ' +
        'sites de même stack — un repère qui n’existe nulle part ailleurs et qui se précise à chaque ' +
        'nouvel audit de la base.',
    );
  }
  const canonical = hostOf(host);
  const mine = await prisma.siteAudit.findFirst({
    where: { userId: ctx.userId, host: canonical },
    orderBy: { createdAt: 'desc' },
    select: { stack: true, medianBotWords: true, maxDepth: true, orphanCount: true, blockingCount: true, warnCount: true },
  });
  if (!mine) {
    return { ok: false, code: 'NOT_FOUND', message: `Aucun audit conservé pour ${canonical}. Lance \`seo_audit\` d’abord.` };
  }

  // La cohorte, c'est la même stack : comparer un Webflow à un Next.js n'apprend rien. On ne
  // lit que des agrégats, jamais les audits d'autres utilisateurs.
  const cohort = await prisma.siteAudit.findMany({
    where: { stack: mine.stack, host: { not: canonical } },
    distinct: ['host'],
    orderBy: { createdAt: 'desc' },
    select: { medianBotWords: true, maxDepth: true, orphanCount: true, blockingCount: true, warnCount: true },
  });

  const you = {
    medianBotWords: mine.medianBotWords,
    maxDepth: mine.maxDepth,
    orphanCount: mine.orphanCount,
    blockingCount: mine.blockingCount,
    warnCount: mine.warnCount,
  };

  if (cohort.length < MIN_COHORT) {
    return {
      ok: true,
      host: canonical,
      stack: mine.stack,
      cohortSize: cohort.length,
      you,
      median: null,
      interpretation:
        `Cohorte trop petite pour une médiane : ${cohort.length} site(s) en stack « ${mine.stack ?? 'inconnue'} », ` +
        `il en faut au moins ${MIN_COHORT}. Publier un repère sur moins que ça serait un chiffre inventé. ` +
        'La cohorte se remplit au fil des audits.',
    };
  }

  const med = (pick: (r: (typeof cohort)[number]) => number): number => {
    const v = cohort.map(pick).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)] ?? 0;
  };
  const median = {
    medianBotWords: med((r) => r.medianBotWords),
    maxDepth: med((r) => r.maxDepth),
    orphanCount: med((r) => r.orphanCount),
    blockingCount: med((r) => r.blockingCount),
    warnCount: med((r) => r.warnCount),
  };

  return {
    ok: true,
    host: canonical,
    stack: mine.stack,
    cohortSize: cohort.length,
    you,
    median,
    interpretation:
      `Comparaison à ${cohort.length} sites de stack « ${mine.stack ?? 'inconnue'} ». Un écart n’est pas un ` +
      'défaut en soi : le corpus ne mesure rien sur les petits sites ni en français, ces repères situent, ' +
      'ils ne prescrivent pas.',
  };
}

/** Plafonds du palier courant — pour que l'assistant sache quoi proposer sans tâtonner. */
export function seoPlan(ctx: McpContext) {
  return {
    ok: true as const,
    tier: ctx.seoTier,
    auditsPerMonth: AUDITS_PER_MONTH[ctx.seoTier] ?? 'illimité',
    crawlPageCap: CRAWL_PAGE_CAP[ctx.seoTier],
    sitesTracked: SITES_TRACKED[ctx.seoTier] ?? 'illimité',
    history: HAS_HISTORY[ctx.seoTier],
    benchmark: HAS_BENCHMARK[ctx.seoTier],
    aiVisibility: 'gratuit et illimité, tous paliers',
    upgradeUrl: `${ctx.baseUrl}/pricing`,
  };
}
