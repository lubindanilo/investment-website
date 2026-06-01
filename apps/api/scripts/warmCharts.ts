/**
 * Backfill manuel du cache graphiques (ChartCache) pour les N tickers les mieux notés.
 * Réutilise le MÊME service que la veille (warmChartCacheForTicker) → zéro divergence.
 * One-shot : la veille comble ensuite le reste de l'univers et les earnings rafraîchissent.
 *
 * Usage : npx tsx scripts/warmCharts.ts [N]   (N = nb de tickers, défaut 80)
 */
import '../src/env.js';
import { prisma } from '../src/db/client.js';
import { warmChartCacheForTicker } from '../src/services/chartWarm.js';

const N = Math.max(1, Math.min(Number(process.argv[2]) || 80, 2000));

const top = await prisma.screenerTicker.findMany({
  where: { status: 'scored', scoreChiffresMax: { gte: 8 } },
  orderBy: [{ scoreRatio: 'desc' }, { scoreChiffresMax: 'desc' }],
  take: N,
  select: { ticker: true, nextEarningsDate: true },
});
console.log(`warmCharts : ${top.length} tickers`);

let ok = 0, fail = 0;
for (const { ticker, nextEarningsDate } of top) {
  try {
    await warmChartCacheForTicker(ticker, nextEarningsDate);
    await prisma.screenerTicker.update({ where: { ticker }, data: { chartsWarmedAt: new Date() } }).catch(() => {});
    ok++;
    if (ok % 10 === 0) console.log(`  … ${ok}/${top.length}`);
  } catch (e) {
    fail++;
    console.warn(`  ✗ ${ticker}: ${(e as Error).message.slice(0, 60)}`);
  }
}
console.log(`warmCharts terminé : ${ok} OK, ${fail} échecs`);
await prisma.$disconnect();
