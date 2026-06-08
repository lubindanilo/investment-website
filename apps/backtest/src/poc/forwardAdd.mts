/**
 * REGISTRE FORWARD (track record live). Inscrit des achats à la date de décision avec leur
 * snapshot point-in-time EXACT (prix du jour, note quanti, P/FCF, percentile, opportunité, cap).
 * Idempotent : (ticker, entryDate) déjà présent = ignoré. Le fichier JSON est versionné par git
 * → la date d'inscription est prouvée par l'historique du commit (pas de réécriture possible).
 *
 * La note QUALITATIVE est laissée à null ici : elle se renseigne via forwardSetQual.mts (capturée
 * depuis l'app LIVE à l'instant t — sinon biais de rétrospective). C'est le champ qui portera l'alpha à tester.
 *
 * Usage : tsx forwardAdd.mts 2026-06-08 CRM ADBE BKNG KNSL
 */
import { prisma } from '../../../api/src/db/client.js';
import { scoreAsOfDb } from '../engine/scoreAsOf.js';
import { loadSeriesMap } from '../engine/dbSource.js';
import { readTicker, type PricePoint } from '../store.js';
import { bucketOf, ledgerDir, loadLedger, writeLedger, type ForwardEntry } from './forwardLib.js';

const _log = console.log.bind(console);
console.log = (...a: unknown[]) => { if (String(a[0] ?? '').startsWith('[')) return; _log(...a); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function wake(): Promise<void> { for (let i = 0; i < 15; i++) { try { await prisma.$queryRawUnsafe('SELECT 1'); return; } catch { process.stderr.write('.'); await sleep(5000); } } throw new Error('Neon injoignable'); }
function latestPrice(prices: PricePoint[], asOf: string): PricePoint | null { let v: PricePoint | null = null; for (const p of prices) { if (p.date <= asOf) v = p; else break; } return v; }

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const hasDate = argv[0] && /^\d{4}-\d{2}-\d{2}$/.test(argv[0]);
  const entryDate = hasDate ? argv[0]! : (process.env.TODAY ?? '2026-06-08');
  const tickers = (hasDate ? argv.slice(1) : argv).map((t) => t.toUpperCase());
  if (!tickers.length) throw new Error('Aucun ticker fourni.');
  await wake();

  const dir = ledgerDir();
  const ledger = loadLedger(dir);
  const seen = new Set(ledger.map((e) => `${e.ticker}@${e.entryDate}`));

  for (const t of tickers) {
    if (seen.has(`${t}@${entryDate}`)) { console.log(`↷ ${t} déjà inscrit au ${entryDate}, ignoré.`); continue; }
    const data = readTicker(t);
    if (!data) { console.log(`⚠ ${t} ABSENT du store — non inscrit (à ingérer d'abord).`); continue; }
    const seriesMap = await loadSeriesMap(t);
    const r = await scoreAsOfDb(data, entryDate, { seriesMap });
    const pp = latestPrice(data.yahoo.prices, entryDate);
    const mc = r.metrics.marketCap ?? null;
    const entry: ForwardEntry = {
      entryDate, ticker: t, priceDate: pp?.date ?? null, entryClose: pp?.close ?? null, entryAdjClose: pp?.adjClose ?? null,
      score10: r.score10, pfcfTTM: r.pfcfTTM, pfcfCurrent: r.pfcfCurrent, pfcfPercentile: r.pfcfPercentile, opportunity: r.opportunity,
      marketCapM: mc, bucket: bucketOf(mc),
      qualBusiness: null, qualManagement: null, qualNote: null, combinedNote: null, thesis: null,
    };
    ledger.push(entry); seen.add(`${t}@${entryDate}`);
  }

  writeLedger(dir, ledger);
  console.log(`\nRegistre : ${ledger.length} position(s). Fichiers : forward/ledger.json · forward/ledger.csv\n`);
  console.log('date        ticker  prix      note  pfcfTTM  pct  opp  bucket');
  for (const e of ledger.filter((x) => x.entryDate === entryDate)) {
    console.log(`${e.entryDate}  ${e.ticker.padEnd(6)} ${(e.entryClose?.toFixed(2) ?? '—').padStart(8)}  ${String(e.score10 ?? '—').padStart(3)}  ${(e.pfcfTTM?.toFixed(1) ?? '—').padStart(6)}  ${String(e.pfcfPercentile?.toFixed(0) ?? '—').padStart(3)}  ${e.opportunity ? 'OUI' : 'non'}  ${e.bucket}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
