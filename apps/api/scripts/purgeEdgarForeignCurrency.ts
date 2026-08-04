/**
 * Purge des séries du store FundamentalsSeries polluées par la colonne USD d'EDGAR.
 *
 * CONTEXTE
 * EDGAR ne sert qu'à COMBLER les trous de séries libellées en devise de REPORTING (Finnhub,
 * stockanalysis, Yahoo). Pour un déposant 20-F étranger, `units.USD` d'un concept XBRL n'est
 * qu'une conversion de convenance : `fetchConcept` la prenait en dur, ce qui mélangeait deux
 * devises dans la MÊME série du store. Constaté sur TCOM : bilan en USD (totalAssets,
 * currentLiabilities, goodwill, equity, currentAssets, AR, AP) et flux en CNY (cfo, capex,
 * sbc, revenue) → le graphe Cash ROCE traçait FCF(CNY)/CapitalEmployed(USD), ~7× trop haut,
 * et le CCC croisait des AR/AP en USD avec un CA en CNY.
 *
 * `secEdgar.foreignReportingCurrency` bloque désormais l'injection à la source. Mais le merge
 * du store est APPEND-ONLY par conception (cf fundamentalsStore.appendOnlyMerge) : les points
 * déjà écrits ne repartiront JAMAIS d'eux-mêmes. D'où ce one-shot.
 *
 * CE QUI EST SUPPRIMÉ — et pourquoi c'est sans perte
 * Uniquement les lignes dont `source` contient 'edgar', et seulement pour les tickers dont
 * EDGAR expose une devise de reporting ≠ USD. Pour ces émetteurs Finnhub ne renvoie aucun
 * filing, donc 100 % des points de ces lignes viennent d'EDGAR. Les lignes de FLUX (cfo,
 * revenue, netIncome…), elles, viennent de stockanalysis / yahoo-q : elles sont en devise
 * native, cohérentes, et ne sont PAS touchées — c'est important, leur historique s'accumule
 * au fil des trimestres et n'est pas re-téléchargeable.
 *
 * Après purge, la reconstruction suivante trouve Finnhub vide + EDGAR refusé → série vide →
 * les services de graphe basculent sur leur repli annuel Yahoo, homogène en devise.
 *
 * USAGE (dry-run par défaut, n'écrit rien) :
 *   DATABASE_URL=... tsx scripts/purgeEdgarForeignCurrency.ts
 *   DATABASE_URL=... tsx scripts/purgeEdgarForeignCurrency.ts --apply
 */
import { PrismaClient } from '@prisma/client';
import { foreignReportingCurrency } from '../src/services/secEdgar.js';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const UA = 'lubin-investment (admin@hyperstack.studio)'; // SEC exige un User-Agent identifiable

/** Concept sonde : présent chez tout déposant qui publie un bilan. */
const PROBE_CONCEPT = 'us-gaap/Assets';

async function loadCikMap(): Promise<Map<string, string>> {
  const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`SEC tickers HTTP ${res.status}`);
  const data = await res.json() as Record<string, { cik_str: number; ticker: string }>;
  const m = new Map<string, string>();
  for (const v of Object.values(data)) {
    if (v?.ticker && typeof v.cik_str === 'number') m.set(v.ticker.toUpperCase(), String(v.cik_str).padStart(10, '0'));
  }
  return m;
}

/** Devise de reporting du déposant, ou null s'il reporte en USD / est introuvable. */
async function reportingCurrency(cik: string): Promise<string | null> {
  const res = await fetch(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/${PROBE_CONCEPT}.json`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json() as { units?: Record<string, unknown> };
  return foreignReportingCurrency(data.units ?? {});
}

async function main(): Promise<void> {
  const rows = await prisma.fundamentalsSeries.findMany({
    where: { source: { contains: 'edgar' } },
    select: { ticker: true, metric: true, source: true, points: true },
  });
  const byTicker = new Map<string, typeof rows>();
  for (const r of rows) {
    // Les tickers suffixés ne passent jamais par EDGAR (getCik les écarte) — garde-fou.
    if (r.ticker.includes('.')) continue;
    if (!byTicker.has(r.ticker)) byTicker.set(r.ticker, []);
    byTicker.get(r.ticker)!.push(r);
  }
  console.log(`${rows.length} lignes sourcées EDGAR sur ${byTicker.size} tickers. Sonde ${PROBE_CONCEPT} chez SEC…`);

  const cikMap = await loadCikMap();
  const victims: { ticker: string; currency: string; metrics: string[] }[] = [];
  let probed = 0;
  for (const [ticker, tickerRows] of byTicker) {
    const cik = cikMap.get(ticker);
    if (!cik) continue;
    probed++;
    const currency = await reportingCurrency(cik).catch(() => null);
    if (!currency) continue;
    victims.push({ ticker, currency, metrics: tickerRows.map(r => r.metric).sort() });
    if (probed % 25 === 0) console.log(`  … ${probed}/${byTicker.size} sondés, ${victims.length} contaminés`);
    await new Promise(r => setTimeout(r, 120)); // SEC : ≤10 req/s, on reste très en dessous
  }

  const totalMetrics = victims.reduce((s, v) => s + v.metrics.length, 0);
  console.log(`\n${victims.length} tickers en devise étrangère, ${totalMetrics} lignes à supprimer :\n`);
  for (const v of victims) console.log(`  ${v.ticker.padEnd(8)} ${v.currency}  ${v.metrics.join(' ')}`);

  if (!APPLY) {
    console.log(`\n[DRY-RUN] rien n'a été écrit. Relancer avec --apply pour supprimer ces ${totalMetrics} lignes.`);
    return;
  }
  let deleted = 0;
  for (const v of victims) {
    const res = await prisma.fundamentalsSeries.deleteMany({
      where: { ticker: v.ticker, metric: { in: v.metrics }, source: { contains: 'edgar' } },
    });
    deleted += res.count;
  }
  console.log(`\n✅ ${deleted} lignes supprimées. Elles seront reconstruites au prochain accès (EDGAR désormais refusé pour ces émetteurs → repli annuel Yahoo).`);
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
