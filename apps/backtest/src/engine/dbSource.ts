/**
 * Source de replay DB — branche le backtest sur le store canonique du SITE (table
 * FundamentalsSeries). Le backtest utilise ainsi EXACTEMENT les mêmes séries de fondamentaux
 * que l'app (décumulées + EDGAR-comblées), donc les mêmes notes — et s'auto-ajuste dès que la
 * DB change (nouveaux trimestres, comble-trous, recompute).
 *
 * Point-in-time : le store stocke {date=endDate, value} SANS filedDate. On approxime la
 * disponibilité par endDate ≤ asOf − lag (un 10-Q est public ~75j après la fin de période).
 * lagDays=0 pour comparer au site « aujourd'hui » (le site utilise tout ce qui est en store).
 */
import { prisma } from '../../../api/src/db/client.js';
import type { ReplaySource } from '../../../api/src/services/finnhubFundamentals.js';
import type { SplitEvent } from '../../../api/src/services/yahooSplits.js';
import type { TimeseriesPoint } from '@lubin/shared';
import type { SplitPoint } from '../store.js';

/** Charge toutes les séries FundamentalsSeries d'un ticker → Map<metric, points> (pré-split, décumulé). */
export async function loadSeriesMap(ticker: string): Promise<Map<string, TimeseriesPoint[]>> {
  const rows = await prisma.fundamentalsSeries.findMany({ where: { ticker: ticker.toUpperCase() } });
  const map = new Map<string, TimeseriesPoint[]>();
  for (const r of rows) map.set(r.metric, (r.points as unknown as TimeseriesPoint[]) ?? []);
  return map;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ReplaySource DB : series(metric) = points stockés filtrés à endDate ≤ asOf − lagDays. */
export function makeDbReplaySource(
  asOf: string,
  seriesMap: Map<string, TimeseriesPoint[]>,
  splitsFor: (t: string) => SplitEvent[],
  lagDays = 75,
): ReplaySource {
  const availCutoff = addDaysIso(asOf, -lagDays);
  return {
    asOf,
    series: (_t, metric) => {
      const pts = seriesMap.get(metric);
      if (!pts) return null;
      return pts.filter((p) => p.date.slice(0, 10) <= availCutoff);
    },
    splits: (t) => splitsFor(t),
  };
}

/** SplitPoint (store local Yahoo) → SplitEvent (app), filtrés ≤ asOf. */
export function splitsToEvents(splits: SplitPoint[], asOf: string): SplitEvent[] {
  return splits
    .filter((s) => s.date <= asOf)
    .map((s) => ({ ts: Math.floor(new Date(s.date + 'T00:00:00Z').getTime() / 1000), date: s.date, numerator: s.numerator, denominator: s.denominator }));
}
