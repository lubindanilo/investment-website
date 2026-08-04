/**
 * Test comparatif du scoreur Resilience 5 etoiles, cohorte fraiche de 20
 * entreprises : DeepSeek-V3 (candidat pas cher + deterministe) vs Sonnet
 * (reference validee). R1 abandonne (trop lent/couteux : sur-raisonne).
 *
 *   npm run resilience:stars:deepseek-test            # V3 + Sonnet(ref)
 *   npm run resilience:stars:deepseek-test -- no-ref  # V3 seul (economise l'abonnement)
 */
import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { scoreCompanies, CRITERION_KEYS, type ResilienceStarScore } from '../src/services/resilienceStars.js';
import { scoreCompaniesDeepseek, hasDeepseekKey } from '../src/services/resilienceStarsDeepseek.js';
import { FRESH20_COHORT } from '../src/services/resilienceStarsUniverseFresh20.js';

function byName(scores: ResilienceStarScore[]): Map<string, ResilienceStarScore> {
  return new Map(scores.map(s => [s.name, s]));
}

async function main(): Promise<void> {
  if (!hasDeepseekKey()) {
    console.error('DEEPSEEK_API_KEY absent. Pose-la dans apps/api/.env puis relance.');
    process.exit(1);
  }
  const withRef = process.argv.includes('ref'); // defaut : V3 seul ; ajouter 'ref' pour la reference Sonnet

  console.log('DeepSeek-V3 (deepseek-chat)...');
  const v3 = byName(await scoreCompaniesDeepseek(FRESH20_COHORT, { model: 'deepseek-chat', chunkSize: 6, maxTokens: 8000 }));
  await mkdir('.data', { recursive: true });
  await writeFile('.data/deepseek_v3_fresh20.json', `${JSON.stringify([...v3.values()], null, 2)}\n`, 'utf8');

  let sonnet = new Map<string, ResilienceStarScore>();
  if (withRef) {
    console.log('Sonnet (reference, via CLI)...');
    sonnet = byName(await scoreCompanies(FRESH20_COHORT));
  }

  console.log(`\n| Entreprise | ${withRef ? 'Sonnet | ' : ''}V3 | ecart |`);
  const gaps: { name: string; gap: number }[] = [];
  for (const c of FRESH20_COHORT) {
    const s = sonnet.get(c.name)?.total;
    const v = v3.get(c.name)?.total ?? NaN;
    const gap = withRef && typeof s === 'number' ? Math.abs(v - s) : 0;
    gaps.push({ name: c.name, gap });
    console.log(`| ${c.name.padEnd(20)} | ${withRef ? `${s ?? '-'} | ` : ''}${v} | ${withRef ? gap.toFixed(1) : '-'} |`);
  }

  if (withRef) {
    const within = gaps.filter(g => g.gap <= 0.5).length;
    const disagree = gaps.filter(g => g.gap >= 1).map(g => g.name);
    console.log(`\nConcordance V3 vs Sonnet: ${within}/${FRESH20_COHORT.length} a +-0,5 etoile.`);
    console.log(`Desaccords >= 1 etoile: ${disagree.length ? disagree.join(', ') : 'aucun'}.`);
  }

  console.log('\n=== Justifications V3 ===');
  for (const c of FRESH20_COHORT) {
    const s = v3.get(c.name);
    if (!s) continue;
    console.log(`\n### ${c.name} — ${s.total}/5`);
    for (const k of CRITERION_KEYS) {
      console.log(`  ${k} ${s.criteria[k].star}: ${s.criteria[k].justification}`);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
