import type { ResilienceAnalysis, ResilienceCriterionScore, ResilienceGrade, ResilienceSummary } from '@lubin/shared';
import { prisma } from '../db/client.js';
import { PUBLISHED_RESILIENCE_VERSION, isPublishedResilienceAnalysis } from './resiliencePublished.js';

/**
 * Une « opportunité du moment » exige une résilience soit absente (ticker pas encore noté),
 * soit au moins C : on refuse les modèles jugés fragiles (D ou E). Appliqué à la lecture,
 * là où l'opportunité est exposée, pour rester cohérent quand la résilience évolue.
 */
export function resilienceAllowsOpportunity(grade: ResilienceGrade | null | undefined): boolean {
  return grade == null || grade === 'A' || grade === 'B' || grade === 'C';
}

/**
 * Lecture BATCH des analyses de résilience PUBLIÉES (une seule requête, anti N+1).
 *
 * Même garde-fou de qualité que la page analyse (isPublishedResilienceAnalysis : structure +
 * version + statut). Les tickers non scorés sont simplement absents de la Map → l'UI les masque.
 */
async function fetchPublished(tickers: string[]): Promise<Map<string, ResilienceAnalysis>> {
  const out = new Map<string, ResilienceAnalysis>();
  const unique = [...new Set(tickers.map(t => t.toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return out;

  const rows = await prisma.resilienceAnalysis.findMany({
    where: { version: PUBLISHED_RESILIENCE_VERSION, status: 'scored', ticker: { in: unique } },
    select: { ticker: true, analysis: true },
  });
  for (const row of rows) {
    if (isPublishedResilienceAnalysis(row.analysis)) out.set(row.ticker, row.analysis);
  }
  return out;
}

/** Résumé compact (grade + score) — screener, watchlist, home, forward-compare. */
export async function getPublishedResilienceSummaries(
  tickers: string[],
): Promise<Map<string, ResilienceSummary>> {
  const out = new Map<string, ResilienceSummary>();
  for (const [ticker, a] of await fetchPublished(tickers)) {
    if (a.grade == null || a.finalScore == null) continue;
    out.set(ticker, { grade: a.grade, score: a.finalScore });
  }
  return out;
}

/** Résumé + ventilation par critère (6 lignes) — pour la section détaillée du comparateur. */
export async function getPublishedResilienceBreakdowns(
  tickers: string[],
): Promise<Map<string, ResilienceSummary & { criteria: ResilienceCriterionScore[] }>> {
  const out = new Map<string, ResilienceSummary & { criteria: ResilienceCriterionScore[] }>();
  for (const [ticker, a] of await fetchPublished(tickers)) {
    if (a.grade == null || a.finalScore == null) continue;
    out.set(ticker, {
      grade: a.grade,
      score: a.finalScore,
      criteria: a.criteria.map(c => ({ id: c.id, score: c.score, maxScore: c.maxScore })),
    });
  }
  return out;
}
