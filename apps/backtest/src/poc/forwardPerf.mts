/**
 * Perf du track record forward À LA DEMANDE : pour chaque position du registre, rendement depuis
 * l'entrée vs S&P sur la MÊME fenêtre. Agrégat équipondéré + tri par note combinée (pour voir si
 * une note combinée plus élevée → meilleure perf, l'hypothèse à valider en forward).
 * Lecture seule (pas de DB) : utilise les prix mensuels du store + le S&P.
 *
 * Usage : tsx forwardPerf.mts [YYYY-MM-DD]   (date d'évaluation, défaut = aujourd'hui)
 */
import { readTicker, readBenchmark, type PricePoint } from '../store.js';
import { ledgerDir, loadLedger } from './forwardLib.js';

const TODAY = process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : (process.env.TODAY ?? '2026-06-08');
const tsOf = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00Z').getTime();
const days = (a: string, b: string) => Math.round((tsOf(b) - tsOf(a)) / 86_400_000);
const pctS = (x: number | null) => (x == null ? '—' : (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%');
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length : 0);
function adjAt(prices: PricePoint[], date: string): number | null { let v: number | null = null; for (const p of prices) { if (p.date <= date) v = p.adjClose; else break; } return v; }

function main(): void {
  const ledger = loadLedger(ledgerDir());
  if (!ledger.length) { console.log('Registre vide.'); return; }
  const bench = readBenchmark('SPY'); if (!bench) throw new Error('SPY absent du store.');
  const bNow = adjAt(bench, TODAY);

  const rows = ledger.map((e) => {
    const data = readTicker(e.ticker);
    const prices = data?.yahoo.prices ?? [];
    const entryAdj = e.entryAdjClose ?? (e.priceDate ? adjAt(prices, e.priceDate) : null);
    const nowAdj = adjAt(prices, TODAY);
    const ret = entryAdj != null && nowAdj != null && entryAdj > 0 ? nowAdj / entryAdj - 1 : null;
    const bE = e.priceDate ? adjAt(bench, e.priceDate) : null;
    const spyRet = bE != null && bNow != null && bE > 0 ? bNow / bE - 1 : null;
    const excess = ret != null && spyRet != null ? ret - spyRet : null;
    return { ...e, ret, spyRet, excess, jours: e.priceDate ? days(e.priceDate, TODAY) : 0 };
  });

  console.log(`Track record forward au ${TODAY} — ${rows.length} position(s)\n`);
  console.log('ticker  entrée      j     combiné  rendt     S&P       excès');
  for (const r of [...rows].sort((a, b) => (b.excess ?? -9) - (a.excess ?? -9))) {
    console.log(`${r.ticker.padEnd(6)} ${r.entryDate}  ${String(r.jours).padStart(4)}   ${String(r.combinedNote ?? '—').padStart(5)}/25  ${pctS(r.ret).padStart(7)}  ${pctS(r.spyRet).padStart(7)}  ${pctS(r.excess).padStart(7)}`);
  }

  const valid = rows.filter((r) => r.ret != null && r.spyRet != null);
  if (valid.length) {
    console.log(`\nAGRÉGAT équipondéré : rendt ${pctS(mean(valid.map((r) => r.ret!)))} · S&P ${pctS(mean(valid.map((r) => r.spyRet!)))} · excès ${pctS(mean(valid.map((r) => r.excess!)))}`);
    const beat = valid.filter((r) => (r.excess ?? 0) > 0).length;
    console.log(`Bat le marché : ${beat}/${valid.length} positions`);
    // Tri par note combinée → la perf monte-t-elle avec la note ? (l'hypothèse quanti+quali)
    const hi = valid.filter((r) => (r.combinedNote ?? 0) >= 24), lo = valid.filter((r) => (r.combinedNote ?? 0) < 24);
    if (hi.length && lo.length) console.log(`Combiné ≥24 : excès moy ${pctS(mean(hi.map((r) => r.excess!)))} (n=${hi.length}) · Combiné <24 : ${pctS(mean(lo.map((r) => r.excess!)))} (n=${lo.length})`);
  }
}
main();
