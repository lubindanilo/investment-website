import 'dotenv/config';
import { runBackfill } from '../src/services/resilienceStarsBackfill.js';

const dailyCap = Number(process.argv[2] ?? process.env.RESILIENCE_STARS_DAILY_CAP ?? 250);

async function main(): Promise<void> {
  console.log(`Backfill Resilience 5 etoiles — plafond=${dailyCap}`);
  // Sonnet (mediane) = la note autoritaire. V3 note ~1 etoile plus haut en moyenne, donc on ne
  // flagge que les VRAIS desaccords (>= 1,5 etoile), pas la generosite normale de V3.
  const r = await runBackfill({ dailyCap, crossCheck: { threshold: 1.5 } });
  console.log(`Scorees: ${r.scored} (dont ${r.flagged} en revue) | restant a scorer: ${r.remaining}/${r.totalUniverse}`);
}

main().catch(error => { console.error(error); process.exit(1); });
