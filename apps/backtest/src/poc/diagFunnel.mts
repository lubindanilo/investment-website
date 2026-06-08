/**
 * Pourquoi n=14 ? Entonnoir : sur 2014-2022 (trimestriel), combien de titres ont ATTEINT une
 * note ≥8/9/10 (qualité seule), vs combien ont été une OPPORTUNITÉ (note≥k ET P/FCF bas) au moins
 * une fois. L'écart entre les deux = effet du filtre « pas cher ».
 */
import { prisma } from '../../../api/src/db/client.js';
import { listTickers, readTicker } from '../store.js';
import { scoreAsOfDb } from '../engine/scoreAsOf.js';
import { loadSeriesMap } from '../engine/dbSource.js';
import { monthEnds } from '../engine/runner.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function wake(): Promise<void> { for (let i = 0; i < 15; i++) { try { await prisma.$queryRawUnsafe('SELECT 1'); return; } catch { process.stderr.write('.'); await sleep(5000); } } throw new Error('Neon'); }

async function main(): Promise<void> {
  await wake();
  const dates = monthEnds('2014-01-01', '2022-12-31', 3);
  const tickers = listTickers();
  const everScore = { 8: 0, 9: 0, 10: 0 }; // a atteint note ≥ k (toute valorisation)
  const everOpp = { 8: 0, 9: 0, 10: 0 };   // a été opportunité (note≥k ET pas cher) au moins 1 fois
  let withData = 0;
  for (let i = 0; i < tickers.length; i++) {
    process.stderr.write(`\r[${i + 1}/${tickers.length}]    `);
    const data = readTicker(tickers[i]!); if (!data || data.yahoo.prices.length < 24) continue;
    const seriesMap = await loadSeriesMap(tickers[i]!); if (seriesMap.size === 0) continue;
    withData++;
    let maxScore = 0; const oppAt = { 8: false, 9: false, 10: false };
    for (const d of dates) {
      const r = await scoreAsOfDb(data, d, { seriesMap });
      if (r.score10 > maxScore) maxScore = r.score10;
      if (r.opportunity) { for (const k of [8, 9, 10] as const) if (r.score10 >= k) oppAt[k] = true; }
    }
    for (const k of [8, 9, 10] as const) { if (maxScore >= k) everScore[k]++; if (oppAt[k]) everOpp[k]++; }
  }
  process.stderr.write('\r');
  console.log(`\nUnivers avec données (prix + fondamentaux DB) : ${withData} / ${tickers.length}\n`);
  console.log('seuil   a atteint la note (qualité)   ET opportunité (=pas cher en même temps)');
  for (const k of [8, 9, 10] as const) {
    console.log(`  ≥${k}/10        ${String(everScore[k]).padStart(5)}                      ${String(everOpp[k]).padStart(5)}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
