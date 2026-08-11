import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
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
 * DECOUPAGE. `--limit` prend les N plus grosses capitalisations, `--offset` saute les N premieres :
 * ensemble ils decoupent la file en tranches DISJOINTES et reprenables. Sans offset, un run tue par
 * le `timeout` du runner ne pourrait pas reprendre ou il s'est arrete, il refeirait les memes.
 * Mesure du 11/08/2026 : ~46 s par appel de 20 phrases, soit ~4 tickers/appel. Compter une tranche
 * de 700 tickers par job pour rester loin des 4 h de `timeout` (et des 6 h ou GitHub tue le runner).
 *
 * SAUVEGARDE. En mode `--apply`, le texte AVANT est ecrit dans `--backup <fichier>` avant la
 * premiere ecriture. Une justification est une sortie de LLM : ecrasee, elle n'est pas
 * regenerable a l'identique. Le workflow archive ce fichier en artefact.
 *
 *   pnpm --filter @lubin/api run resilience:stars:reaccent                            # simulation
 *   pnpm --filter @lubin/api run resilience:stars:reaccent -- --apply                 # ecrit en base
 *   pnpm --filter @lubin/api run resilience:stars:reaccent -- --limit 20              # pilote
 *   pnpm --filter @lubin/api run resilience:stars:reaccent -- --limit 700 --offset 700  # tranche 2
 *   pnpm --filter @lubin/api run resilience:stars:reaccent -- --no-llm                # deterministe seul
 */
const APPLY = process.argv.includes('--apply');
const NO_LLM = process.argv.includes('--no-llm');
const LIMIT = readNumber('--limit');
const OFFSET = readNumber('--offset', true);
const BATCH = readNumber('--batch') ?? 20;
const BACKUP = readString('--backup');

function readNumber(flag: string, allowZero = false): number | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = Number(process.argv[index + 1]);
  if (!Number.isFinite(value)) return undefined;
  return value > 0 || (allowZero && value === 0) ? value : undefined;
}

function readString(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
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
  const total = await prisma.resilienceStarScore.count();
  const rows = await prisma.resilienceStarScore.findMany({
    select: { ticker: true, name: true, criteria: true },
    // Tri STABLE : `marketCapUsd` seul laisse les nulls et les ex aequo dans un ordre libre, et
    // deux tranches successives pourraient alors se recouvrir ou sauter une ligne. Le ticker,
    // unique, fixe l'ordre.
    orderBy: [{ marketCapUsd: 'desc' }, { ticker: 'asc' }],
    take: LIMIT,
    skip: OFFSET,
  });
  const window = LIMIT || OFFSET ? ` (tranche ${OFFSET ?? 0}..${(OFFSET ?? 0) + rows.length})` : '';
  console.log(`${rows.length} lignes lues sur ${total} en base${window}.`);
  if (OFFSET !== undefined && OFFSET + rows.length < total) {
    console.log(`Reste ${total - OFFSET - rows.length} lignes : relancer avec offset ${OFFSET + rows.length}.`);
  }

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

  // Sauvegarde AVANT la premiere ecriture, jamais apres : une justification est une sortie de LLM,
  // ecrasee elle ne se regenere pas a l'identique. Si l'ecriture du fichier echoue, on n'ecrit
  // rien en base (le throw remonte) plutot que de perdre le texte d'origine.
  if (BACKUP) {
    const snapshot = changed.map(row => ({ ticker: row.ticker, criteria: row.before }));
    await writeFile(BACKUP, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    console.log(`Sauvegarde du texte d'origine : ${BACKUP} (${snapshot.length} lignes).`);
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
