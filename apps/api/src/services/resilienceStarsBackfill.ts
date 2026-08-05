import { PrismaClient, type Prisma } from '@prisma/client';
import { scoreWithCrossCheck, type CrossCheckOptions } from './resilienceStarsCrossCheck.js';
import { normalizeCompanyName, type CompanyBrief } from './resilienceStars.js';

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
  /**
   * Entreprises notees puis ECRITES avant de passer aux suivantes. Defaut 12.
   *
   * Ne jamais repasser a une ecriture unique en fin de run : le 05/08/2026 un run de 60 est mort
   * sur la derniere etape du controle croise et a jete 21 min de scoring sans ecrire une ligne.
   * Une tranche perdue ne coute plus que la tranche.
   */
  batchSize?: number;
}

export interface BackfillResult {
  scored: number;
  remaining: number;
  totalUniverse: number;
  flagged: number;
  /** Notees par Sonnet mais sans controle croise : NON ecrites, repiochees au prochain run. */
  skippedNoCrossCheck: number;
  /** Tranches perdues sur erreur ; le run continue avec les suivantes. */
  failedBatches: number;
}

interface UniverseRow {
  ticker: string;
  name: string | null;
  sector: string | null;
  marketCapUsd: number | null;
}

export interface CompanyGroup {
  brief: CompanyBrief;
  /** Tous les tickers qui designent cette meme societe, plus grosse capi en tete. */
  rows: UniverseRow[];
}

/**
 * Regroupe les lignes qui designent la MEME societe : double cotation, ADR plus ligne locale.
 *
 * Sept societes du seul haut de tableau existent sous plusieurs tickers (BRK.A/BRK.B, GOOG/GOOGL,
 * HSBC en trois lignes, BABA/9988.HK...). Sans regroupement, deux defauts se cumulaient : les maps
 * de scoreWithCrossCheck etant indexees par NOM, les homonymes s'ecrasaient, et l'appariement final
 * en jetait un. Le 05/08/2026 un run de 60 n'ecrivait que 56 lignes, sans aucun avertissement, et
 * les 4 perdues revenaient chaque nuit sans jamais etre notees.
 *
 * Regrouper corrige aussi une depense inutile : la resilience juge une ENTREPRISE, pas une ligne de
 * cotation. Une note obtenue une fois est ecrite sur tous ses tickers.
 */
export function groupRowsByCompany(rows: UniverseRow[]): CompanyGroup[] {
  const groups = new Map<string, UniverseRow[]>();
  for (const row of rows) {
    const key = normalizeCompanyName(row.name ?? row.ticker);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map(group => ({ brief: toCompanyBrief(group[0]!), rows: group }));
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
      return { scored: 0, remaining, totalUniverse, flagged: 0, skippedNoCrossCheck: 0, failedBatches: 0 };
    }

    const batchSize = Math.max(1, options.batchSize ?? 12);
    let flagged = 0;
    let persisted = 0;
    let skippedNoCrossCheck = 0;
    let failedBatches = 0;

    for (let start = 0; start < due.length; start += batchSize) {
      const slice = due.slice(start, start + batchSize);
      const label = `${start + 1}-${start + slice.length}/${due.length}`;
      try {
        const groups = groupRowsByCompany(slice);
        const scores = await scoreWithCrossCheck(groups.map(group => group.brief), options.crossCheck);
        if (scores.length !== groups.length) {
          throw new Error(`${scores.length} notes pour ${groups.length} societes demandees`);
        }
        let written = 0;
        let skippedInSlice = 0;
        for (const [index, group] of groups.entries()) {
          const score = scores[index]!;
          // Pas de controle croise sur cette ligne = defaillance technique, pas un cas difficile.
          // On ne l'ecrit PAS : une ligne ecrite n'est plus jamais repiochee par pickDue, elle
          // resterait figee en `flagged` a vie. La laisser dehors la remet au menu demain.
          if (score.v3Total == null) {
            skippedInSlice += group.rows.length;
            continue;
          }
          if (score.verdict === 'flagged') flagged += 1;
          const criteria = score.criteria as unknown as Prisma.InputJsonValue;
          const sonnetTotals = score.sonnetTotals as unknown as Prisma.InputJsonValue;
          // Une societe, une note, ecrite sur TOUS ses tickers (double cotation, ADR).
          for (const row of group.rows) {
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
                v3Total: score.v3Total,
                marketCapUsd: row.marketCapUsd,
              },
              update: {
                name: row.name,
                total: score.total,
                criteria,
                verdict: score.verdict,
                model: score.model,
                sonnetTotals,
                v3Total: score.v3Total,
                marketCapUsd: row.marketCapUsd,
                scoredAt: new Date(),
              },
            });
            written += 1;
          }
        }
        persisted += written;
        skippedNoCrossCheck += skippedInSlice;
        const perdues = slice.length - written - skippedInSlice;
        console.log(
          `[resilience] tranche ${label} : ${groups.length} societes notees, ${written} tickers ecrits (cumul ${persisted}).`,
        );
        // Aucune ligne ne doit disparaitre sans etre comptee : c'est exactement ce qui a masque la
        // perte des doubles cotations.
        if (perdues > 0) console.warn(`[resilience] tranche ${label} : ${perdues} ligne(s) non ecrites sans raison connue.`);
      } catch (error) {
        failedBatches += 1;
        const first = (error as Error).message.split('\n')[0];
        console.error(`[resilience] tranche ${label} perdue, on continue : ${first}`);
      }
    }

    return {
      scored: persisted,
      remaining: Math.max(0, remaining - persisted),
      totalUniverse,
      flagged,
      skippedNoCrossCheck,
      failedBatches,
    };
  } finally {
    if (!options.prisma) await prisma.$disconnect();
  }
}
