/**
 * Test comparatif du scoreur Resilience 5 etoiles sur 3 modeles, cohorte
 * fraiche de 20 entreprises : DeepSeek-V3, DeepSeek-R1 et Sonnet (reference
 * validee). But : voir si DeepSeek reproduit le jugement calibre.
 *
 *   # 1. Poser la cle DeepSeek (voir README ou le message d'aide ci-dessous)
 *   # 2. Lancer :
 *   npm run resilience:stars:deepseek-test            # V3 + R1 + Sonnet(ref)
 *   npm run resilience:stars:deepseek-test -- no-ref  # sans Sonnet (economise l'abonnement)
 */
import 'dotenv/config';
import { scoreCompanies, type ResilienceStarScore } from '../src/services/resilienceStars.js';
import { scoreCompaniesDeepseek, hasDeepseekKey } from '../src/services/resilienceStarsDeepseek.js';
import { FRESH20_COHORT } from '../src/services/resilienceStarsUniverseFresh20.js';

function byName(scores: ResilienceStarScore[]): Map<string, ResilienceStarScore> {
  return new Map(scores.map(s => [s.name, s]));
}

async function main(): Promise<void> {
  if (!hasDeepseekKey()) {
    console.error('DEEPSEEK_API_KEY absent. Pose-la puis relance :\n');
    console.error("  printf 'DEEPSEEK_API_KEY=%s\\n' 'sk-TA_CLE_DEEPSEEK' >> apps/api/.env");
    console.error('\n(ou, sans fichier :  DEEPSEEK_API_KEY=sk-... npm run resilience:stars:deepseek-test )');
    process.exit(1);
  }
  const withRef = process.argv[2] !== 'no-ref';

  console.log('DeepSeek-V3 (deepseek-chat)...');
  const v3 = byName(await scoreCompaniesDeepseek(FRESH20_COHORT, { model: 'deepseek-chat' }));
  console.log('DeepSeek-R1 (deepseek-reasoner)...');
  const r1 = byName(await scoreCompaniesDeepseek(FRESH20_COHORT, { model: 'deepseek-reasoner' }));
  let sonnet = new Map<string, ResilienceStarScore>();
  if (withRef) {
    console.log('Sonnet (reference, via CLI)...');
    sonnet = byName(await scoreCompanies(FRESH20_COHORT));
  }

  console.log(`\n| Entreprise | ${withRef ? 'Sonnet | ' : ''}V3 | R1 | ecart |`);
  let maxGap = 0;
  const gaps: { name: string; gap: number }[] = [];
  for (const c of FRESH20_COHORT) {
    const a = sonnet.get(c.name)?.total;
    const b = v3.get(c.name)?.total ?? NaN;
    const d = r1.get(c.name)?.total ?? NaN;
    const vals = [a, b, d].filter((x): x is number => typeof x === 'number' && !Number.isNaN(x));
    const gap = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
    maxGap = Math.max(maxGap, gap);
    gaps.push({ name: c.name, gap });
    console.log(`| ${c.name.padEnd(20)} | ${withRef ? `${a ?? '-'} | ` : ''}${b} | ${d} | ${gap.toFixed(1)} |`);
  }

  console.log(`\nEcart max entre modeles: ${maxGap.toFixed(1)} etoile(s).`);
  const disagree = gaps.filter(g => g.gap >= 1).map(g => g.name);
  console.log(`Desaccords >= 1 etoile: ${disagree.length ? disagree.join(', ') : 'aucun'}.`);
  console.log('\nModele: juger si V3/R1 reproduisent Sonnet et ton intuition. Justifications dans le JSON si besoin.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
