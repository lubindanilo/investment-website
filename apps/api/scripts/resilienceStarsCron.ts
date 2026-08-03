/**
 * Cron de scoring Resilience 5 etoiles.
 *
 * Ordre = capitalisation DECROISSANTE. Plafond quotidien configurable. Scores
 * persistes (on ne re-score pas une entreprise deja notee). Passe par le CLI
 * `claude` (aucune cle API).
 *
 *   npm run resilience:stars:cron               # plafond par defaut (env ou 20)
 *   RESILIENCE_STARS_DAILY_CAP=40 npm run resilience:stars:cron
 *   npm run resilience:stars:cron -- 5          # plafond = 5 (arg prioritaire)
 *
 * Univers de TEST = top 20 mega-caps. La production derivera l'univers de
 * sp500Universe + market cap Finnhub.
 */
import { runResilienceCron } from '../src/services/resilienceStarsCron.js';
import { TOP20_UNIVERSE } from '../src/services/resilienceStarsUniverseTop20.js';

const dailyCap = Number(process.argv[2] ?? process.env.RESILIENCE_STARS_DAILY_CAP ?? 20);
const storePath = process.env.RESILIENCE_STARS_STORE ?? '.data/resilience-stars-store.json';
const now = new Date().toISOString();

async function main(): Promise<void> {
  console.log(`Cron Resilience 5 etoiles — plafond=${dailyCap}, univers=${TOP20_UNIVERSE.length}, store=${storePath}`);
  const report = await runResilienceCron(TOP20_UNIVERSE, { dailyCap, storePath, now });

  if (report.scored.length === 0) {
    console.log(`Rien a scorer (tout deja fait ?). Restant: ${report.remaining}/${report.totalUniverse}.`);
    return;
  }

  const byCap = [...report.scored].sort((a, b) => b.marketCapUsd - a.marketCapUsd);
  console.log('\n| Rang capi | Ticker | Entreprise | Total | B/C/Fo/Ad/Ca |');
  byCap.forEach((s, i) => {
    const stars = (['besoin', 'controle', 'forces', 'adjacent', 'capture'] as const)
      .map(k => s.criteria[k].star)
      .join('/');
    console.log(`| ${String(i + 1).padStart(2)} | ${s.ticker.padEnd(5)} | ${s.name.padEnd(22)} | ${s.total} | ${stars} |`);
  });

  console.log('\n=== Justifications ===');
  for (const s of byCap) {
    console.log(`\n### ${s.name} (${s.ticker}) — ${s.total}/5`);
    for (const k of ['besoin', 'controle', 'forces', 'adjacent', 'capture'] as const) {
      console.log(`  ${k} ${s.criteria[k].star}: ${s.criteria[k].justification}`);
    }
  }

  console.log(`\nScorees: ${report.scored.length}. Restant a scorer: ${report.remaining}/${report.totalUniverse}.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
