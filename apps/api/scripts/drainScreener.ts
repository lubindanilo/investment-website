/**
 * drainScreener — CLI du drain des titres `pending` du screener, exécuté par le runner GitHub
 * (.github/workflows/screener-drain.yml), PAS par Vercel.
 *
 * Enchaînement :
 *   1. lit la consommation compute Neon du mois (API console) ;
 *   2. en déduit la part de CU-heures allouée à ce run, puis la DURÉE que ça représente à la
 *      taille de compute réellement mesurée sur le mois (pas une constante devinée) ;
 *   3. draine la file `pending` dans cette limite, en s'arrêtant net si la part est consommée ;
 *   4. rend un compte-rendu chiffré (coût du run, coût par titre noté, nuits restantes) et sort en
 *      ERREUR si le taux de réussite s'effondre — la garde anti-stall du cron Vercel compte les
 *      timeouts comme du travail fait, c'est ce qui a laissé un job vert noter 6 titres sur 255.
 *
 * Sans NEON_API_KEY le run n'est pas bloqué mais plafonné à BLIND_MAX_MINUTES : draîner à l'aveugle
 * est exactement ce qui a suspendu la base le 20/07/2026.
 */
import { fetchNeonUsage, resolveNeonProjectId, computeDrainBudget, budgetToMinutes } from '../src/services/neonBudget.js';
import { drainPending, requeueAbandoned } from '../src/services/screenerDrain.js';
import { prisma } from '../src/db/client.js';

/** Plafond de durée quand la consommation Neon n'est pas mesurable (clé absente ou API muette). */
const BLIND_MAX_MINUTES = 60;
/** En dessous, le run ne vaut pas le réveil de la base : on saute la nuit. */
const MIN_USEFUL_MINUTES = 5;
/** Nombre de tentatives sous lequel le taux de réussite n'est pas un signal fiable. */
const RATIO_MIN_SAMPLE = 20;

const num = (raw: string | undefined, dflt: number): number => {
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : dflt;
};

async function main(): Promise<void> {
  const askedMinutes = num(process.env.DRAIN_MINUTES, 120);
  const region = (process.env.DRAIN_REGION ?? '').trim().toUpperCase() || undefined;
  const maxTickers = num(process.env.DRAIN_MAX_TICKERS, 5_000);
  const concurrency = num(process.env.DRAIN_CONCURRENCY, 6);
  const batchSize = num(process.env.DRAIN_BATCH, 100);
  const minSuccessRatio = num(process.env.DRAIN_MIN_SUCCESS_RATIO, 0.5);
  const apiKey = (process.env.NEON_API_KEY ?? '').trim();
  const monthlyCuH = num(process.env.NEON_MONTHLY_CU_H, 100);
  const targetShare = num(process.env.NEON_TARGET_SHARE, 0.8);
  const drainShare = num(process.env.NEON_DRAIN_SHARE, 0.5);

  let minutes = askedMinutes;
  let allowanceCuH: number | undefined;
  let readUsage: (() => Promise<number>) | undefined;

  if (!apiKey) {
    minutes = Math.min(askedMinutes, BLIND_MAX_MINUTES);
    console.warn(`⚠️  NEON_API_KEY absente : run à l'aveugle, plafonné à ${minutes} min (aucune mesure du solde compute).`);
  } else {
    // Projet résolu UNE fois : le drain relit la conso plusieurs fois pendant le run.
    const projectId = await resolveNeonProjectId({
      apiKey,
      projectId: process.env.NEON_PROJECT_ID?.trim() || undefined,
      orgId: process.env.NEON_ORG_ID?.trim() || undefined,
    });
    const usage = await fetchNeonUsage({ apiKey, projectId });
    const budget = computeDrainBudget({
      usedCuH: usage.cuHours,
      periodEnd: usage.periodEnd,
      now: new Date(),
      monthlyCuH, targetShare, drainShare,
    });
    const period = usage.periodFromCalendar ? 'mois calendaire (période API non peuplée)' : 'période de facturation Neon';
    console.log(`Neon projet ${usage.projectId} — ${period}, fin le ${usage.periodEnd.toISOString().slice(0, 10)}`);
    console.log(`  consommé      : ${usage.cuHours.toFixed(2)} CU-h sur ${usage.activeHours.toFixed(2)} h d'éveil → ${usage.avgCu.toFixed(2)} CU moyen`);
    console.log(`  plafond visé  : ${budget.ceilingCuH.toFixed(1)} CU-h (${monthlyCuH} × ${targetShare}) → solde ${budget.remainingCuH.toFixed(2)} CU-h sur ${budget.daysLeft} j`);
    console.log(`  part du drain : ${budget.allowanceCuH.toFixed(3)} CU-h (${(drainShare * 100).toFixed(0)} % du solde quotidien de ${budget.dailyCuH.toFixed(3)} CU-h)`);

    if (budget.exhausted) {
      console.warn(`⚠️  Plafond ${budget.ceilingCuH.toFixed(1)} CU-h déjà atteint : run sauté, rien n'est drainé cette nuit.`);
      return;
    }
    const budgetMinutes = budgetToMinutes(budget.allowanceCuH, usage.avgCu);
    minutes = Math.min(askedMinutes, budgetMinutes);
    console.log(`  durée         : ${budgetMinutes} min finançables, ${askedMinutes} min demandées → ${minutes} min retenues`);
    if (minutes < MIN_USEFUL_MINUTES) {
      console.warn(`⚠️  Solde trop faible (${minutes} min) : run sauté pour ne pas réveiller la base pour rien.`);
      return;
    }
    allowanceCuH = budget.allowanceCuH;
    readUsage = async () => (await fetchNeonUsage({ apiKey, projectId })).cuHours;
  }

  if (process.env.DRAIN_REQUEUE_ABANDONED === '1') {
    const requeued = await requeueAbandoned();
    console.log(`Remise en file des titres abandonnés (attempts ≥ 5, sans note) : ${requeued}`);
  }

  console.log(`Drain : région=${region ?? 'toutes'} durée=${minutes} min concurrence=${concurrency} lot=${batchSize} max=${maxTickers} titres`);
  const r = await drainPending({
    region, maxMinutes: minutes, maxTickers, concurrency, batchSize,
    allowanceCuH, readUsage,
    log: line => console.log(line),
  });

  const mins = r.elapsedMs / 60_000;
  const ratio = r.attempted ? r.scored / r.attempted : 0;
  console.log('');
  console.log(`Fin (${r.stopReason}) après ${mins.toFixed(0)} min et ${r.batches} lots`);
  console.log(`  tentés ${r.attempted} → notés ${r.scored} | nodata ${r.nodata} | error ${r.error} | timeout ${r.timeout}`);
  console.log(`  taux de réussite : ${(ratio * 100).toFixed(0)} %`);
  if (r.scored > 0 && mins > 0) console.log(`  débit : ${(r.scored / mins).toFixed(1)} titres notés/min`);
  if (r.cuHoursSpent != null) {
    console.log(`  coût Neon mesuré : ${r.cuHoursSpent.toFixed(3)} CU-h${r.scored ? ` (${(r.cuHoursSpent / r.scored * 1000).toFixed(2)} mCU-h par titre noté)` : ''}`);
  }
  if (r.pendingLeft >= 0) {
    console.log(`  reste en attente : ${r.pendingLeft}${r.scored ? ` → ~${Math.ceil(r.pendingLeft / r.scored)} nuits à ce rythme` : ''}`);
  }

  // Garde anti-stall HONNÊTE : un timeout ou une erreur n'est pas du travail fait.
  if (r.attempted >= RATIO_MIN_SAMPLE && ratio < minSuccessRatio) {
    console.error(`::error::Taux de réussite ${(ratio * 100).toFixed(0)} % sous le seuil de ${(minSuccessRatio * 100).toFixed(0)} % (${r.scored}/${r.attempted}) — scoring dégradé, pas un simple retard.`);
    process.exitCode = 1;
  }
}

main()
  .catch((e: Error) => {
    console.error(`::error::Drain en échec : ${e.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
