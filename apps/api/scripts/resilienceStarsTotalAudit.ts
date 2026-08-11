import 'dotenv/config';
import { prisma } from '../src/db/client.js';
import { aggregateTotal, publicCriteriaSchema } from '../src/services/resilienceStars.js';

/**
 * Audit des TOTAUX deja ecrits dans ResilienceStarScore : le chiffre en tete d'une note dit-il la
 * meme chose que les cinq etoiles affichees juste en dessous ?
 *
 * POURQUOI CE SCRIPT EXISTE. Le controle croise composait la note retenue ainsi :
 * `{ ...base, total: median(sonnetTotals) }` — les CRITERES venaient du passage Sonnet de base, le
 * TOTAL de la mediane des passages. Tant qu'aucune escalade n'avait lieu les deux coincidaient ; des
 * qu'un desaccord avec V3 declenchait deux passages de plus, le total pouvait sortir d'un passage
 * dont on ne gardait pas les criteres. La ligne affichait alors un total contredisant son propre
 * detail (apps/web/src/components/ResilienceStars.tsx lit `score.total` et `score.criteria` sur la
 * MEME ligne). Le correctif (`pickSonnetPass`, resilienceStarsCrossCheck.ts) garantit desormais que
 * total et criteres viennent du meme passage, mais il ne repare pas les lignes ecrites avant lui :
 * c'est l'objet d'ici.
 *
 * DEUX DEFAUTS, l'un inclus dans l'autre :
 *   1. `total` hors de la grille {0 ; 0,5 ; 1 ; ... ; 5}. Le quart d'etoile, signature d'une mediane
 *      sur un nombre PAIR de passages (l'ancienne moyennait les deux centraux). Cas UA/UAA du
 *      11/08/2026, deja supprimes pour re-notation (campagne `revue-manuelle-2026-08-11`).
 *   2. `total` different de la somme des cinq `criteria[k].star`. Defaut plus large : un total sur la
 *      grille peut parfaitement contredire son detail. Toute ligne du cas 1 est aussi du cas 2.
 *
 * LECTURE SEULE. Rien n'est ecrit ni supprime. Deux reparations sont possibles et le choix n'est pas
 * technique : reecrire `total = aggregateTotal(criteria)` rend la ligne coherente sans rien payer,
 * mais jette l'arbitrage de l'escalade ; supprimer la ligne la fait re-noter par le backfill sous le
 * code corrige, au prix d'un appel modele et d'une absence de note en attendant. A trancher par
 * Lubin, cas par cas, dans scripts/resilienceStarsManualReview.ts.
 *
 *   pnpm --filter @lubin/api exec tsx scripts/resilienceStarsTotalAudit.ts
 *   pnpm --filter @lubin/api exec tsx scripts/resilienceStarsTotalAudit.ts --csv
 */

interface Defect {
  ticker: string;
  name: string;
  /** Total tel qu'il est en base, celui que l'UI affiche en tete de carte. */
  total: number;
  /** Somme des cinq etoiles, celle que le detail affiche juste en dessous. */
  sum: number;
  offGrid: boolean;
  verdict: string;
  /** Totaux des passages Sonnet, quand ils ont ete traces : c'est la piece a conviction. */
  sonnetTotals: number[] | null;
  v3Total: number | null;
  scoredAt: string;
}

/** Un total legitime tombe sur la demi-etoile, entre 0 et 5. Rien d'autre n'est atteignable. */
function onGrid(total: number): boolean {
  return Number.isFinite(total) && total >= 0 && total <= 5 && Number.isInteger(total * 2);
}

function readSonnetTotals(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const nums = value.filter((v): v is number => typeof v === 'number');
  return nums.length === value.length ? nums : null;
}

/**
 * La mediane telle que l'ANCIEN controle croise la calculait, moyenne des deux valeurs centrales
 * comprise. Recopiee ici volontairement, et non importee : ce script explique des lignes ecrites
 * par un code qui n'existe plus. `pickSonnetTotal` decrit ce qui se passe MAINTENANT (un total
 * vient toujours d'un passage reel), il ne reproduirait donc pas le total qu'on cherche a expliquer.
 * Cette copie est de l'histoire figee : elle ne doit plus jamais suivre le code de production.
 */
function legacyMedian(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * D'ou vient l'ecart, quand les totaux Sonnet ont ete traces. Le motif attendu est celui de
 * l'ancien code : les criteres viennent du passage de base, le total de la mediane des passages.
 */
function diagnose(defect: Defect): string {
  const totals = defect.sonnetTotals;
  if (!totals || totals.length === 0) return 'sonnetTotals absents';
  const base = totals[0]!;
  const med = legacyMedian(totals);
  if (defect.sum === base && defect.total === med && totals.length > 1) {
    return `mediane d'escalade (base ${base}, passages ${totals.join('+')})`;
  }
  if (defect.total === med) return `mediane (passages ${totals.join('+')})`;
  return `hors motif connu (passages ${totals.join('+')})`;
}

const stars = (n: number): string => n.toString().replace('.', ',');

function show(defect: Defect): string {
  return [
    `   ${defect.ticker.padEnd(12)}`,
    defect.name.slice(0, 34).padEnd(34),
    `total ${stars(defect.total).padStart(4)}`,
    `somme ${stars(defect.sum).padStart(4)}`,
    defect.verdict.padEnd(8),
    defect.scoredAt.slice(0, 10),
    ` ${diagnose(defect)}`,
  ].join(' ');
}

async function main(): Promise<void> {
  try {
    await audit();
  } finally {
    await prisma.$disconnect();
  }
}

async function audit(): Promise<void> {
  const csv = process.argv.includes('--csv');

  const rows = await prisma.resilienceStarScore.findMany({
    select: {
      ticker: true, name: true, total: true, criteria: true,
      verdict: true, sonnetTotals: true, v3Total: true, scoredAt: true,
    },
  });

  const defects: Defect[] = [];
  /**
   * Lignes dont `criteria` ne passe pas le schema public : la somme n'est pas calculable, donc ni le
   * defaut 1 ni le defaut 2 n'y sont verifiables. Elles ne s'affichent deja pas (toPublicStars les
   * rejette), mais elles occupent la place et empechent le backfill de repiocher le ticker.
   */
  const unreadable: string[] = [];

  for (const row of rows) {
    const parsed = publicCriteriaSchema.safeParse(row.criteria);
    if (!parsed.success) {
      unreadable.push(`   ${row.ticker.padEnd(12)} ${(row.name ?? '?').slice(0, 34).padEnd(34)} total ${stars(row.total).padStart(4)}  ${parsed.error.issues[0]?.path.join('.') ?? '?'} : ${parsed.error.issues[0]?.message ?? '?'}`);
      continue;
    }
    const sum = aggregateTotal(parsed.data);
    const offGrid = !onGrid(row.total);
    // Les etoiles ne valent que 0, 0,5 ou 1 : leur somme est exacte en binaire, l'egalite stricte
    // suffit. Un total pose ailleurs (mediane d'une moyenne) l'est tout autant.
    if (!offGrid && row.total === sum) continue;
    defects.push({
      ticker: row.ticker,
      name: row.name ?? row.ticker,
      total: row.total,
      sum,
      offGrid,
      verdict: row.verdict,
      sonnetTotals: readSonnetTotals(row.sonnetTotals),
      v3Total: row.v3Total,
      scoredAt: row.scoredAt.toISOString(),
    });
  }

  const gap = (d: Defect): number => Math.abs(d.total - d.sum);
  defects.sort((a, b) => gap(b) - gap(a) || a.ticker.localeCompare(b.ticker));

  const offGrid = defects.filter(d => d.offGrid);
  // Le cas 1 est inclus dans le cas 2 : on l'isole ici pour ne pas le compter deux fois a l'ecran.
  const mismatchOnly = defects.filter(d => !d.offGrid);

  if (csv) {
    console.log('ticker,name,total,somme,ecart,horsGrille,verdict,sonnetTotals,v3Total,scoredAt');
    for (const d of defects) {
      const name = `"${d.name.replace(/"/g, '""')}"`;
      console.log([
        d.ticker, name, d.total, d.sum, +(d.total - d.sum).toFixed(2), d.offGrid ? 'oui' : 'non',
        d.verdict, `"${d.sonnetTotals?.join('+') ?? ''}"`, d.v3Total ?? '', d.scoredAt,
      ].join(','));
    }
    return;
  }

  console.log(`Base : ${rows.length} notes de resilience, ${defects.length} incoherente(s), ${unreadable.length} illisible(s).\n`);

  console.log(`=== 1. TOTAL HORS GRILLE {0 ; 0,5 ; ... ; 5} : ${offGrid.length} ligne(s) ===\n`);
  console.log(offGrid.length ? offGrid.map(show).join('\n') : '   Aucune.');

  console.log(`\n=== 2. TOTAL != SOMME DES 5 CRITERES, total sur la grille : ${mismatchOnly.length} ligne(s) ===\n`);
  console.log(mismatchOnly.length ? mismatchOnly.map(show).join('\n') : '   Aucune.');
  console.log(`\n   (defaut 2 au sens large, cas 1 compris : ${defects.length} ligne(s).)`);

  console.log(`\n=== CRITERES ILLISIBLES, ni 1 ni 2 verifiables : ${unreadable.length} ligne(s) ===\n`);
  console.log(unreadable.length ? unreadable.join('\n') : '   Aucune.');

  if (defects.length > 0) {
    console.log('\n   LECTURE SEULE : rien n\'a ete modifie. La reparation se decide ligne par ligne');
    console.log('   (reecrire le total sur la somme, ou supprimer pour re-notation) dans');
    console.log('   scripts/resilienceStarsManualReview.ts, apres accord de Lubin.');
  }
}

main().catch((e: Error) => { console.error(e); process.exit(1); });
