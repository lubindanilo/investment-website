import 'dotenv/config';
import { prisma } from '../src/db/client.js';
import { isSameCompany, normalizeCompanyName, type CompanyLine } from '../src/services/resilienceStars.js';

/**
 * Audit des HOMONYMES du screener : deux societes sans rapport qui partagent un nom canonique.
 *
 * POURQUOI CE SCRIPT EXISTE. La resilience note une ENTREPRISE, pas une ligne de cotation : le
 * backfill regroupe donc les tickers d'une meme societe et recopie la note d'une ligne sur l'autre
 * (cf. resilienceStarsBackfill.ts). Tant que l'identite se resumait au nom canonique, deux societes
 * homonymes se retrouvaient fusionnees et l'une portait la note argumentee de l'autre — Merck KGaA
 * affichait 1,5/5 en citant Keytruda, l'anti-cancereux de Merck & Co (constate le 11/08/2026).
 * `isSameCompany` tranche desormais avec deux signaux de plus (initiales de tete, famille juridique),
 * mais aucune regle de nom ne separera « Toro Co » de « Toro Corp. » : ce script sert a trouver ces
 * cas-la, un par un, pour les inscrire dans `SEPARATE_COMPANIES`.
 *
 * A RELANCER quand le drain du screener a ajoute un gros paquet de lignes : l'univers passera de
 * ~8 600 a ~30 000, donc la population d'homonymes va grandir.
 *
 * LECTURE SEULE. Rien n'est ecrit ni supprime ici. Les lignes deja corrompues se reparent dans
 * scripts/resilienceStarsManualReview.ts (bloc DELETIONS) : supprimer la ligne suffit, le backfill la
 * repioche et la note pour elle-meme.
 *
 *   pnpm --filter @lubin/api exec tsx scripts/resilienceStarsHomonymAudit.ts        # collisions
 *   pnpm --filter @lubin/api exec tsx scripts/resilienceStarsHomonymAudit.ts --all  # + regroupements acceptes
 */

interface Line extends CompanyLine {
  sector: string | null;
  marketCapUsd: number | null;
  total: number | null;
  /** Empreinte des 5 justifications : deux lignes qui la partagent portent LA MEME note, recopiee. */
  fingerprint: string | null;
  /** Horodatage COMPLET : deux lignes d'une meme tranche se departagent a la seconde, pas au jour. */
  scoredAt: string | null;
}

const cap = (usd: number | null): string => (usd == null ? '     ?' : `${(usd / 1e9).toFixed(1)} G$`);

function show(line: Line, prefix = '   '): string {
  const note = line.total == null ? 'non notee' : `${line.total}/5`;
  const stamp = line.scoredAt ? ` le ${line.scoredAt.slice(0, 10)}` : '';
  return `${prefix}${line.ticker.padEnd(14)} ${line.name.slice(0, 42).padEnd(42)} ${(line.sector ?? '?').slice(0, 30).padEnd(30)} ${cap(line.marketCapUsd).padStart(9)}  ${note}${stamp}`;
}

/** Sous-groupes d'une meme cle canonique : une entree par societe REELLEMENT distincte. */
function partition(lines: Line[]): Line[][] {
  const groups: Line[][] = [];
  for (const line of lines) {
    const host = groups.find(group => isSameCompany(group[0]!, line));
    if (host) host.push(line);
    else groups.push([line]);
  }
  return groups;
}

async function main(): Promise<void> {
  try {
    await audit();
  } finally {
    await prisma.$disconnect();
  }
}

async function audit(): Promise<void> {
  const showAll = process.argv.includes('--all');

  const [universe, scores] = await Promise.all([
    // Meme population que `pickDue` du backfill : ce sont les seules lignes qu'une recopie peut
    // atteindre, donc les seules dont une collision se paie en note fausse.
    prisma.screenerTicker.findMany({
      where: { name: { not: null }, marketCapUsd: { not: null }, status: { notIn: ['nodata', 'error'] } },
      select: { ticker: true, name: true, sector: true, marketCapUsd: true },
    }),
    prisma.resilienceStarScore.findMany({ select: { ticker: true, total: true, criteria: true, scoredAt: true } }),
  ]);
  const byTicker = new Map(scores.map(s => [s.ticker, s]));

  const buckets = new Map<string, Line[]>();
  for (const row of universe) {
    const score = byTicker.get(row.ticker);
    const line: Line = {
      ticker: row.ticker,
      name: row.name!,
      sector: row.sector,
      marketCapUsd: row.marketCapUsd,
      total: score?.total ?? null,
      fingerprint: score ? JSON.stringify(score.criteria) : null,
      scoredAt: score?.scoredAt.toISOString() ?? null,
    };
    const key = normalizeCompanyName(line.name);
    buckets.set(key, [...(buckets.get(key) ?? []), line]);
  }

  const collisions: string[] = [];
  const toWatch: string[] = [];
  const divergent: string[] = [];

  for (const [key, lines] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (lines.length < 2) continue;
    const groups = partition(lines);

    if (groups.length > 1) {
      // Deux societes distinctes sous une meme cle : le regroupement les separe, mais elles restent
      // a portee d'une regle de nom un peu plus laxiste. C'est le vivier de SEPARATE_COMPANIES.
      collisions.push(
        `[${key}]\n` +
          groups.map((group, i) => group.map(line => show(line, `   ${i + 1}. `)).join('\n')).join('\n'),
      );
      continue;
    }

    // Un seul groupe : le backfill les traitera comme une seule societe. On affiche celles dont les
    // raisons sociales ne sont pas litteralement identiques — c'est la ou une fusion a tort se
    // cacherait encore.
    const distinctNames = new Set(lines.map(line => line.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
    if (distinctNames.size > 1) toWatch.push(`[${key}]\n${lines.map(line => show(line)).join('\n')}`);

    // Meme societe, notes DIFFERENTES : la recopie n'a pas joue (lignes notees dans deux shards
    // paralleles), et le site affiche deux notes contradictoires pour une seule entreprise.
    const notes = new Set(lines.map(line => line.fingerprint).filter(Boolean));
    if (notes.size > 1) divergent.push(`[${key}]\n${lines.map(line => show(line)).join('\n')}`);
  }

  /**
   * Degats DEJA en base, cherches sans passer par le nom canonique : deux notes aux justifications
   * rigoureusement identiques portees par deux societes differentes ne peuvent etre qu'une recopie.
   *
   * Ce detecteur-la est independant des regles de canonisation, et c'est ce qui compte : une victime
   * ecrite sous les anciennes regles (MRK.DE, HRB, STBA, 051900.KS...) ne partage plus forcement sa
   * cle avec sa source aujourd'hui, donc la section « collisions » ci-dessus ne la verrait plus.
   * Cinq phrases de justification identiques mot pour mot entre deux entreprises, en revanche, ne
   * sont pas une coincidence.
   */
  const damaged: string[] = [];
  let damagedLines = 0;
  const byFingerprint = new Map<string, Line[]>();
  for (const lines of buckets.values()) {
    for (const line of lines) {
      if (!line.fingerprint) continue;
      byFingerprint.set(line.fingerprint, [...(byFingerprint.get(line.fingerprint) ?? []), line]);
    }
  }
  for (const lines of byFingerprint.values()) {
    const groups = partition(lines);
    if (groups.length < 2) continue;
    // La plus ancienne note est l'originale ; les autres societes n'ont fait que l'heriter.
    const sorted = [...lines].sort((a, b) => (a.scoredAt ?? '').localeCompare(b.scoredAt ?? ''));
    const source = sorted[0]!;
    const copies = groups.filter(group => !group.some(line => line.ticker === source.ticker)).flat();
    damagedLines += copies.length;
    damaged.push(
      `${show(source, '   source   ')}\n${copies.map(line => show(line, '   RECOPIE  ')).join('\n')}`,
    );
  }

  console.log(`Univers : ${universe.length} lignes nommees, ${buckets.size} noms canoniques, ${scores.length} notes de resilience.\n`);

  console.log(`=== NOTES RECOPIEES A TORT, DEJA EN BASE : ${damagedLines} ligne(s) sur ${damaged.length} societe(s) source ===\n`);
  console.log(damaged.length ? damaged.join('\n\n') : '   Aucune.');
  if (damaged.length > 0) {
    console.log('\n   Reparation : inscrire les lignes RECOPIE dans le bloc DELETIONS de');
    console.log('   scripts/resilienceStarsManualReview.ts. Le backfill les repioche et les note pour elles-memes.');
  }

  console.log(`\n=== COLLISIONS : societes distinctes sous un nom canonique commun (${collisions.length}) ===\n`);
  console.log(collisions.length ? collisions.join('\n\n') : '   Aucune.');

  console.log(`\n=== MEME SOCIETE, NOTES DIVERGENTES (${divergent.length}) ===\n`);
  console.log(divergent.length ? divergent.join('\n\n') : '   Aucune.');

  console.log(`\n=== REGROUPEMENTS ACCEPTES A RAISON SOCIALE DIFFERENTE (${toWatch.length}) ===\n`);
  if (showAll) console.log(toWatch.length ? toWatch.join('\n\n') : '   Aucun.');
  else console.log('   Relancer avec --all pour les detailler.');
}

main().catch((e: Error) => { console.error(e); process.exit(1); });
