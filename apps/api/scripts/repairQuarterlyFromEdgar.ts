/**
 * Réparation des trimestres FAUX du store pour les flux US, par recoupement EDGAR.
 *
 * CONTEXTE (audit du 20/11/2026)
 * La somme des 4 trimestres stockés recoupe le CA annuel SEC à ±3 % sur ~98 % des exercices des
 * 550 plus grosses capitalisations US : la saisonnalité des graphes est réelle. Le reste porte
 * deux signatures d'erreur de calcul — T4 dérivé « annuel − cumul T3 » trop haut (CRM, CRWD,
 * FCX…) et T2 resté en cumul semestriel (BX, BIIB…) — que le store append-only conservait.
 * La règle de correction (ancrée sur le total annuel du 10-K) et ses garde-fous sont dans services/edgarQuarterReconcile.ts ; la
 * reconstruction normale (getReportedTimeseries) l'applique désormais d'elle-même, ce script
 * ne fait qu'accélérer la réparation du stock existant au lieu d'attendre chaque expiration.
 *
 * USAGE (dry-run par défaut, n'écrit rien) :
 *   DATABASE_URL=... tsx scripts/repairQuarterlyFromEdgar.ts [--metrics=revenue,netIncome] [--limit=N]
 *     [--min-cap=2e9] [--concurrency=3]
 *   DATABASE_URL=... tsx scripts/repairQuarterlyFromEdgar.ts --apply --backup=/chemin/backup.json
 *
 * --apply exige --backup : l'état AVANT de chaque ligne modifiée y est écrit avant toute écriture.
 * Le fichier est COMPLÉTÉ d'un lancement à l'autre (jamais écrasé) et garde le PREMIER état vu
 * de chaque (ticker, métrique) : c'est la version d'origine, à restaurer en cas de besoin.
 * Ordre : plus grosses capitalisations d'abord (les pages les plus vues sont réparées en premier).
 * Concurrence par défaut 3 : chaque série enchaîne ses appels EDGAR, ~7 req/s au total, sous la
 * limite de 10 req/s de la SEC.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { TimeseriesPoint } from '@lubin/shared';
import { prisma } from '../src/db/client.js';
import { getEdgarQuarterlySeries, getEdgarAnnualFlowCandidates, EDGAR_ANNUAL_ANCHOR_METRICS, NON_NEGATIVE_FLOW_METRICS, edgarThrottledCount } from '../src/services/secEdgar.js';
import { reconcileWithEdgar } from '../src/services/edgarQuarterReconcile.js';
import type { MetricKey } from '../src/services/finnhubFundamentals.js';

const args = new Map(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k!, v ?? 'true']; }));
const APPLY = args.has('apply');
const BACKUP = args.get('backup');
const LIMIT = args.has('limit') ? Number(args.get('limit')) : Infinity;
const START = Number(args.get('start') ?? 0);
const MIN_CAP = args.has('min-cap') ? Number(args.get('min-cap')) : 0;
const CONCURRENCY = Math.max(1, Number(args.get('concurrency') ?? 3));
const METRICS = (args.get('metrics')?.split(',') ?? [...EDGAR_ANNUAL_ANCHOR_METRICS]).filter(m => EDGAR_ANNUAL_ANCHOR_METRICS.has(m as MetricKey)) as MetricKey[];

async function main(): Promise<void> {
  if (APPLY && !BACKUP) throw new Error('--apply exige --backup=<fichier>');
  const rows = await prisma.fundamentalsSeries.findMany({
    where: { metric: { in: METRICS }, freq: 'quarterly', NOT: { ticker: { contains: '.' } }, source: { in: ['finnhub', 'finnhub+edgar'] } },
    select: { ticker: true, metric: true, points: true },
    orderBy: [{ ticker: 'asc' }, { metric: 'asc' }],
  });
  const caps = new Map((await prisma.screenerTicker.findMany({
    where: { ticker: { in: [...new Set(rows.map(r => r.ticker))] } },
    select: { ticker: true, marketCapUsd: true },
  })).map(c => [c.ticker, Number(c.marketCapUsd ?? 0)]));
  const tickers = [...new Set(rows.map(r => r.ticker))]
    .filter(t => (caps.get(t) ?? 0) >= MIN_CAP)
    .sort((a, b) => (caps.get(b) ?? 0) - (caps.get(a) ?? 0))
    .slice(START, START + LIMIT);
  const rank = new Map(tickers.map((t, i) => [t, i]));
  const todo = rows.filter(r => rank.has(r.ticker)).sort((a, b) => rank.get(a.ticker)! - rank.get(b.ticker)!);
  console.log(`${todo.length} séries (${tickers.length} tickers, métriques ${METRICS.join(',')}) — ${APPLY ? 'APPLY' : 'dry-run'}`);

  type BackupRow = { ticker: string; metric: string; points: unknown };
  const backup: BackupRow[] = BACKUP && existsSync(BACKUP) ? JSON.parse(readFileSync(BACKUP, 'utf8')) as BackupRow[] : [];
  const backedUp = new Set(backup.map(b => `${b.ticker}|${b.metric}`));
  const changes: { ticker: string; metric: string; date: string; from: number; to: number; fiscalYearEnd: string }[] = [];
  let seen = 0;
  let next = 0;
  const worker = async (): Promise<void> => {
  while (next < todo.length) {
    // Bridage SEC : une réponse 429 serait lue comme « pas de donnée » → on s'arrête net plutôt
    // que de parcourir le reste à vide. Le script est idempotent : relancer avec --start=<rang>.
    if (edgarThrottledCount() > 0) throw new Error(`bridage SEC (429) vers la série ${next}/${todo.length} — relancer dans 10 min avec --start=${START + (rank.get(todo[next]!.ticker) ?? 0)}`);
    const r = todo[next++]!;
    seen++;
    const points = (r.points as unknown as TimeseriesPoint[]) ?? [];
    const [edgar, annual] = await Promise.all([
      getEdgarQuarterlySeries(r.ticker, r.metric as MetricKey).catch(() => [] as TimeseriesPoint[]),
      getEdgarAnnualFlowCandidates(r.ticker, r.metric as MetricKey).catch(() => new Map<string, number[]>()),
    ]);
    const { points: fixed, corrections } = reconcileWithEdgar(points, edgar, annual, { nonNegative: NON_NEGATIVE_FLOW_METRICS.has(r.metric as MetricKey) });
    if (corrections.length) {
      for (const c of corrections) changes.push({ ticker: r.ticker, metric: r.metric, ...c });
      if (APPLY) {
        if (!backedUp.has(`${r.ticker}|${r.metric}`)) {
          backup.push({ ticker: r.ticker, metric: r.metric, points: r.points });
          backedUp.add(`${r.ticker}|${r.metric}`);
          writeFileSync(BACKUP!, JSON.stringify(backup));
        }
        await prisma.fundamentalsSeries.update({
          where: { ticker_metric: { ticker: r.ticker, metric: r.metric } },
          data: { points: fixed as unknown as object, source: 'finnhub+edgar' },
        });
      }
    }
    if (seen % 200 === 0) console.log(`  … ${seen}/${todo.length} séries, ${changes.length} trimestres ${APPLY ? 'corrigés' : 'à corriger'}`);
  }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const byMetric = new Map<string, { n: number; tickers: Set<string> }>();
  for (const c of changes) {
    const m = byMetric.get(c.metric) ?? { n: 0, tickers: new Set<string>() };
    m.n++; m.tickers.add(c.ticker); byMetric.set(c.metric, m);
  }
  console.log(`\nBILAN ${APPLY ? 'APPLY' : 'dry-run'} : ${changes.length} trimestres sur ${new Set(changes.map(c => c.ticker)).size} tickers`);
  for (const [metric, m] of byMetric) console.log(`  ${metric.padEnd(16)} ${String(m.n).padStart(5)} trimestres, ${m.tickers.size} tickers`);
  const out = args.get('report');
  if (out) writeFileSync(out, JSON.stringify(changes));
  await prisma.$disconnect();
}

main().catch(async e => {
  console.error(`::error::${(e as Error).message}`);
  await prisma.$disconnect();
  process.exit(1);
});
