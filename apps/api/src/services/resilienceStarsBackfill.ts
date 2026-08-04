import { PrismaClient, type Prisma } from '@prisma/client';
import { scoreWithCrossCheck, type CrossCheckOptions } from './resilienceStarsCrossCheck.js';
import type { CompanyBrief } from './resilienceStars.js';

/**
 * Backfill de nuit du score Resilience 5 etoiles.
 *
 * - Univers = `ScreenerTicker`, ordonne par `marketCapUsd` DECROISSANT (les
 *   plus grosses d'abord), capi deja normalisee en USD dans la DB.
 * - Ne re-score pas ce qui est deja dans `ResilienceStarScore`.
 * - Plafond quotidien (fraction de l'abonnement acceptee).
 * - Scoreur INDEPENDANT : on ne donne PAS de brief factuel fige (qui creerait
 *   des erreurs correlees) ; chaque modele note avec sa propre connaissance de
 *   l'entreprise. On lui passe juste nom + ticker + secteur.
 */
export interface BackfillOptions {
  dailyCap: number;
  prisma?: PrismaClient;
  crossCheck?: CrossCheckOptions;
}

export interface BackfillResult {
  scored: number;
  remaining: number;
  totalUniverse: number;
  flagged: number;
}

interface UniverseRow {
  ticker: string;
  name: string | null;
  sector: string | null;
  marketCapUsd: number | null;
}

/** Pas de brief fige : on demande au modele d'utiliser sa propre connaissance. */
export function toCompanyBrief(row: UniverseRow): CompanyBrief {
  const label = row.name ?? row.ticker;
  const sector = row.sector ? `Secteur : ${row.sector}. ` : '';
  return {
    name: label,
    brief: `${sector}Note l'entreprise ${label} (${row.ticker}) avec ta propre connaissance de son activite et de sa position en 2033. N'utilise aucune donnee financiere chiffree.`,
  };
}

export async function runBackfill(options: BackfillOptions): Promise<BackfillResult> {
  const prisma = options.prisma ?? new PrismaClient();
  try {
    const alreadyScored = new Set(
      (await prisma.resilienceStarScore.findMany({ select: { ticker: true } })).map(r => r.ticker),
    );
    const universe: UniverseRow[] = await prisma.screenerTicker.findMany({
      where: { marketCapUsd: { not: null } },
      orderBy: { marketCapUsd: 'desc' },
      select: { ticker: true, name: true, sector: true, marketCapUsd: true },
    });

    const pending = universe.filter(row => !alreadyScored.has(row.ticker));
    const due = pending.slice(0, Math.max(0, options.dailyCap));
    if (due.length === 0) {
      return { scored: 0, remaining: pending.length, totalUniverse: universe.length, flagged: 0 };
    }

    const byName = new Map(due.map(row => [row.name ?? row.ticker, row]));
    const scores = await scoreWithCrossCheck(due.map(toCompanyBrief), options.crossCheck);

    let flagged = 0;
    for (const score of scores) {
      const row = byName.get(score.name);
      if (!row) continue;
      if (score.verdict === 'flagged') flagged += 1;
      const criteria = score.criteria as unknown as Prisma.InputJsonValue;
      const sonnetTotals = score.sonnetTotals as unknown as Prisma.InputJsonValue;
      await prisma.resilienceStarScore.upsert({
        where: { ticker: row.ticker },
        create: {
          ticker: row.ticker,
          name: row.name,
          total: score.total,
          criteria,
          verdict: score.verdict,
          model: score.model,
          sonnetTotals,
          v3Total: score.v3Total ?? null,
          marketCapUsd: row.marketCapUsd,
        },
        update: {
          name: row.name,
          total: score.total,
          criteria,
          verdict: score.verdict,
          model: score.model,
          sonnetTotals,
          v3Total: score.v3Total ?? null,
          marketCapUsd: row.marketCapUsd,
          scoredAt: new Date(),
        },
      });
    }

    return {
      scored: scores.length,
      remaining: pending.length - due.length,
      totalUniverse: universe.length,
      flagged,
    };
  } finally {
    if (!options.prisma) await prisma.$disconnect();
  }
}
