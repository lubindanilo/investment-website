/**
 * Harnais de non-regression du modele Resilience 5 etoiles.
 *
 * Score les fixtures (20 calibrees + 18 fraiches) via le CLI `claude` (aucune
 * cle API) et compare a la note attendue, tolerance +-0,5 etoile. A lancer
 * MANUELLEMENT (il consomme l'abonnement Claude), pas en CI.
 *
 *   npm run resilience:stars:bench            # tout
 *   npm run resilience:stars:bench -- fresh   # cohorte fraiche seulement
 *   npm run resilience:stars:bench -- calib   # calibrees seulement
 */
import { scoreCompanies } from '../src/services/resilienceStars.js';
import { CALIBRATED, FRESH, ALL_FIXTURES, STAR_TOLERANCE, type ResilienceFixture } from '../src/services/resilienceStarsFixtures.js';

const arg = process.argv[2];
const fixtures: ResilienceFixture[] =
  arg === 'fresh' ? FRESH : arg === 'calib' ? CALIBRATED : ALL_FIXTURES;

async function main(): Promise<void> {
  console.log(`Scoring ${fixtures.length} entreprises via le CLI claude...`);
  const scores = await scoreCompanies(fixtures);

  let matches = 0;
  for (const fixture of fixtures) {
    const score = scores.find(s => s.name === fixture.name);
    if (!score) {
      console.log(`XX ${fixture.name.padEnd(24)} pas de score`);
      continue;
    }
    const diff = score.total - fixture.expected;
    const ok = Math.abs(diff) <= STAR_TOLERANCE;
    if (ok) matches += 1;
    const stars = (['besoin', 'controle', 'forces', 'adjacent', 'capture'] as const)
      .map(k => score.criteria[k].star)
      .join('/');
    console.log(
      `${ok ? 'OK' : 'XX'} ${fixture.name.padEnd(24)} attendu=${fixture.expected} modele=${score.total} [${stars}] d=${diff.toFixed(1)}`,
    );
  }

  const rate = matches / fixtures.length;
  console.log(`\nConcordance: ${matches}/${fixtures.length} (${Math.round(rate * 100)}%)`);
  // Seuil de reussite : la cible ~17-18/20, soit 85%.
  if (rate < 0.85) {
    console.error('SOUS LE SEUIL (85%).');
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
