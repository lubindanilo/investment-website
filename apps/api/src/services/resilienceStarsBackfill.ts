import { PrismaClient, type Prisma } from '@prisma/client';
import { scoreWithCrossCheck, type CrossCheckOptions } from './resilienceStarsCrossCheck.js';
import { normalizeCompanyName, type CompanyBrief } from './resilienceStars.js';
import { isNonOperatingVehicle } from '../lib/nonOperatingVehicle.js';

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
  /**
   * Rang de depart dans la file (candidats tries par capi decroissante). Defaut 0.
   *
   * Sert au DECOUPAGE EN SHARDS du cron : un runner GitHub est tue a 6 h, et le debit mesure le
   * 07/08/2026 est de ~2,2 entreprises/min (250 en 117 min). Au-dela de ~780 un seul job ne rentre
   * plus. N jobs paralleles prenant `offset = shard * cap` se partagent donc la file sans se
   * marcher dessus : les lots sont lus AVANT toute ecriture, les fenetres sont disjointes.
   *
   * Effet de bord assume : un groupe d'homonymes (BRK.A/BRK.B) pose a cheval sur une frontiere de
   * shard est note deux fois au lieu d'etre recopie. Les homonymes ont des capis voisines donc sont
   * quasi toujours contigus ; au pire (shards - 1) groupes par nuit, chacun garde son controle croise.
   */
  offset?: number;
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
  /** Tickers ecrits en recopiant la note d'un homonyme deja note, sans appel aux modeles. */
  copiedFromHomonym: number;
}

interface UniverseRow {
  ticker: string;
  name: string | null;
  sector: string | null;
  marketCapUsd: number | null;
}

export interface CompanyGroup {
  /** Nom canonique de la societe : la cle de regroupement ET d'appariement des notes. */
  key: string;
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
  return [...groups.entries()].map(([key, group]) => ({
    key,
    brief: toCompanyBrief(group[0]!),
    rows: group,
  }));
}

/** Note deja en base, prete a etre recopiee sur une autre ligne de la meme societe. */
interface StoredScore {
  total: number;
  criteria: Prisma.InputJsonValue;
  verdict: string;
  model: string;
  sonnetTotals: Prisma.InputJsonValue;
  v3Total: number | null;
}

/**
 * Index par nom canonique de TOUTES les notes deja en base, charge UNE fois par run puis tenu a
 * jour en memoire au fil des ecritures.
 *
 * Le drain du screener ajoute les lignes d'une meme societe a des nuits differentes : `BABA` est
 * notee, `9988.HK` arrive trois semaines plus tard. Sans cette recopie, la seconde ligne repasse
 * devant les modeles, ce qui coute un appel pour rien et peut sortir une note DIFFERENTE pour la
 * meme entreprise, donc deux notes contradictoires affichees sur le site.
 *
 * L'index est charge en entier (et non requete par tranche sur le nom exact) parce que les
 * fournisseurs n'ecrivent pas la meme raison sociale : « The Toronto-Dominion Bank » en base et
 * « Toronto-Dominion Bank » dans la tranche ne se retrouvent que par la cle CANONIQUE, qui ne se
 * calcule pas en SQL. Audit du 06/08/2026 : six societes avaient deux notes divergentes par ce trou.
 */
async function loadScoredIndex(prisma: PrismaClient): Promise<Map<string, StoredScore>> {
  const rows = await prisma.resilienceStarScore.findMany({
    select: { name: true, total: true, criteria: true, verdict: true, model: true, sonnetTotals: true, v3Total: true },
    orderBy: { scoredAt: 'desc' },
  });

  const byName = new Map<string, StoredScore>();
  for (const row of rows) {
    if (!row.name) continue;
    const key = normalizeCompanyName(row.name);
    // La plus recente gagne (tri decroissant) : on ne remplace pas une entree deja posee.
    if (byName.has(key)) continue;
    byName.set(key, {
      total: row.total,
      criteria: row.criteria as Prisma.InputJsonValue,
      verdict: row.verdict,
      model: row.model,
      sonnetTotals: row.sonnetTotals as Prisma.InputJsonValue,
      v3Total: row.v3Total,
    });
  }
  return byName;
}

/** Ecrit une note sur TOUS les tickers d'une societe. Renvoie le nombre de lignes ecrites. */
async function writeScoreToRows(
  prisma: PrismaClient,
  rows: UniverseRow[],
  score: StoredScore,
): Promise<number> {
  let written = 0;
  for (const row of rows) {
    const data = {
      name: row.name,
      total: score.total,
      criteria: score.criteria,
      verdict: score.verdict,
      model: score.model,
      sonnetTotals: score.sonnetTotals,
      v3Total: score.v3Total,
      marketCapUsd: row.marketCapUsd,
    };
    await prisma.resilienceStarScore.upsert({
      where: { ticker: row.ticker },
      create: { ticker: row.ticker, ...data },
      update: { ...data, scoredAt: new Date() },
    });
    written += 1;
  }
  return written;
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
/**
 * Le scoreur ne recoit QUE nom + ticker + secteur : sans nom exploitable il noterait un code
 * boursier a l'aveugle (7 lignes notees ainsi le 05/08, dont FDX.WI, la ligne technique
 * « when issued » de FedEx, notee 2/5 quand FDX est a 2,5). On exige donc un nom, different du
 * ticker, et on ecarte ce que le screener a classe sans donnees (dont les vehicules non operants).
 */
async function pickDue(prisma: PrismaClient, cap: number, offset: number): Promise<UniverseRow[]> {
  const rows = await prisma.$queryRaw<UniverseRow[]>`
    SELECT s.ticker, s.name, s.sector, s."marketCapUsd"
    FROM "ScreenerTicker" s
    LEFT JOIN "ResilienceStarScore" r ON r.ticker = s.ticker
    WHERE s."marketCapUsd" IS NOT NULL AND r.ticker IS NULL
      AND s.name IS NOT NULL AND s.name <> '' AND s.name <> s.ticker
      AND s.status NOT IN ('nodata', 'error')
    ORDER BY s."marketCapUsd" DESC
    LIMIT ${cap} OFFSET ${offset}`;
  // Double filet cote JS : les vehicules pas encore re-classes par le screener (statut encore
  // `scored`/`pending`) ne doivent pas consommer un appel aux modeles. On accepte un run un peu
  // plus court plutot que de repiocher derriere eux.
  return rows.filter(row => {
    if (!isNonOperatingVehicle(row.name)) return true;
    console.warn(`[resilience] ${row.ticker} (${row.name}) ecarte : vehicule non operant.`);
    return false;
  });
}

/** Nombre de candidats restants AVANT le travail de ce run (meme filtre que pickDue). */
async function countPending(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "ScreenerTicker" s
    LEFT JOIN "ResilienceStarScore" r ON r.ticker = s.ticker
    WHERE s."marketCapUsd" IS NOT NULL AND r.ticker IS NULL
      AND s.name IS NOT NULL AND s.name <> '' AND s.name <> s.ticker
      AND s.status NOT IN ('nodata', 'error')`;
  return Number(rows[0]?.n ?? 0);
}

export async function runBackfill(options: BackfillOptions): Promise<BackfillResult> {
  const prisma = options.prisma ?? new PrismaClient();
  try {
    await waitForDb(prisma);
    const cap = Math.max(0, options.dailyCap);
    const offset = Math.max(0, options.offset ?? 0);
    const [totalUniverse, remaining, due] = await Promise.all([
      prisma.screenerTicker.count({ where: { marketCapUsd: { not: null } } }),
      countPending(prisma),
      cap === 0 ? Promise.resolve([] as UniverseRow[]) : pickDue(prisma, cap, offset),
    ]);
    if (due.length === 0) {
      return {
        scored: 0,
        remaining,
        totalUniverse,
        flagged: 0,
        skippedNoCrossCheck: 0,
        failedBatches: 0,
        copiedFromHomonym: 0,
      };
    }

    const batchSize = Math.max(1, options.batchSize ?? 12);
    let flagged = 0;
    let persisted = 0;
    let skippedNoCrossCheck = 0;
    let failedBatches = 0;
    let copiedFromHomonym = 0;

    // Index des notes existantes par nom canonique, tenu a jour au fil des ecritures du run.
    const scoredIndex = await loadScoredIndex(prisma);

    for (let start = 0; start < due.length; start += batchSize) {
      const slice = due.slice(start, start + batchSize);
      const label = `${start + 1}-${start + slice.length}/${due.length}`;
      let written = 0;
      let skippedInSlice = 0;
      let copiedInSlice = 0;
      try {
        const groups = groupRowsByCompany(slice);

        // 1. Recopie : une societe dont un autre ticker est deja note ne repasse pas par les modeles.
        const toScore: CompanyGroup[] = [];
        for (const group of groups) {
          const existing = scoredIndex.get(group.key);
          if (!existing) {
            toScore.push(group);
            continue;
          }
          const rows = await writeScoreToRows(prisma, group.rows, existing);
          written += rows;
          copiedInSlice += rows;
        }

        // 2. Notation des societes reellement nouvelles. Le lot peut revenir INCOMPLET (un lot
        //    Sonnet ou DeepSeek perdu n'emporte que le sien), d'ou l'appariement par nom canonique
        //    plutot que par position.
        const scores = await scoreWithCrossCheck(toScore.map(group => group.brief), options.crossCheck);
        const byKey = new Map(scores.map(score => [normalizeCompanyName(score.name), score]));

        for (const group of toScore) {
          const score = byKey.get(group.key);
          // Ni note Sonnet, ni controle croise : defaillance technique, pas un cas difficile. On
          // n'ecrit PAS, sinon la ligne serait figee (pickDue ignore tout ticker deja present) :
          // en la laissant dehors elle revient au menu au prochain run.
          if (!score || score.v3Total == null) {
            skippedInSlice += group.rows.length;
            continue;
          }
          if (score.verdict === 'flagged') flagged += 1;
          const stored: StoredScore = {
            total: score.total,
            criteria: score.criteria as unknown as Prisma.InputJsonValue,
            verdict: score.verdict,
            model: score.model,
            sonnetTotals: score.sonnetTotals as unknown as Prisma.InputJsonValue,
            v3Total: score.v3Total,
          };
          written += await writeScoreToRows(prisma, group.rows, stored);
          // L'index suit les ecritures : la meme societe apparue plus loin dans CE run sera recopiee.
          scoredIndex.set(group.key, stored);
        }
      } catch (error) {
        // Ne reste ici que l'imprevu (base, bug) : les pertes de lots LLM sont deja absorbees plus
        // bas. Ce qui a ete ecrit avant l'erreur est conserve.
        failedBatches += 1;
        console.error(`[resilience] tranche ${label} interrompue : ${(error as Error).message.split('\n')[0]}`);
      }

      persisted += written;
      skippedNoCrossCheck += skippedInSlice;
      copiedFromHomonym += copiedInSlice;
      console.log(
        `[resilience] tranche ${label} : ${written} tickers ecrits` +
          (copiedInSlice > 0 ? ` (dont ${copiedInSlice} recopies d un homonyme)` : '') +
          (skippedInSlice > 0 ? `, ${skippedInSlice} reportes` : '') +
          ` | cumul ${persisted}.`,
      );
      // Aucune ligne ne doit disparaitre sans etre comptee : c'est le silence qui a laisse passer
      // la perte des doubles cotations.
      const perdues = slice.length - written - skippedInSlice;
      if (perdues > 0) console.warn(`[resilience] tranche ${label} : ${perdues} ligne(s) non ecrites sans raison connue.`);
    }

    return {
      scored: persisted,
      remaining: Math.max(0, remaining - persisted),
      totalUniverse,
      flagged,
      skippedNoCrossCheck,
      failedBatches,
      copiedFromHomonym,
    };
  } finally {
    if (!options.prisma) await prisma.$disconnect();
  }
}
