import type { ResilienceSummary } from '@lubin/shared';
import { prisma } from '../db/client.js';
import { PUBLISHED_RESILIENCE_VERSION, isPublishedResilienceAnalysis } from './resiliencePublished.js';

/**
 * Lecture BATCH des résumés de résilience publiés pour une liste de tickers.
 *
 * Sert les surfaces hors page analyse (screener, watchlist, compare, home) : un seul
 * findMany plutôt qu'un getPublishedResilience par ligne (anti N+1). Même garde-fou de
 * qualité que la page analyse (isPublishedResilienceAnalysis : structure + version + statut).
 * Les tickers non scorés sont simplement absents de la Map → l'UI les masque.
 */
export async function getPublishedResilienceSummaries(
  tickers: string[],
): Promise<Map<string, ResilienceSummary>> {
  const out = new Map<string, ResilienceSummary>();
  const unique = [...new Set(tickers.map(t => t.toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return out;

  const rows = await prisma.resilienceAnalysis.findMany({
    where: { version: PUBLISHED_RESILIENCE_VERSION, status: 'scored', ticker: { in: unique } },
    select: { ticker: true, analysis: true },
  });

  for (const row of rows) {
    if (!isPublishedResilienceAnalysis(row.analysis)) continue;
    const { grade, finalScore } = row.analysis;
    if (grade == null || finalScore == null) continue;
    out.set(row.ticker, { grade, score: finalScore });
  }
  return out;
}
