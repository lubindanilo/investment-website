import 'dotenv/config';
import { runBackfill } from '../src/services/resilienceStarsBackfill.js';

const dailyCap = Number(process.argv[2] ?? process.env.RESILIENCE_STARS_DAILY_CAP ?? 250);

async function main(): Promise<void> {
  console.log(`Backfill Resilience 5 etoiles — plafond=${dailyCap}`);
  // Sonnet (mediane) = la note autoritaire. V3 note ~1 etoile plus haut en moyenne, donc on ne
  // flagge que les VRAIS desaccords (>= 1,5 etoile), pas la generosite normale de V3.
  const r = await runBackfill({ dailyCap, crossCheck: { threshold: 1.5 } });
  console.log(`Scorees: ${r.scored} (dont ${r.flagged} en revue) | restant a scorer: ${r.remaining}/${r.totalUniverse}`);
  if (r.copiedFromHomonym > 0) {
    console.log(`Recopiees depuis un homonyme deja note (aucun appel aux modeles) : ${r.copiedFromHomonym}`);
  }
  if (r.skippedNoCrossCheck > 0) {
    console.log(`Sans note ou sans controle croise, NON ecrites, a repiocher demain : ${r.skippedNoCrossCheck}`);
  }

  // Sortie en erreur quand du travail a ete perdu, ou qu'un run n'a rien produit alors qu'il restait
  // des candidats. Sans ca le job reste vert sur une panne : c'est le mode d'echec qui a cache
  // l'arret du scoring du screener pendant 40 jours.
  if (r.failedBatches > 0) {
    console.error(`ECHEC : ${r.failedBatches} tranche(s) perdue(s).`);
    process.exit(1);
  }
  if (r.scored === 0 && r.remaining > 0 && dailyCap > 0) {
    console.error('ECHEC : aucune entreprise notee alors qu il restait des candidats.');
    process.exit(1);
  }
}

main().catch(error => { console.error(error); process.exit(1); });
