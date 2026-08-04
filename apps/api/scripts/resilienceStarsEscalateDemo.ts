/**
 * Demo du detecteur de cas litigieux, a moindre cout.
 *
 * Reutilise le run 1 deja persiste (store du cron) comme premier passage, fait
 * UN passage CLI frais (run 2), et liste les entreprises litigieuses (totaux
 * divergents) = celles qui seraient escaladees a l'API temperature 0.
 *
 *   npm run resilience:stars:escalate-demo
 */
import { readFile } from 'node:fs/promises';
import { scoreCompanies } from '../src/services/resilienceStars.js';
import { detectStable } from '../src/services/resilienceStarsResolve.js';
import { hasApiKey } from '../src/services/resilienceStarsApi.js';
import { TOP20_UNIVERSE } from '../src/services/resilienceStarsUniverseTop20.js';
import type { ResilienceStarScore } from '../src/services/resilienceStars.js';

const storePath = process.env.RESILIENCE_STARS_STORE ?? '.data/resilience-stars-store.json';

async function loadRun1(): Promise<ResilienceStarScore[]> {
  const store = JSON.parse(await readFile(storePath, 'utf8')) as Record<string, ResilienceStarScore & { ticker: string }>;
  return TOP20_UNIVERSE.map(u => {
    const s = store[u.ticker];
    return { name: u.name, total: s.total, model: s.model, criteria: s.criteria };
  });
}

async function main(): Promise<void> {
  const run1 = await loadRun1();
  console.log('Run 1 charge depuis le store. Passage CLI frais (run 2)...');
  const run2 = await scoreCompanies(TOP20_UNIVERSE.map(u => ({ name: u.name, brief: u.brief })));

  const detected = detectStable([run1, run2]);
  const litigious: string[] = [];
  console.log('\n| Entreprise | run1 | run2 | etat |');
  for (const u of TOP20_UNIVERSE) {
    const info = detected.get(u.name);
    if (!info) continue;
    const [t1, t2] = info.totals;
    const state = info.stable ? 'stable' : 'LITIGIEUX -> API temp 0';
    if (!info.stable) litigious.push(u.name);
    console.log(`| ${u.name.padEnd(22)} | ${t1} | ${t2} | ${state} |`);
  }

  console.log(`\nLitigieux: ${litigious.length}/${TOP20_UNIVERSE.length} (${litigious.join(', ') || 'aucun'}).`);
  console.log(`Cle API presente pour l'escalade: ${hasApiKey() ? 'OUI' : 'NON (pose ANTHROPIC_API_KEY pour resoudre)'}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
