import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { missingAccentWords } from '../src/lib/frenchAccents.js';
import {
  needsReaccent,
  polishCriteria,
  reaccentTexts,
  REACCENT_MODEL,
  type Criteria,
} from '../src/services/resilienceStarsReaccent.js';
import { CRITERION_KEYS } from '../src/services/resilienceStars.js';

/**
 * Remet les accents sur les justifications de resilience DEJA en base.
 *
 * POURQUOI CE SCRIPT EXISTE. Le bareme (resilienceStarsPrompt.ts) etait ecrit en francais
 * desaccentue ; le modele a imite son prompt et a produit « Concessions regulees de tres longue
 * duree » sur des CENTAINES de tickers. Le prompt est corrige, mais un prompt ne repare pas le
 * passe : ces lignes ne seront jamais re-notees (pickDue du backfill ne repioche que les tickers
 * ABSENTS de la table). Il faut donc les reparer sur place.
 *
 * CE QUI EST TOUCHE, ET CE QUI NE L'EST PAS. Seul le TEXTE des justifications bouge. Les etoiles,
 * les totaux, le verdict, le modele scoreur : rien n'est recalcule, rien n'est reecrit. Chaque
 * phrase renvoyee par Haiku est verifiee lettre a lettre contre l'originale (`sameLetters`) : une
 * reformulation est rejetee et l'originale conservee. Une note ne peut pas changer de sens ici.
 *
 * IDEMPOTENT. Une ligne deja propre ne declenche aucun appel et n'est pas reecrite. Relancer le
 * script est sans effet, et une ligne notee cette nuit est rattrapee au passage suivant.
 *
 *   pnpm --filter @lubin/api run resilience:stars:reaccent                 # simulation
 *   pnpm --filter @lubin/api run resilience:stars:reaccent -- --apply      # ecrit en base
 *   pnpm --filter @lubin/api run resilience:stars:reaccent -- --limit 20   # pilote
 *   pnpm --filter @lubin/api run resilience:stars:reaccent -- --no-llm     # passe deterministe seule
 */
const APPLY = process.argv.includes('--apply');
const NO_LLM = process.argv.includes('--no-llm');
const LIMIT = readNumber('--limit');
const BATCH = readNumber('--batch') ?? 20;

function readNumber(flag: string): number | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function isCriteria(value: unknown): value is Criteria {
  if (!value || typeof value !== 'object') return false;
  return CRITERION_KEYS.every(key => {
    const criterion = (value as Record<string, unknown>)[key];
    return Boolean(criterion) && typeof (criterion as { justification?: unknown }).justification === 'string';
  });
}

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.resilienceStarScore.findMany({
    select: { ticker: true, name: true, criteria: true },
    orderBy: { marketCapUsd: 'desc' },
    take: LIMIT,
  });
  console.log(`${rows.length} lignes lues${LIMIT ? ` (limite ${LIMIT})` : ''}.`);

  // 1. Passe deterministe : la table apprise sur le blog, gratuite et sans appel reseau.
  const staged = rows.flatMap(row => {
    if (!isCriteria(row.criteria)) {
      console.warn(`[reaccent] ${row.ticker} : criteria illisible, ligne ignoree.`);
      return [];
    }
    const before = row.criteria;
    const after = polishCriteria(before);
    return [{ ticker: row.ticker, name: row.name, before, after }];
  });

  // 2. Passe Haiku sur TOUTES les phrases. On ne filtre pas sur `needsReaccent` : mesure faite
  //    sur les cartes Vinci, apres la passe deterministe il declare saines des phrases qui
  //    portent encore « electrification » et « concedant ». Le detecteur ne sert donc qu'a
  //    chiffrer ce qui est CERTAINEMENT fautif, pas a decider de sauter une ligne.
  if (!NO_LLM) {
    const pending = staged.flatMap(row => CRITERION_KEYS.map(key => ({ row, key })));
    const certain = pending.filter(item => needsReaccent(item.row.after[item.key].justification)).length;
    console.log(`Passe ${REACCENT_MODEL} : ${pending.length} phrases (dont ${certain} certainement fautives), ${Math.ceil(pending.length / BATCH)} appels.`);
    if (pending.length > 0) {
      const report = await reaccentTexts(
        pending.map(item => item.row.after[item.key].justification),
        { batchSize: BATCH },
      );
      report.texts.forEach((text, index) => {
        const { row, key } = pending[index]!;
        row.after[key] = { ...row.after[key], justification: text };
      });
      console.log(
        `  ${report.changed} phrases reaccentuees, ${report.rejected} refusees par l'invariant, ${report.failedBatches} lots perdus.`,
      );
    }
  }

  const changed = staged.filter(row =>
    CRITERION_KEYS.some(key => row.after[key].justification !== row.before[key].justification),
  );
  console.log(`\n${changed.length} lignes a mettre a jour.\n`);

  for (const row of changed.slice(0, APPLY ? 0 : 5)) {
    console.log(`— ${row.ticker} (${row.name ?? '?'})`);
    for (const key of CRITERION_KEYS) {
      if (row.after[key].justification === row.before[key].justification) continue;
      console.log(`    avant : ${row.before[key].justification}`);
      console.log(`    apres : ${row.after[key].justification}`);
    }
  }

  if (!APPLY) {
    const left = changed.reduce(
      (sum, row) => sum + CRITERION_KEYS.reduce((n, key) => n + missingAccentWords(row.after[key].justification).length, 0),
      0,
    );
    console.log(`\nSIMULATION : rien n'a ete ecrit. Ajoute --apply pour ecrire.`);
    console.log(`Mots encore connus comme mal accentues apres reparation : ${left} (0 attendu).`);
    return;
  }

  for (const row of changed) {
    await prisma.resilienceStarScore.update({
      where: { ticker: row.ticker },
      data: { criteria: row.after as unknown as Prisma.InputJsonValue },
    });
  }
  console.log(`✅ ${changed.length} lignes mises a jour (texte seul : etoiles, totaux et verdicts inchanges).`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
