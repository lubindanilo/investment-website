/**
 * gen-asia-universe.mjs — régénère la partie ASIE de apps/api/src/data/intlLargeCaps.ts.
 *
 * Source : pages stockanalysis.com/list/{bourse}/ (top ~500 par capitalisation, champ JS embarqué
 * `stockData:[{s:"seg/base",marketCap,subtype},…]`). Convertit le slug stockanalysis (seg/base) en
 * symbole Yahoo (base + suffixe) — le format stocké par le site : prix via Yahoo, fondamentaux via
 * stockanalysis (SUFFIX_TO_SEG dans services/stockanalysisFundamentals.ts).
 *
 * Blocs NON asiatiques (Canada, Australie, Nordiques, Brésil) préservés VERBATIM. Blocs asiatiques
 * = union (curé existant ∪ top-500 généré), triés, 8/ligne.
 *
 * Malaisie EXCLUE : stockanalysis n'expose que le code alpha (MAYBANK), Yahoo exige le numérique
 * (1155.KL) → prix live cassé. À traiter avec une table de correspondance dédiée.
 *
 * Usage :  node scripts/gen-asia-universe.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../apps/api/src/data/intlLargeCaps.ts');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

// slug page liste → { seg attendu, suffixe Yahoo, nom du const TS, libellé, boursesNonAsie? }
const EXCHANGES = [
  { slug: 'tokyo-stock-exchange',       seg: 'tyo', suffix: '.T',  group: 'JAPAN',     label: 'Japon · Tokyo (.T)' },
  { slug: 'hong-kong-stock-exchange',   seg: 'hkg', suffix: '.HK', group: 'HONG_KONG', label: 'Hong Kong (.HK)' },
  { slug: 'shanghai-stock-exchange',    seg: 'sha', suffix: '.SS', group: 'SHANGHAI',  label: 'Chine · Shanghai (.SS)' },
  { slug: 'shenzhen-stock-exchange',    seg: 'she', suffix: '.SZ', group: 'SHENZHEN',  label: 'Chine · Shenzhen (.SZ)' },
  { slug: 'korea-stock-exchange',       seg: 'krx', suffix: '.KS', group: 'KOREA',     label: 'Corée · Séoul (.KS)' },
  { slug: 'taiwan-stock-exchange',      seg: 'tpe', suffix: '.TW', group: 'TAIWAN',    label: 'Taïwan (.TW)' },
  { slug: 'nse-india',                  seg: 'nse', suffix: '.NS', group: 'INDIA',     label: 'Inde · NSE (.NS)' },
  { slug: 'indonesia-stock-exchange',   seg: 'idx', suffix: '.JK', group: 'INDONESIA', label: 'Indonésie · IDX (.JK)' },
  { slug: 'stock-exchange-of-thailand', seg: 'bkk', suffix: '.BK', group: 'THAILAND',  label: 'Thaïlande · SET (.BK)' },
  { slug: 'singapore-exchange',         seg: 'sgx', suffix: '.SI', group: 'SINGAPORE', label: 'Singapour · SGX (.SI)' },
];
// Ordre des blocs asiatiques dans le fichier + l'export.
const ASIA_ORDER = ['JAPAN', 'HONG_KONG', 'SHANGHAI', 'SHENZHEN', 'KOREA', 'TAIWAN', 'INDIA', 'INDONESIA', 'THAILAND', 'SINGAPORE'];

// Extras curés : titres qu'on veut TOUJOURS inclure même hors du top-500 par capi de leur bourse
// (données stockanalysis vérifiées présentes). Unis dans leur groupe à chaque régénération.
const CURATED_EXTRAS = {
  HONG_KONG: ['1681.HK'], // Consun Pharmaceutical (~HK$11 Md, sous le cutoff top-500 ~HK$13,6 Md)
};
const NEW_GROUPS = new Set(['SHANGHAI', 'SHENZHEN', 'INDONESIA', 'THAILAND']); // pas d'existant à unir
const TICKER_RE = /^[A-Z0-9.\-]{1,15}$/;

async function fetchList(slug) {
  let lastErr;
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(`https://stockanalysis.com/list/${slug}/`, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw lastErr;
}

function parseTickers(html, ex) {
  const start = html.indexOf('stockData:[');
  if (start < 0) return [];
  const objs = html.slice(start).match(/\{no:\d+,[^}]*\}/g) || [];
  const out = [];
  for (const o of objs) {
    const s = o.match(/\bs:"([^"]+)"/)?.[1];
    const sub = o.match(/\bsubtype:"([^"]+)"/)?.[1] || 'stock';
    if (!s || sub !== 'stock') continue;
    const [seg, base] = s.split('/');
    if (seg !== ex.seg || !base) continue; // écarte les segments secondaires (ex. sgxc Catalist)
    const yahoo = (base + ex.suffix).toUpperCase();
    if (TICKER_RE.test(yahoo)) out.push(yahoo);
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
  return `// — ${label} — top ~500 par capitalisation (stockanalysis) ∪ curé —\nconst ${name}: string[] = [\n${lines.join('\n')}\n];`;
}

const HEADER = `/**
 * Grandes & moyennes capitalisations internationales (hors US et hors EU déjà couvertes par euLargeCaps).
 *
 * Pourquoi une liste curée + élargie : Finnhub free ne liste que les symboles US. Pour le reste du
 * monde on fournit une sélection par place boursière, scorée via le fallback Yahoo (prix) et
 * stockanalysis (fondamentaux trimestriels/semestriels).
 *
 * ASIE (juillet 2026) : élargie au top ~500 par capitalisation de chaque bourse, extrait des pages
 * stockanalysis.com/list/{bourse}/ (champ \`stockData\`) via scripts/gen-asia-universe.mjs — à
 * relancer pour rafraîchir. Bourses couvertes : Tokyo, Hong Kong, Shanghai, Shenzhen, Corée,
 * Taïwan, Inde (NSE), Indonésie, Thaïlande, Singapour (mainboard). Malaisie EXCLUE : stockanalysis
 * n'expose que le code alpha (MAYBANK) alors que Yahoo exige le code numérique (1155.KL) → prix
 * live cassé, à traiter plus tard avec une table de correspondance dédiée.
 *
 * Garantie « données disponibles » : le pipeline filtre — un ticker sans fondamentaux suffisants
 * est marqué \`nodata\` et n'apparaît jamais dans le screener (il faut scoreChiffresMax ≥ 8).
 * Élargir la liste n'introduit donc aucun faux résultat, seulement plus de candidats.
 *
 * Format = symbole Yahoo complet (suffixe d'exchange) :
 *   .TO Toronto · .AX Australie · .ST Stockholm · .CO Copenhague · .OL Oslo · .HE Helsinki
 *   .T Tokyo · .HK Hong Kong · .SS Shanghai · .SZ Shenzhen · .KS Corée · .TW Taïwan
 *   .NS Inde (NSE) · .JK Indonésie · .BK Thaïlande · .SI Singapour · .SA Brésil
 *
 * ⚠️ Asie/Inde/Brésil utilisent des codes numériques (7203.T, 0700.HK, 600519.SS, 005930.KS) ou
 * des symboles longs (BAJAJFINSV.NS) et certaines classes nordiques un tiret (VOLV-B.ST) →
 * le schéma de ticker accepte chiffres/tiret et jusqu'à 15 caractères (cf. analyze.ts, screener.ts).
 */`;

async function main() {
  const generated = {};
  for (const ex of EXCHANGES) {
    const tk = parseTickers(await fetchList(ex.slug), ex);
    const extras = CURATED_EXTRAS[ex.group] ?? [];
    const merged = NEW_GROUPS.has(ex.group) ? [...tk, ...extras] : [...existingTickers(ex.group), ...tk, ...extras];
    generated[ex.group] = fmtArray(ex.group, ex.label, merged);
    console.log(`  ${ex.group}: ${tk.length} extraits → ${new Set(merged).size} après union`);
  }
  const out = [
    HEADER, '',
    verbatimBlock('CANADA'), '',
    verbatimBlock('AUSTRALIA'), '',
    ...ASIA_ORDER.flatMap((g) => [generated[g], '']),
    verbatimBlock('SWEDEN'), '',
    verbatimBlock('DENMARK'), '',
    verbatimBlock('NORWAY'), '',
    verbatimBlock('FINLAND'), '',
    verbatimBlock('BRAZIL'), '',
    `/** Univers international curé complet (dédupliqué à l'ingestion). */
export const INTL_LARGE_CAPS: string[] = [
  ...CANADA, ...AUSTRALIA,
  ...JAPAN, ...HONG_KONG, ...SHANGHAI, ...SHENZHEN, ...KOREA, ...TAIWAN,
  ...INDIA, ...INDONESIA, ...THAILAND, ...SINGAPORE,
  ...SWEDEN, ...DENMARK, ...NORWAY, ...FINLAND, ...BRAZIL,
];`, '',
  ].join('\n');
  fs.writeFileSync(SRC, out);
  console.log('✓ intlLargeCaps.ts régénéré');
}
main().catch((e) => { console.error(e); process.exit(1); });
