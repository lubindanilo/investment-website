/**
 * gen-eu-universe.mjs — élargit apps/api/src/data/euLargeCaps.ts (région EU) via l'endpoint
 * screener de stockanalysis (/_api/endpoints/screener/table, filtré par exchangeCode).
 *
 * ADDITIF (union) : on régénère les GRANDES bourses européennes au filtre pays d'origine
 * (`country == <pays>` — ces bourses hébergent énormément de DR étrangers : sur LON/ETR/SWX le top
 * est plein d'actions US) et on UNIT avec la liste curée existante. On ne PERD donc rien (petites
 * bourses non régénérées — Athènes/Budapest/Varsovie/Prague/Nordiques — conservées verbatim).
 *
 * Ticker stocké = symbole Yahoo (prix + earnings via Yahoo, fondamentaux via stockanalysis
 * SUFFIX_TO_SEG). La classification PEA (screener.ts NON_PEA_EU_EXCHANGES = ['L','SW']) est dérivée
 * du SUFFIXE → automatiquement correcte pour les tickers ajoutés.
 *
 * Usage :  node scripts/gen-eu-universe.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../apps/api/src/data/euLargeCaps.ts');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const REF = 'https://stockanalysis.com/stocks/screener/';
const CAP = 2000; // le filtre pays d'origine borne déjà (Paris ~612, Londres ~677, etc.)

// Grandes bourses régénérées : code screener → suffixe Yahoo, pays d'origine, libellé.
const REGEN = [
  { seg: 'EPA', suffix: '.PA', country: 'France',         label: 'Euronext Paris' },
  { seg: 'ETR', suffix: '.DE', country: 'Germany',        label: 'Xetra Francfort' },
  { seg: 'AMS', suffix: '.AS', country: 'Netherlands',    label: 'Euronext Amsterdam' },
  { seg: 'BIT', suffix: '.MI', country: 'Italy',          label: 'Borsa Italiana Milan' },
  { seg: 'BME', suffix: '.MC', country: 'Spain',          label: 'Bolsa de Madrid' },
  { seg: 'EBR', suffix: '.BR', country: 'Belgium',        label: 'Euronext Bruxelles' },
  { seg: 'ELI', suffix: '.LS', country: 'Portugal',       label: 'Euronext Lisbonne' },
  { seg: 'ISE', suffix: '.IR', country: 'Ireland',        label: 'Euronext Dublin' },
  { seg: 'VIE', suffix: '.VI', country: 'Austria',        label: 'Wiener Börse (Vienne)' },
  { seg: 'LON', suffix: '.L',  country: 'United Kingdom', label: 'London Stock Exchange' },
  { seg: 'SWX', suffix: '.SW', country: 'Switzerland',    label: 'SIX Swiss Exchange' },
];
// Libellés des suffixes NON régénérés (préservés verbatim), pour les commentaires.
const OTHER_LABELS = {
  '.ST': 'Stockholm', '.CO': 'Copenhague', '.OL': 'Oslo', '.HE': 'Helsinki',
  '.AT': 'Athènes', '.BD': 'Budapest', '.PR': 'Prague', '.WA': 'Varsovie',
};
const TICKER_RE = /^[A-Z0-9.\-]{1,15}$/;

async function fetchExchange(seg) {
  const url = `https://stockanalysis.com/_api/endpoints/screener/table?type=s&m=marketCap&s=desc&c=s,n,marketCap,country&f=exchangeCode-is-${seg}`;
  let lastErr;
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: REF, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = (await res.json())?.data?.data;
      if (!Array.isArray(rows)) throw new Error('payload inattendu');
      return rows;
    } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw lastErr;
}

function toYahoo(ex, rows) {
  const out = [];
  for (const r of rows) {
    if ((r.country ?? null) !== ex.country) continue; // pays d'origine → purge les DR étrangers
    const dash = r.s.indexOf('-');
    if (dash < 0) continue;
    const yahoo = (r.s.slice(dash + 1) + ex.suffix).toUpperCase();
    if (TICKER_RE.test(yahoo)) out.push(yahoo);
    if (out.length >= CAP) break;
  }
  return out;
}

const suffixOf = (t) => (t.includes('.') ? t.slice(t.lastIndexOf('.')) : '');

async function main() {
  const orig = fs.readFileSync(SRC, 'utf8');
  // Groupe l'existant par suffixe.
  const existing = {};
  for (const m of orig.matchAll(/'([A-Z0-9.\-]+)'/g)) {
    const t = m[1]; const s = suffixOf(t);
    (existing[s] ??= []).push(t);
  }

  const groups = {}; // suffixe → { label, tickers }
  for (const ex of REGEN) {
    const gen = toYahoo(ex, await fetchExchange(ex.seg));
    const merged = [...new Set([...(existing[ex.suffix] ?? []), ...gen])].sort();
    groups[ex.suffix] = { label: ex.label, tickers: merged };
    console.log(`  ${ex.label.padEnd(24)} ${ex.suffix.padEnd(4)} : ${gen.length} générés → ${merged.length} avec l'existant`);
  }
  // Suffixes non régénérés : conservés verbatim.
  const regenSuffixes = new Set(REGEN.map((e) => e.suffix));
  const otherSuffixes = Object.keys(existing).filter((s) => s && !regenSuffixes.has(s)).sort();
  for (const s of otherSuffixes) {
    groups[s] = { label: OTHER_LABELS[s] ?? `Bourse ${s}`, tickers: [...new Set(existing[s])].sort(), kept: true };
  }

  // Ordre : grandes bourses régénérées (ordre REGEN) puis les autres (alpha).
  const order = [...REGEN.map((e) => e.suffix), ...otherSuffixes];
  const lines = [];
  for (const s of order) {
    const g = groups[s]; if (!g || g.tickers.length === 0) continue;
    lines.push(`  // — ${g.label} (${s}) · ${g.tickers.length}${g.kept ? ' (curé)' : ''} —`);
    for (let i = 0; i < g.tickers.length; i += 10) {
      lines.push('  ' + g.tickers.slice(i, i + 10).map((t) => `'${t}'`).join(', ') + ',');
    }
  }

  const header = `/**
 * Grandes & moyennes capitalisations européennes (région EU, format symbole Yahoo).
 *
 * Grandes bourses (Paris, Xetra, Amsterdam, Milan, Madrid, Bruxelles, Lisbonne, Dublin, Vienne,
 * Londres, Swiss) régénérées via scripts/gen-eu-universe.mjs depuis l'endpoint screener de
 * stockanalysis, FILTRÉES au pays d'origine (ces bourses hébergent beaucoup de DR étrangers).
 * Unies à la liste curée : les petites bourses (Athènes, Budapest, Varsovie, Prague, Nordiques…)
 * sont conservées verbatim.
 *
 * PEA : la classification (screener.ts NON_PEA_EU_EXCHANGES = ['L','SW']) est dérivée du suffixe.
 * Finnhub free ne fournit pas l'EU → prix + earnings via Yahoo, fondamentaux via stockanalysis.
 */`;

  fs.writeFileSync(SRC, `${header}\nexport const EU_LARGE_CAPS: string[] = [\n${lines.join('\n')}\n];\n`);
  const total = [...fs.readFileSync(SRC, 'utf8').matchAll(/'[A-Z0-9.\-]+'/g)].length;
  console.log(`✓ euLargeCaps.ts régénéré (~${total} tickers)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
