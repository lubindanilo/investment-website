/**
 * gen-intl-universe.mjs — régénère la partie « grands marchés mondiaux » de
 * apps/api/src/data/intlLargeCaps.ts.
 *
 * Source : endpoint screener de stockanalysis (reverse-engineered) —
 *   GET /_api/endpoints/screener/table?type=s&m=marketCap&s=desc&c=s,n,marketCap,country&f=exchangeCode-is-<SEG>
 *   → renvoie la LISTE COMPLÈTE de la bourse (pas de plafond 500 comme les pages /list/),
 *     triée par capitalisation décroissante, en JSON. `s` = "SEG-BASE" (ex "HKG-0700").
 * On convertit SEG-BASE en symbole Yahoo (base + suffixe) — format stocké : prix + date d'earnings
 * via Yahoo (pilote la cadence de re-scoring), fondamentaux via stockanalysis (SUFFIX_TO_SEG).
 *
 * FILTRAGE QUALITÉ (colonne country) :
 *   - défaut ('exUsNull') : on garde country ≠ null (écarte les ETF) et ≠ "United States"
 *     (les DR US cotés hors US ; l'US est couvert par sp500Universe). Garde les sociétés à
 *     domicile offshore légitime (ex Tencent = Cayman Islands).
 *   - 'home:<Pays>' (Canada, Australie) : on ne garde que country == <Pays>, car ces bourses
 *     hébergent massivement des DR étrangers (ASML, Roche, LVMH sur TSX…) qui fausseraient le top.
 *
 * PROFONDEUR : cap par marché (gros marchés 1200, autres 600-800) pour rester dans la capacité du
 * cron (~1000 scorings/j) même avec ~15k INTL. Le re-scoring étranger est piloté par les earnings
 * Yahoo (cf. quantSnapshot), le résidu sans date sur TTL 14j.
 *
 * EXCLUSIONS : Malaisie (code alpha ≠ numérique Yahoo → prix cassé), UK/Suisse (déjà EU),
 * Mexique (DR étrangers), Philippines (Yahoo ne résout pas .PS), Brésil (bloc curé conservé).
 *
 * Usage :  node scripts/gen-intl-universe.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../apps/api/src/data/intlLargeCaps.ts');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const REF = 'https://stockanalysis.com/stocks/screener/';

// seg (exchangeCode API) → suffixe Yahoo, const TS, libellé, cap, mode de filtrage pays.
const EXCHANGES = [
  { seg: 'TSX',     suffix: '.TO', group: 'CANADA',       label: 'Canada · Toronto (.TO)',        cap: 800,  country: 'home:Canada' },
  { seg: 'ASX',     suffix: '.AX', group: 'AUSTRALIA',    label: 'Australie · ASX (.AX)',         cap: 800,  country: 'home:Australia' },
  { seg: 'TYO',     suffix: '.T',  group: 'JAPAN',        label: 'Japon · Tokyo (.T)',            cap: 1200, country: 'exUsNull' },
  { seg: 'HKG',     suffix: '.HK', group: 'HONG_KONG',    label: 'Hong Kong (.HK)',               cap: 1200, country: 'exUsNull' },
  { seg: 'SHA',     suffix: '.SS', group: 'SHANGHAI',     label: 'Chine · Shanghai (.SS)',        cap: 1200, country: 'exUsNull' },
  { seg: 'SHE',     suffix: '.SZ', group: 'SHENZHEN',     label: 'Chine · Shenzhen (.SZ)',        cap: 1200, country: 'exUsNull' },
  { seg: 'KRX',     suffix: '.KS', group: 'KOREA',        label: 'Corée · Séoul (.KS)',           cap: 1200, country: 'exUsNull' },
  { seg: 'TPE',     suffix: '.TW', group: 'TAIWAN',       label: 'Taïwan (.TW)',                  cap: 1200, country: 'exUsNull' },
  { seg: 'NSE',     suffix: '.NS', group: 'INDIA',        label: 'Inde · NSE (.NS)',              cap: 1200, country: 'exUsNull' },
  { seg: 'IDX',     suffix: '.JK', group: 'INDONESIA',    label: 'Indonésie · IDX (.JK)',         cap: 800,  country: 'exUsNull' },
  { seg: 'BKK',     suffix: '.BK', group: 'THAILAND',     label: 'Thaïlande · SET (.BK)',         cap: 800,  country: 'exUsNull' },
  { seg: 'SGX',     suffix: '.SI', group: 'SINGAPORE',    label: 'Singapour · SGX (.SI)',         cap: 600,  country: 'exUsNull' },
  { seg: 'HOSE',    suffix: '.VN', group: 'VIETNAM',      label: 'Vietnam · HOSE (.VN)',          cap: 600,  country: 'exUsNull' },
  { seg: 'TADAWUL', suffix: '.SR', group: 'SAUDI',        label: 'Arabie Saoudite · Tadawul (.SR)', cap: 600, country: 'exUsNull' },
  { seg: 'JSE',     suffix: '.JO', group: 'SOUTH_AFRICA', label: 'Afrique du Sud · JSE (.JO)',    cap: 600,  country: 'exUsNull' },
  { seg: 'IST',     suffix: '.IS', group: 'TURKEY',       label: 'Turquie · BIST (.IS)',          cap: 600,  country: 'exUsNull' },
];
// Groupes régénérés SANS union (purge d'anciens artefacts, ex DR sur Canada/Australie).
const NO_UNION = new Set(['CANADA', 'AUSTRALIA']);
// Blocs européens + Brésil : NON régénérés (préservés verbatim), placés après les blocs générés.
const VERBATIM_TAIL = ['SWEDEN', 'DENMARK', 'NORWAY', 'FINLAND', 'BRAZIL'];
// Titres toujours inclus même hors cap (données stockanalysis vérifiées).
const CURATED_EXTRAS = { HONG_KONG: ['1681.HK'] }; // Consun Pharmaceutical
const TICKER_RE = /^[A-Z0-9.\-]{1,15}$/;

async function fetchExchange(seg) {
  const url = `https://stockanalysis.com/_api/endpoints/screener/table?type=s&m=marketCap&s=desc&c=s,n,marketCap,country&f=exchangeCode-is-${seg}`;
  let lastErr;
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: REF, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rows = json?.data?.data;
      if (!Array.isArray(rows)) throw new Error('payload inattendu');
      return rows;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

function toYahoo(ex, rows) {
  const homeCountry = ex.country.startsWith('home:') ? ex.country.slice(5) : null;
  const out = [];
  for (const r of rows) {
    const country = r.country ?? null;
    if (homeCountry ? country !== homeCountry : (country == null || country === 'United States')) continue;
    const s = r.s; // "SEG-BASE"
    const dash = s.indexOf('-');
    if (dash < 0) continue;
    const base = s.slice(dash + 1);
    const yahoo = (base + ex.suffix).toUpperCase();
    if (TICKER_RE.test(yahoo)) out.push(yahoo);
    if (out.length >= ex.cap) break; // rows déjà triées par capi décroissante
  }
  return out;
}

const orig = fs.readFileSync(SRC, 'utf8');
function verbatimBlock(name) {
  const m = orig.match(new RegExp(`(\\n// —[^\\n]*\\n)?const ${name}: string\\[\\] = \\[[\\s\\S]*?\\n\\];`, 'm'));
  if (!m) throw new Error(`bloc introuvable: ${name}`);
  return m[0].trimStart();
}
function existingTickers(name) {
  const m = orig.match(new RegExp(`const ${name}: string\\[\\] = \\[([\\s\\S]*?)\\n\\];`, 'm'));
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
}
function fmtArray(name, label, tickers) {
  const uniq = [...new Set(tickers)].sort();
  const lines = [];
  for (let i = 0; i < uniq.length; i += 8) lines.push('  ' + uniq.slice(i, i + 8).map((t) => `'${t}'`).join(', ') + ',');
  return `// — ${label} — top par capitalisation (screener stockanalysis) —\nconst ${name}: string[] = [\n${lines.join('\n')}\n];`;
}

const HEADER = `/**
 * Grandes & moyennes capitalisations mondiales (hors US couvert par sp500Universe, hors EU couvert
 * par euLargeCaps).
 *
 * Généré par scripts/gen-intl-universe.mjs (à relancer pour rafraîchir) depuis l'endpoint screener
 * de stockanalysis (/_api/endpoints/screener/table, filtré par exchangeCode) — liste complète par
 * bourse, plafonnée par marché (gros marchés ~1200, autres 600-800) pour la capacité du cron.
 * Ticker stocké = symbole Yahoo : prix + date d'earnings via Yahoo (pilotent le re-scoring),
 * fondamentaux trimestriels/semestriels via stockanalysis (SUFFIX_TO_SEG).
 *
 * Filtrage : on écarte les ETF (country null) et les DR US (country "United States", couverts par
 * sp500Universe) ; Canada/Australie sont restreints à leur pays d'origine (ces bourses hébergent
 * beaucoup de DR étrangers). Nordiques + Brésil restent curés (verbatim).
 *
 * Garantie « données disponibles » : le pipeline filtre — un ticker sans fondamentaux/prix
 * suffisants est \`nodata\` et n'apparaît jamais dans le screener (scoreChiffresMax ≥ 8).
 *
 * Format = symbole Yahoo (suffixe d'exchange) :
 *   .TO Canada · .AX Australie · .T Tokyo · .HK Hong Kong · .SS Shanghai · .SZ Shenzhen
 *   .KS Corée · .TW Taïwan · .NS Inde · .JK Indonésie · .BK Thaïlande · .SI Singapour
 *   .VN Vietnam · .SR Arabie Saoudite · .JO Afrique du Sud · .IS Turquie
 *   .ST/.CO/.OL/.HE Nordiques · .SA Brésil
 *
 * Exclus : Malaisie (code alpha ≠ numérique Yahoo), UK/Suisse (déjà EU), Mexique (DR étrangers),
 * Philippines (Yahoo ne résout pas .PS).
 *
 * ⚠️ Codes numériques (7203.T, 0700.HK, 600519.SS, 2222.SR) ou symboles longs (BAJAJFINSV.NS) et
 * classes nordiques à tiret (VOLV-B.ST) → le schéma de ticker accepte chiffres/tiret et jusqu'à
 * 15 caractères (cf. analyze.ts, screener.ts).
 */`;

async function main() {
  const generated = {};
  for (const ex of EXCHANGES) {
    const rows = await fetchExchange(ex.seg);
    const tk = toYahoo(ex, rows);
    const extras = CURATED_EXTRAS[ex.group] ?? [];
    const merged = NO_UNION.has(ex.group) ? [...tk, ...extras] : [...existingTickers(ex.group), ...tk, ...extras];
    generated[ex.group] = fmtArray(ex.group, ex.label, merged);
    console.log(`  ${ex.group.padEnd(13)}: ${String(rows.length).padStart(4)} bruts → ${tk.length} retenus (cap ${ex.cap}) → ${new Set(merged).size} avec union/extras`);
  }
  const spread = EXCHANGES.map((e) => `...${e.group}`);
  const out = [
    HEADER, '',
    ...EXCHANGES.flatMap((e) => [generated[e.group], '']),
    ...VERBATIM_TAIL.flatMap((n) => [verbatimBlock(n), '']),
    `/** Univers international curé complet (dédupliqué à l'ingestion). */
export const INTL_LARGE_CAPS: string[] = [
  ${spread.join(', ')},
  ...${VERBATIM_TAIL.join(', ...')},
];`, '',
  ].join('\n');
  fs.writeFileSync(SRC, out);
  const total = [...out.matchAll(/'[A-Z0-9.\-]+\.[A-Z]{1,3}'/g)].length;
  console.log(`✓ intlLargeCaps.ts régénéré (~${total} occurrences de tickers)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
