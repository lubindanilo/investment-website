import { PrismaClient, type Prisma } from '@prisma/client';
import { scoreWithCrossCheck, type CrossCheckOptions, type CrossCheckedScore } from './resilienceStarsCrossCheck.js';
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

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function pairScoresWithRows(
  rows: UniverseRow[],
  scores: CrossCheckedScore[],
): { row: UniverseRow; score: CrossCheckedScore }[] {
  const byExactName = new Map(rows.map(row => [row.name ?? row.ticker, row]));
  const byNormalizedName = new Map(rows.map(row => [normalizeName(row.name ?? row.ticker), row]));
  const used = new Set<string>();

  return scores.flatMap((score, index) => {
    const row =
      byExactName.get(score.name) ??
      byNormalizedName.get(normalizeName(score.name)) ??
      rows[index] ??
      null;
    if (!row || used.has(row.ticker)) return [];
    used.add(row.ticker);
    return [{ row, score }];
  });
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

/**
 * Reveille la base et attend qu'elle reponde avant de travailler.
 *
 * Le plan Free suspend l'endpoint Neon apres 5 min d'inactivite. Lance a 3 h du matin, ce backfill
 * est la premiere chose a toucher la base depuis des heures, et sa premiere requete peut mourir
 * PENDANT le reveil : c'est exactement ce qui s'est passe le 05/08/2026 (P1017 « Server has closed
 * the connection » au bout de 16 min, zero entreprise notee, et un log qui annonçait exit=0).
 * Un `SELECT 1` avec quelques essais espaces absorbe le demarrage a froid.
 */
async function waitForDb(prisma: PrismaClient, attempts = 5): Promise<void> {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      if (i === attempts) throw error;
      const first = (error as Error).message.split('\n')[0];
      console.warn(`[resilience] base injoignable (essai ${i}/${attempts}) : ${first}`);
      await new Promise(resolve => setTimeout(resolve, i * 3_000));
    }
  }
}

/**
 * Candidats du jour : capi connue, pas encore de score de resilience, les plus grosses d'abord.
 *
 * Anti-jointure BORNEE cote serveur. L'ancienne version chargeait tout l'univers ayant une capi
 * puis coupait en memoire : 7 453 lignes le 05/08/2026, et ~30 000 quand le drain aura fini de
 * remplir le screener, pour n'en utiliser que `cap`. Mesure : 331 ms pour la version non bornee
 * contre 73 ms pour celle-ci, et l'ecart grandit avec l'univers.
 */
async function pickDue(prisma: PrismaClient, cap: number): Promise<UniverseRow[]> {
  return prisma.$queryRaw<UniverseRow[]>`
    SELECT s.ticker, s.name, s.sector, s."marketCapUsd"
    FROM "ScreenerTicker" s
    LEFT JOIN "ResilienceStarScore" r ON r.ticker = s.ticker
    WHERE s."marketCapUsd" IS NOT NULL AND r.ticker IS NULL
    ORDER BY s."marketCapUsd" DESC
    LIMIT ${cap}`;
}

/** Nombre de candidats restants AVANT le travail de ce run (meme filtre que pickDue). */
async function countPending(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "ScreenerTicker" s
    LEFT JOIN "ResilienceStarScore" r ON r.ticker = s.ticker
    WHERE s."marketCapUsd" IS NOT NULL AND r.ticker IS NULL`;
  return Number(rows[0]?.n ?? 0);
}

export async function runBackfill(options: BackfillOptions): Promise<BackfillResult> {
  const prisma = options.prisma ?? new PrismaClient();
  try {
    await waitForDb(prisma);
    const cap = Math.max(0, options.dailyCap);
    const [totalUniverse, remaining, due] = await Promise.all([
      prisma.screenerTicker.count({ where: { marketCapUsd: { not: null } } }),
      countPending(prisma),
      cap === 0 ? Promise.resolve([] as UniverseRow[]) : pickDue(prisma, cap),
    ]);
    if (due.length === 0) {
      return { scored: 0, remaining, totalUniverse, flagged: 0 };
    }

    const scores = await scoreWithCrossCheck(due.map(toCompanyBrief), options.crossCheck);
    const pairs = pairScoresWithRows(due, scores);

    let flagged = 0;
    let persisted = 0;
    for (const { row, score } of pairs) {
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
      persisted += 1;
    }

    return {
      scored: persisted,
      remaining: Math.max(0, remaining - persisted),
      totalUniverse,
      flagged,
    };
  } finally {
    if (!options.prisma) await prisma.$disconnect();
  }
}
