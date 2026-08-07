import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Purge les notes de resilience HERITEES du seuil de controle croise a 1,5.
 *
 * Contexte. Jusqu'a la PR #257 (mergee le 06/08/2026), `classifyVerdict` acceptait en `agree` un
 * desaccord allant jusqu'a 1,5 etoile entre Sonnet et DeepSeek-V3, soit 30 % de l'echelle. Ces
 * lignes ont donc ete ecrites sur UN SEUL passage Sonnet, sans mediane et sans second avis, alors
 * que le mecanisme d'escalade existe precisement pour ces cas. Mesure au 07/08/2026 : 29 lignes
 * concernees, toutes anterieures au correctif, dont AVGO 4,5 contre 3, BRK.A 4,5 contre 3, ORCL
 * 4,5 contre 3, PG 2 contre 3,5.
 *
 * Ce script ne re-note rien lui-meme : il SUPPRIME ces lignes, et le backfill de nuit les repioche
 * (pickDue ne retient que les tickers absents de ResilienceStarScore) en leur appliquant le seuil
 * courant. Les plus grosses capis d'abord, donc elles repassent des la premiere nuit.
 *
 *   pnpm --filter @lubin/api exec tsx scripts/resilienceStarsRescoreLegacy.ts          # liste seule
 *   pnpm --filter @lubin/api exec tsx scripts/resilienceStarsRescoreLegacy.ts --apply  # supprime
 */

/** Merge de la PR #257 : au-dela, les lignes ont ete ecrites avec le seuil 1,0. */
const FIX_MERGED_AT = new Date('2026-08-06T07:10:00Z');
/** Seuil courant. Un ecart STRICTEMENT superieur ne peut plus sortir en `agree`. */
const CURRENT_THRESHOLD = 1.0;

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.resilienceStarScore.findMany({
      where: { verdict: 'agree', scoredAt: { lt: FIX_MERGED_AT }, v3Total: { not: null } },
      select: { ticker: true, name: true, total: true, v3Total: true, marketCapUsd: true },
    });
    const stale = rows
      .filter(r => Math.abs(r.total - r.v3Total!) > CURRENT_THRESHOLD)
      .sort((a, b) => (b.marketCapUsd ?? 0) - (a.marketCapUsd ?? 0));

    console.log(`Notes heritees du seuil 1,5 (agree malgre un ecart > ${CURRENT_THRESHOLD}) : ${stale.length}`);
    for (const r of stale) {
      console.log(`  ${r.ticker.padEnd(12)} ${(r.name ?? '').slice(0, 32).padEnd(32)} sonnet=${r.total} v3=${r.v3Total}`);
    }
    if (!stale.length) return;

    if (!apply) {
      console.log('\nMode liste seule. Relancer avec --apply pour supprimer ces lignes.');
      console.log('Le backfill de nuit les re-notera avec le seuil courant, plus grosses capis en tete.');
      return;
    }

    const { count } = await prisma.resilienceStarScore.deleteMany({
      where: { ticker: { in: stale.map(r => r.ticker) } },
    });
    console.log(`\n${count} ligne(s) supprimee(s). Elles repasseront au prochain backfill.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: Error) => { console.error(e); process.exit(1); });
