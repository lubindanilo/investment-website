/**
 * Recale le store sur stockanalysis (ramené dans la devise des COMPTES) pour une liste de titres
 * dont des points stockés sont dans la mauvaise devise ou la mauvaise échelle.
 *
 * CONTEXTE (21/11/2026)
 * Le store n'ajoute que les dates absentes (cf fundamentalsStore.appendOnlyMerge) : un point
 * écrit faux ne repart jamais de lui-même. Deux familles relevées par le scan carte ↔ live :
 *   - devise : la page /stocks/ d'un ADR est parfois convertie en dollars. ENIC (comptes en CLP)
 *     a tout son store en USD, d'où un P/FCF de 7 553× après conversion CLP→USD par-dessus ;
 *   - point isolé : INFY garde au T2 2025 un CFO de 76,3 Md (roupies, 15× son CA trimestriel)
 *     là où stockanalysis donne 983 M$ — le FCF douze mois était 3× le CA.
 *
 * CE QUI EST RÉÉCRIT
 *   - un point stocké à la même date qu'un point stockanalysis, s'il s'en écarte de plus de ×3 —
 *     de plus de 2 % quand le lot a dû être CONVERTI : ses points stockés aux mêmes dates sont
 *     alors dans la mauvaise devise, et entre USD et CAD l'écart n'est que de ×1,37 (HSLV) ;
 *   - un point stocké HORS de la fenêtre stockanalysis, supprimé s'il est à plus de ×30 de la
 *     médiane de la série recalée (même famille d'erreur : devise ou échelle, jamais un vrai
 *     trimestre). Les autres points anciens (EDGAR, profondeur) sont conservés tels quels.
 *
 * USAGE (simulation par défaut, n'écrit rien) :
 *   DATABASE_URL=... tsx scripts/repairStoreFromStockanalysis.ts ENIC INFY
 *   DATABASE_URL=... tsx scripts/repairStoreFromStockanalysis.ts ENIC INFY --apply
 */
import { PrismaClient } from '@prisma/client';
import type { TimeseriesPoint } from '@lubin/shared';
import { getStockanalysisQuarterlyBatch } from '../src/services/stockanalysisFundamentals.js';
import { alignToReportingCurrency } from '../src/services/yahooAnnualStore.js';
import { purgeTicker } from '../src/lib/timeseriesCache.js';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const TICKERS = process.argv.slice(2).filter(a => !a.startsWith('--')).map(t => t.toUpperCase());

const DAY = 86_400_000;
const SAME_DATE_MS = 20 * DAY;
const SAME_DATE_TOLERANCE = 3;
const OUTSIDE_TOLERANCE = 30;
const CONVERTED_TOLERANCE = 1.02;

const ratio = (a: number, b: number) => (a === 0 || b === 0 ? Infinity : Math.max(Math.abs(a), Math.abs(b)) / Math.min(Math.abs(a), Math.abs(b)));

/** Série recalée + compte rendu des changements. Pure, exportée pour lecture. */
export function reconcile(stored: TimeseriesPoint[], sa: TimeseriesPoint[], sameDateTolerance = SAME_DATE_TOLERANCE): { points: TimeseriesPoint[]; replaced: string[]; dropped: string[] } {
  const replaced: string[] = [];
  const dropped: string[] = [];
  if (!sa.length) return { points: stored, replaced, dropped };
  const saStart = Date.parse(sa[0]!.date) - SAME_DATE_MS;
  const abs = sa.map(p => Math.abs(p.value)).filter(v => v > 0).sort((a, b) => a - b);
  const median = abs.length ? abs[Math.floor(abs.length / 2)]! : 0;
  const out: TimeseriesPoint[] = [];
  for (const p of stored) {
    const t = Date.parse(p.date);
    const twin = sa.find(s => Math.abs(Date.parse(s.date) - t) < SAME_DATE_MS);
    if (twin) {
      if (ratio(p.value, twin.value) > sameDateTolerance) { replaced.push(`${p.date} ${p.value} → ${twin.value}`); out.push({ date: p.date, value: twin.value }); }
      else out.push(p);
    } else if (t < saStart && median > 0 && p.value !== 0 && ratio(p.value, median) > OUTSIDE_TOLERANCE) {
      dropped.push(`${p.date} ${p.value}`);
    } else {
      out.push(p);
    }
  }
  return { points: out, replaced, dropped };
}

async function main(): Promise<void> {
  if (!TICKERS.length) throw new Error('usage : repairStoreFromStockanalysis.ts TICKER… [--apply]');
  for (const ticker of TICKERS) {
    const fetched = await getStockanalysisQuarterlyBatch(ticker).catch(() => null);
    const batch = fetched ? await alignToReportingCurrency(ticker, fetched) : null;
    if (!batch) { console.log(`${ticker} : pas de lot stockanalysis exploitable, ignoré`); continue; }
    const converted = fetched!.currency != null && fetched!.currency !== batch.currency;
    let touched = 0;
    for (const [metric, sa] of batch.series) {
      const row = await prisma.fundamentalsSeries.findUnique({ where: { ticker_metric: { ticker, metric } } });
      if (!row) continue;
      const { points, replaced, dropped } = reconcile(row.points as unknown as TimeseriesPoint[], sa, converted ? CONVERTED_TOLERANCE : SAME_DATE_TOLERANCE);
      if (!replaced.length && !dropped.length) continue;
      touched++;
      console.log(`${ticker} ${metric} : ${replaced.length} remplacé(s), ${dropped.length} supprimé(s)`);
      for (const r of replaced.slice(0, 4)) console.log(`   ~ ${r}`);
      for (const d of dropped.slice(0, 4)) console.log(`   - ${d}`);
      if (APPLY) {
        await prisma.fundamentalsSeries.update({
          where: { ticker_metric: { ticker, metric } },
          data: { points: points as unknown as object, lastEnd: points.at(-1)?.date ?? null },
        });
      }
    }
    if (APPLY && touched) console.log(`${ticker} : ${await purgeTicker(ticker)} entrée(s) de cache graphe purgée(s)`);
    if (!touched) console.log(`${ticker} : rien à recaler`);
  }
  if (!APPLY) console.log('\n(simulation — relancer avec --apply pour écrire)');
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
