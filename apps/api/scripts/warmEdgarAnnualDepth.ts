/**
 * Réchauffe la profondeur annuelle EDGAR des ADR 20-F, d'un coup au lieu d'attendre la demande.
 *
 * CONTEXTE
 * Depuis #249, les graphes annuels des déposants 20-F étrangers vont chercher chez EDGAR les
 * 14-18 exercices en devise NATIVE que Yahoo ne donne pas (il plafonne à ~4). L'opération est
 * one-shot par ticker : une fois les exercices anciens en base, l'append-only les garde et le
 * seuil de profondeur de yahooAnnualStore court-circuite tout nouvel appel SEC.
 *
 * Mais elle se déclenche AU PREMIER ACCÈS de chaque fiche. Un ADR que personne n'ouvre reste
 * donc à 4 exercices, et le premier visiteur paye l'attente. Ce script fait le tour d'avance.
 *
 * CE QU'IL ÉCRIT — et pourquoi c'est sans risque
 * Il appelle le MÊME chemin que la consultation d'une fiche (getYahooAnnualBatchCached), donc :
 *   - la fusion reste APPEND-ONLY : aucun point existant n'est écrasé, on ne fait qu'ajouter
 *     les exercices absents (Yahoo prime sur collision de date) ;
 *   - la calibration ADS des shares s'applique normalement ;
 *   - un ticker déjà profond ne déclenche aucun appel SEC.
 * Autrement dit, il ne produit rien que la première visite n'aurait produit — juste plus tôt.
 *
 * COÛT NEON — c'est le facteur limitant du projet, pas les API
 * Le sondage SEC qui identifie les ADR ne touche PAS la base, mais il dure ~30 min. On ferme
 * donc la connexion pendant cette phase : l'endpoint Neon Free se suspend au bout de 5 min
 * d'inactivité, et ne se réveille que pour la phase d'écriture. Sans ça le compute tournerait
 * une demi-heure à ne rien faire.
 * `--tickers=A,B,C` saute entièrement le sondage quand la liste est déjà connue (elle l'est,
 * cf scripts/auditAdrShares.ts) : c'est le mode le moins cher.
 * Le script reste SÉQUENTIEL et bornable par --limit, à lancer hors des fenêtres de scoring.
 *
 * USAGE (dry-run par défaut, n'écrit rien) :
 *   DATABASE_URL=... tsx scripts/warmEdgarAnnualDepth.ts [--limit=200]
 *   DATABASE_URL=... tsx scripts/warmEdgarAnnualDepth.ts --apply --tickers=BABA,TCOM,NTES
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { secReportingProfile } from '../src/services/secEdgar.js';
import { getYahooAnnualBatchCached } from '../src/services/yahooAnnualStore.js';
import { resolveYahooTicker } from '../src/services/yahooResolve.js';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const LIMIT = Number((process.argv.find(a => a.startsWith('--limit=')) ?? '--limit=0').split('=')[1]) || Infinity;
const EXPLICIT = ((process.argv.find(a => a.startsWith('--tickers=')) ?? '').split('=')[1] ?? '')
  .split(',').map(t => t.trim().toUpperCase()).filter(Boolean);

/**
 * Types réchauffés : exactement ceux que consomment les trois chemins de graphes annuels
 * (ratios, Cash ROCE, P/FCF) et le CCC. Les demander en UN batch fait une seule requête Yahoo
 * et une seule passe EDGAR par ticker.
 */
const TYPES = [
  // Cash ROCE annuel (annualTotalDebt sert aussi son repli secteur financier)
  'annualFreeCashFlow', 'annualTotalAssets', 'annualCurrentLiabilities', 'annualGoodwill',
  'annualCashAndShortTermInvestments', 'annualCashAndCashEquivalents', 'annualTotalRevenue',
  'annualStockholdersEquity',
  // P/FCF annuel
  'annualDilutedAverageShares',
  // netDebtFcf annuel (dette vérifiée contre Yahoo avant fusion, cf composeVerifiedDebt)
  'annualTotalDebt',
  // CCC annuel
  'annualCostOfRevenue', 'annualAccountsReceivable', 'annualInventory', 'annualAccountsPayable',
];

/** Profondeur = écart entre le plus ancien exercice stocké et aujourd'hui, en années. */
function depthYears(points: Array<{ date: string }>, nowMs: number): number {
  if (!points.length) return 0;
  return (nowMs - Date.parse(points[0]!.date)) / (365.25 * 24 * 3600 * 1000);
}

async function main(): Promise<void> {
  // Candidats : titres cotés aux US (un ticker suffixé n'a pas de CIK, donc pas d'EDGAR),
  // déjà notés, avec une capitalisation connue — on réchauffe les plus consultés d'abord.
  const candidates = await prisma.screenerTicker.findMany({
    where: {
      ticker: EXPLICIT.length ? { in: EXPLICIT } : { not: { contains: '.' } },
      status: 'scored',
      marketCapUsd: { not: null },
    },
    select: { ticker: true, name: true, marketCapUsd: true },
    orderBy: { marketCapUsd: 'desc' },
  });

  let targets: typeof candidates;
  if (EXPLICIT.length) {
    // Liste fournie : on fait confiance à l'appelant (elle vient d'auditAdrShares.ts) et on
    // économise ~30 min de sondage SEC.
    targets = candidates.slice(0, Number.isFinite(LIMIT) ? LIMIT : undefined);
    console.log(`${targets.length} titres fournis explicitement (sondage SEC sauté).`);
  } else {
    // Le sondage ne touche pas la base : on ferme la connexion pour laisser l'endpoint Neon se
    // suspendre pendant la demi-heure que ça prend, au lieu de payer du compute à ne rien faire.
    await prisma.$disconnect();
    console.log(`${candidates.length} titres US-listés notés. Sonde la devise de reporting chez SEC (connexion DB fermée)…`);
    const found: typeof candidates = [];
    let probed = 0;
    for (const c of candidates) {
      // Deux populations ont une profondeur EDGAR : les déposants us-gaap en devise NATIVE
      // (~221) et les déposants IFRS quelle que soit leur devise (~478 — beaucoup publient en
      // USD, comme NVS ou SHEL, et c'est leur vraie devise de publication).
      const profile = await secReportingProfile(c.ticker).catch(() => null);
      if (profile && (profile.taxonomy === 'ifrs-full' || profile.currency !== 'USD')) found.push(c);
      if (++probed % 500 === 0) console.log(`  … ${probed}/${candidates.length} sondés, ${found.length} cibles trouvées`);
      if (found.length >= LIMIT) break;
      await new Promise(r => setTimeout(r, 120)); // SEC ≤10 req/s, on reste loin dessous
    }
    targets = found;
  }
  console.log(`\n${targets.length} déposants en devise étrangère à réchauffer.`);

  if (!APPLY) {
    console.log('\n[DRY-RUN] rien n\'a été écrit. Titres qui seraient réchauffés :\n');
    for (const t of targets.slice(0, 40)) {
      console.log(`  ${t.ticker.padEnd(8)} ${(t.name ?? '').slice(0, 40).padEnd(42)} ${((t.marketCapUsd ?? 0) / 1e9).toFixed(1)} Md$`);
    }
    if (targets.length > 40) console.log(`  … et ${targets.length - 40} autres`);
    console.log('\nRelancer avec --apply pour écrire (append-only, même chemin qu\'une visite de fiche).');
    return;
  }

  const nowMs = Date.now();
  let warmed = 0, skipped = 0, failed = 0;
  for (const t of targets) {
    try {
      const resolved = await resolveYahooTicker(t.ticker).catch(() => null);
      const batch = await getYahooAnnualBatchCached(t.ticker, resolved?.symbol ?? t.ticker, TYPES, nowMs);
      if (!batch) { failed++; console.warn(`  ${t.ticker} : aucune donnée`); continue; }
      const deep = Math.max(...TYPES.map(ty => depthYears(batch.get(ty) ?? [], nowMs)));
      if (deep >= 6.5) { warmed++; console.log(`  ${t.ticker.padEnd(8)} ✓ ${deep.toFixed(0)} ans`); }
      else { skipped++; console.log(`  ${t.ticker.padEnd(8)} — ${deep.toFixed(0)} ans (pas de profondeur EDGAR disponible)`); }
    } catch (e) {
      failed++;
      console.warn(`  ${t.ticker} : ${(e as Error).message}`);
    }
  }
  console.log(`\n✅ ${warmed} réchauffés, ${skipped} sans profondeur disponible, ${failed} en échec.`);
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
