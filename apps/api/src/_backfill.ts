import { prisma } from './db/client.js';
import { getQuote, getProfile2 } from './services/finnhub.js';
import { resolveYahooTicker } from './services/yahooResolve.js';
import { getAssetProfileYahoo } from './services/yahoo.js';
import { getSparkSeries } from './services/priceSeries.js';
import { getPfcfHistory, pfcfPercentile, isOpportunity, PFCF_OPP_MAX } from './services/pfcfHistory.js';
import { ttlUntilNextEarnings } from './services/earnings.js';
import * as chartCache from './lib/timeseriesCache.js';

async function main() {
  const rows = await prisma.screenerTicker.findMany({
    where: { status: 'scored', scoreChiffresMax: { gte: 8 }, scoreRatio: { gte: 0.6 } },
    select: { ticker: true, scoreChiffres: true, scoreChiffresMax: true, pfcfTTM: true, price: true, nextEarningsDate: true },
    orderBy: { scoreRatio: 'desc' },
  });
  console.log(`Visibles à traiter : ${rows.length}`);
  let sect = 0, disp = 0, opp = 0;
  const CONC = 4;
  for (let i = 0; i < rows.length; i += CONC) {
    await Promise.all(rows.slice(i, i + CONC).map(async (r) => {
      const data: Record<string, unknown> = {};
      // 1) Secteur Yahoo détaillé (industry)
      const prof = await getAssetProfileYahoo(r.ticker).catch(() => ({ sector: null, industry: null }));
      const detailed = prof.industry ?? prof.sector ?? null;
      if (detailed) { data.sector = detailed; sect++; }
      // 2) Cours / VAR / spark si manquants
      if (r.price == null) {
        let price: number | null = null, dp: number | null = null;
        if (!r.ticker.includes('.')) {
          const [q, p] = await Promise.all([getQuote(r.ticker).catch(() => null), getProfile2(r.ticker).catch(() => null)]);
          price = q?.c != null && q.c > 0 ? q.c : null; dp = q?.dp ?? null;
          void p;
        }
        if (price == null) { const y = await resolveYahooTicker(r.ticker).catch(() => null); if (y) { price = y.price ?? null; dp = dp ?? y.dayChangePct ?? null; } }
        const spark = await getSparkSeries(r.ticker).catch(() => []);
        if (price != null) { data.price = price; disp++; }
        if (dp != null) data.dayChangePct = dp;
        if (spark.length >= 2) data.spark = spark;
      }
      // 3) Opportunité (candidats note>=8 & 0<pfcf<25)
      const score10 = r.scoreChiffresMax ? Math.round((r.scoreChiffres! / r.scoreChiffresMax) * 10) : 0;
      if (score10 >= 8 && r.pfcfTTM != null && r.pfcfTTM > 0 && r.pfcfTTM < PFCF_OPP_MAX) {
        const pts = await getPfcfHistory(r.ticker, 50).catch(() => [] as { date: string; pfcf: number }[]);
        if (pts.length) {
          await chartCache.set(chartCache.cacheKey(r.ticker, 'pfcf-history', 'computed', 50), pts.map(p => ({ date: p.date, value: p.pfcf })), 'finnhub', ttlUntilNextEarnings(r.nextEarningsDate)).catch(() => {});
          const cur = pts[pts.length - 1]!.pfcf;
          const pct = pfcfPercentile(pts, cur);
          data.pfcfPercentile = pct;
          data.opportunity = isOpportunity(pct, cur, score10);
          if (data.opportunity) opp++;
        }
      } else {
        data.opportunity = false; data.pfcfPercentile = null;
      }
      if (Object.keys(data).length) await prisma.screenerTicker.update({ where: { ticker: r.ticker }, data }).catch(() => {});
    }));
    const done = Math.min(i + CONC, rows.length);
    if (done % 100 === 0 || done === rows.length) console.log(`  ${done}/${rows.length} sect=${sect} disp=${disp} opp=${opp}`);
  }
  console.log(`Terminé : sect=${sect} disp=${disp} opp=${opp}`);
  await prisma.$disconnect();
}
main();
