/**
 * Diagnostic de la divergence de score backtest vs app. Met côte à côte, pour un ticker :
 *   1. PROD cache    — ScreenerTicker (note mise en cache, + lastScoredAt = ancienneté)
 *   2. APP fraîche   — loadQuantData LIVE (chemin /stock/metric précalculé) recalculé maintenant
 *   3. BACKTEST      — scoreAsOf sur le store (chemin /financials-reported recomputé)
 * Puis diff critère par critère APP(metric) vs BACKTEST(reported).
 *
 * Lancer avec les clés en env (DATABASE_URL prod + FINNHUB_API_KEY) :
 *   FINNHUB_API_KEY=… DATABASE_URL=… tsx apps/backtest/src/poc/diag-divergence.ts NVDA
 */
import { prisma } from '../../../api/src/db/client.js';
import { loadQuantData } from '../../../api/src/services/quantSnapshot.js';
import { buildQuantitativeCriteria } from '../../../api/src/services/derivedMetrics.js';
import { readTicker } from '../store.js';
import { scoreAsOf } from '../engine/scoreAsOf.js';

const T = (process.argv[2] ?? 'NVDA').toUpperCase();
const ASOF = process.argv[3] ?? '2026-06-03';

function scoreOf(criteria: { statut: string }[]): string {
  const pass = criteria.filter((c) => c.statut === 'pass').length;
  const warn = criteria.filter((c) => c.statut === 'warn').length;
  const chiffres = pass + Math.round(warn * 0.5);
  return `${chiffres}/${criteria.length} (≈${Math.round((chiffres / criteria.length) * 10)}/10)`;
}

async function main(): Promise<void> {
  console.log(`\n===== Divergence ${T} (asOf backtest = ${ASOF}) =====\n`);

  // 1. PROD cache
  const row = await prisma.screenerTicker.findUnique({
    where: { ticker: T },
    select: { scoreChiffres: true, scoreChiffresMax: true, lastScoredAt: true, pfcfTTM: true },
  });
  const prodAgeDays = row?.lastScoredAt ? Math.round((Date.parse(ASOF) - row.lastScoredAt.getTime()) / 86400000) : null;
  console.log(`1) PROD cache   : ${row?.scoreChiffres}/${row?.scoreChiffresMax}  | scoré il y a ${prodAgeDays} j (${row?.lastScoredAt?.toISOString().slice(0, 10)})`);

  // 2. APP fraîche (live, chemin /stock/metric) — REPLAY est null ici (scoreAsOf le reset).
  const quant = await loadQuantData(T, { includeNews: false, includeEarnings: false, log: false });
  const appCriteria = buildQuantitativeCriteria(quant.metrics);
  console.log(`2) APP fraîche  : ${scoreOf(appCriteria)}  | source=${quant.fundamentalsSource}`);

  // 3. BACKTEST (reported)
  const data = readTicker(T);
  if (!data) throw new Error(`${T} absent du store`);
  const bt = await scoreAsOf(data, ASOF);
  console.log(`3) BACKTEST     : ${bt.scoreChiffres}/${bt.scoreMax} (${bt.score10}/10)  | source=/financials-reported`);

  // Diff critère par critère
  console.log(`\ncritère              APP(metric)            BACKTEST(reported)`);
  for (let i = 0; i < appCriteria.length; i++) {
    const a = appCriteria[i]!;
    const b = bt.chiffres[i];
    const diff = b && a.statut !== b.statut ? '   <<< DIFF' : '';
    console.log(`${a.key.padEnd(18)} ${a.statut.padEnd(5)} ${String(a.valeur).padEnd(14)}  ${(b?.statut ?? '—').padEnd(5)} ${String(b?.valeur ?? '—').padEnd(14)}${diff}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
