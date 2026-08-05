/**
 * AUDIT (lecture seule) — ratio ADS et déposants IFRS parmi les tickers US-listés.
 *
 * CONTEXTE
 * Depuis #249 les graphes annuels des ADR 20-F fusionnent les shares Yahoo
 * (annualDilutedAverageShares) avec les shares EDGAR (colonne native). Deux angles morts
 * identifiés sans être corrigés :
 *   1. Le RATIO ADS. Un ADS peut représenter N actions ordinaires (BABA 8, TSM 5). Si Yahoo
 *      compte en ADS et EDGAR en ordinaires (ou l'inverse), la fusion mélange deux conventions
 *      → le P/FCF des exercices profonds est faux du facteur N. Et même sans EDGAR, si les
 *      shares Yahoo sont des ordinaires alors prix(ADS) × shares est faux du même facteur.
 *   2. Les déposants IFRS (taxonomie ifrs-full, ex TSM) : `us-gaap/Assets` est absent chez eux
 *      → ni devise de reporting ni profondeur EDGAR aujourd'hui.
 *
 * CE QUE MESURE CE SCRIPT (aucune écriture, ni DB ni store)
 *   Phase 1 — census SEC : pour chaque ticker non suffixé de l'univers, sonde us-gaap/Assets
 *     (devise de reporting) puis, si absent, ifrs-full/Assets. Classes :
 *       us-gaap-usd     : déposant us-gaap en USD (domestique ou étranger type SHOP) — sain
 *       us-gaap-native  : déposant 20-F en devise native — profondeur EDGAR ACTIVE (#249)
 *       ifrs            : déposant ifrs-full — AUCUNE profondeur EDGAR aujourd'hui
 *       none            : pas de XBRL exploitable (pas de CIK, shell, fonds…)
 *   Phase 2 — facteur ADS, pour us-gaap-native et ifrs uniquement :
 *       ratioYE  = médiane( sharesYahoo(FY) / sharesEDGAR(FY) ) sur les exercices communs
 *                  (us-gaap-native seulement — EDGAR requis)
 *       ratioCap = prix_DB(ADS, USD) × sharesYahoo(dernier FY) / marketCapUsd_DB
 *     Un ratio ≈ 1 = conventions cohérentes. Un ratio ≈ N entier = décalage ADS de facteur N.
 *
 * USAGE :
 *   pnpm exec tsx scripts/auditAdrShares.ts [--limit=200] [--out=/tmp/audit.json]
 */
import 'dotenv/config';
import type { TimeseriesPoint } from '@lubin/shared';
import { PrismaClient } from '@prisma/client';
import { foreignReportingCurrency, getEdgarAnnualNative } from '../src/services/secEdgar.js';
import { yahooLimiter } from '../src/lib/limiter.js';

const prisma = new PrismaClient();
const UA_SEC = 'lubin-investment (admin@hyperstack.studio)';
const UA_YAHOO = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Lubin-Investment/0.1';
const LIMIT = Number((process.argv.find(a => a.startsWith('--limit=')) ?? '--limit=0').split('=')[1]) || Infinity;
const OUT = (process.argv.find(a => a.startsWith('--out=')) ?? '').split('=')[1] || '';

type Classe = 'us-gaap-usd' | 'us-gaap-native' | 'ifrs' | 'none';
interface Row {
  ticker: string;
  classe: Classe;
  currency: string | null;        // devise de reporting détectée (native ou IFRS)
  ratioYE?: number | null;        // shares Yahoo / shares EDGAR (médiane FY communs)
  ratioCap?: number | null;       // prix×sharesYahoo / marketCapUsd
  yahooShares?: number | null;
  edgarShares?: number | null;
}

// ─── SEC helpers ──────────────────────────────────────────────────────────────
let cikMap: Map<string, string> | null = null;
async function loadCikMap(): Promise<Map<string, string>> {
  if (cikMap) return cikMap;
  const res = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': UA_SEC, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`SEC tickers HTTP ${res.status}`);
  const data = await res.json() as Record<string, { cik_str: number; ticker: string }>;
  cikMap = new Map();
  for (const v of Object.values(data)) {
    if (v?.ticker && typeof v.cik_str === 'number') cikMap.set(v.ticker.toUpperCase(), String(v.cik_str).padStart(10, '0'));
  }
  return cikMap;
}

/** units d'un concept Assets, ou null (404/erreur). */
async function assetsUnits(cik: string, taxonomy: 'us-gaap' | 'ifrs-full'): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/${taxonomy}/Assets.json`, {
      headers: { 'User-Agent': UA_SEC, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json() as { units?: Record<string, unknown> };
    return data.units ?? null;
  } catch { return null; }
}

/** Classe SEC d'un ticker (2 requêtes max, la 2e seulement si us-gaap absent). */
async function classify(ticker: string): Promise<{ classe: Classe; currency: string | null }> {
  const cik = (await loadCikMap()).get(ticker.toUpperCase());
  if (!cik) return { classe: 'none', currency: null };
  const gaap = await assetsUnits(cik, 'us-gaap');
  if (gaap && Object.keys(gaap).length > 0) {
    const native = foreignReportingCurrency(gaap);
    return native ? { classe: 'us-gaap-native', currency: native } : { classe: 'us-gaap-usd', currency: 'USD' };
  }
  const ifrs = await assetsUnits(cik, 'ifrs-full');
  if (ifrs && Object.keys(ifrs).length > 0) {
    // Chez un déposant IFRS la devise de reporting est la clé monétaire (USD compris).
    const cur = foreignReportingCurrency(ifrs) ?? (Object.keys(ifrs).includes('USD') ? 'USD' : null);
    return { classe: 'ifrs', currency: cur };
  }
  return { classe: 'none', currency: null };
}

/** Pool de concurrence borné (SEC ≤10 req/s — on vise ~6). */
async function pool<T, R>(items: T[], size: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
      // SEC plafonne à 10 req/s et classify() peut en faire 2 : 3 workers × ~350 ms + latence
      // réseau ≈ 4-6 req/s réels, marge confortable.
      await new Promise(r => setTimeout(r, 350));
    }
  }));
  return out;
}

// ─── Yahoo shares (fetch direct : PAS le store — l'audit n'écrit rien) ───────
async function yahooAnnualShares(symbol: string): Promise<Array<{ date: string; value: number }>> {
  return yahooLimiter.schedule(async () => {
    const now = Math.floor(Date.now() / 1000);
    const types = ['annualDilutedAverageShares', 'annualBasicAverageShares'];
    const url = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}`
      + `?symbol=${encodeURIComponent(symbol)}&type=${types.join(',')}&period1=${now - 10 * 365 * 86400}&period2=${now}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA_YAHOO, Accept: 'application/json' } });
      if (!res.ok) return [];
      const data = await res.json() as { timeseries?: { result?: Array<Record<string, unknown> & { meta?: { type?: string[] } }> } };
      for (const type of types) { // diluted prioritaire, basic en secours
        const result = data.timeseries?.result?.find(r => r.meta?.type?.includes(type));
        const rows = (result?.[type] as Array<{ asOfDate?: string; reportedValue?: { raw?: number } }> | undefined) ?? [];
        const pts = rows
          .map(r => (r.asOfDate && typeof r.reportedValue?.raw === 'number') ? { date: r.asOfDate, value: r.reportedValue.raw } : null)
          .filter((x): x is { date: string; value: number } => x !== null && x.value > 0)
          .sort((a, b) => a.date.localeCompare(b.date));
        if (pts.length) return pts;
      }
      return [];
    } catch { return []; }
  });
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

async function main(): Promise<void> {
  // marketCapUsd non nul : en Postgres un ORDER BY … DESC place les NULL EN TÊTE, donc sans ce
  // filtre un --limit=N ne ramène que des coquilles sans capitalisation.
  const universe = await prisma.screenerTicker.findMany({
    where: { ticker: { not: { contains: '.' } }, status: 'scored', marketCapUsd: { not: null } },
    select: { ticker: true, price: true, marketCapUsd: true },
    orderBy: { marketCapUsd: 'desc' },
    ...(Number.isFinite(LIMIT) ? { take: LIMIT as number } : {}),
  });
  console.log(`Phase 1 — census SEC sur ${universe.length} tickers US-listés (2 req max/ticker)…`);
  await loadCikMap();

  let done = 0;
  const rows: Row[] = await pool(universe, 3, async (t) => {
    const { classe, currency } = await classify(t.ticker);
    if (++done % 250 === 0) console.log(`  … ${done}/${universe.length}`);
    return { ticker: t.ticker, classe, currency };
  });

  const byClass = new Map<Classe, Row[]>();
  for (const r of rows) { if (!byClass.has(r.classe)) byClass.set(r.classe, []); byClass.get(r.classe)!.push(r); }
  console.log('\n=== CENSUS ===');
  for (const [c, rs] of byClass) console.log(`${c.padEnd(16)} ${rs.length}`);
  const foreign = [...(byClass.get('us-gaap-native') ?? []), ...(byClass.get('ifrs') ?? [])];

  console.log(`\nPhase 2 — facteur ADS sur ${foreign.length} déposants étrangers (Yahoo throttlé)…`);
  const capByTicker = new Map(universe.map(u => [u.ticker, { price: u.price, cap: u.marketCapUsd }]));
  done = 0;
  await pool(foreign, 3, async (r) => {
    const yahoo = await yahooAnnualShares(r.ticker);
    r.yahooShares = yahoo.length ? yahoo[yahoo.length - 1]!.value : null;
    if (r.classe === 'us-gaap-native') {
      const fetched = await getEdgarAnnualNative(r.ticker, ['annualDilutedAverageShares'])
        .catch(() => new Map<string, TimeseriesPoint[]>());
      const edgar: TimeseriesPoint[] = fetched.get('annualDilutedAverageShares') ?? [];
      r.edgarShares = edgar.length ? edgar[edgar.length - 1]!.value : null;
      const eByYear = new Map<string, number>(edgar.map(p => [p.date.slice(0, 4), p.value]));
      const ratios = yahoo
        .map(p => { const e = eByYear.get(p.date.slice(0, 4)); return e ? p.value / e : null; })
        .filter((x): x is number => x !== null && Number.isFinite(x));
      r.ratioYE = median(ratios);
    }
    const db = capByTicker.get(r.ticker);
    r.ratioCap = (db?.price && db?.cap && r.yahooShares) ? (db.price * r.yahooShares) / db.cap : null;
    if (++done % 25 === 0) console.log(`  … ${done}/${foreign.length}`);
    return r;
  });

  // ─── Synthèse ───────────────────────────────────────────────────────────────
  const suspects = foreign.filter(r =>
    (r.ratioYE != null && Math.abs(Math.log(r.ratioYE)) > 0.25) ||
    (r.ratioCap != null && Math.abs(Math.log(r.ratioCap)) > 0.35));
  suspects.sort((a, b) => Math.abs(Math.log(b.ratioCap ?? b.ratioYE ?? 1)) - Math.abs(Math.log(a.ratioCap ?? a.ratioYE ?? 1)));
  console.log(`\n=== SUSPECTS ADS (${suspects.length}) — ratio ≉ 1 ===`);
  console.log('ticker   classe          devise  Yahoo/EDGAR  prix×shares/cap');
  for (const s of suspects) {
    console.log(`${s.ticker.padEnd(8)} ${s.classe.padEnd(15)} ${String(s.currency ?? '—').padEnd(7)} ${s.ratioYE != null ? s.ratioYE.toFixed(2).padStart(11) : '          —'} ${s.ratioCap != null ? s.ratioCap.toFixed(2).padStart(16) : '               —'}`);
  }
  const ifrsRows = byClass.get('ifrs') ?? [];
  console.log(`\n=== IFRS (${ifrsRows.length}) — aucune profondeur EDGAR aujourd'hui ===`);
  for (const r of ifrsRows) console.log(`  ${r.ticker.padEnd(8)} ${r.currency ?? '?'}`);

  if (OUT) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(OUT, JSON.stringify({ census: Object.fromEntries([...byClass].map(([c, rs]) => [c, rs.length])), foreign, suspects }, null, 2));
    console.log(`\nDétail JSON → ${OUT}`);
  }
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
