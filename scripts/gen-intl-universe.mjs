/**
 * gen-intl-universe.mjs — régénère la partie « grands marchés mondiaux » de
 * apps/api/src/data/intlLargeCaps.ts.
 *
 * Source : pages stockanalysis.com/list/{bourse}/ (top ~500 par capitalisation, champ JS embarqué
 * `stockData:[{s:"seg/base",marketCap,subtype},…]`). Convertit le slug stockanalysis (seg/base) en
 * symbole Yahoo (base + suffixe) — le format stocké par le site : prix + earnings via Yahoo,
 * fondamentaux via stockanalysis (SUFFIX_TO_SEG dans services/stockanalysisFundamentals.ts).
 *
 * Blocs européens (Nordiques) + Brésil préservés VERBATIM. Les autres blocs = union
 * (curé existant ∪ top-500 généré), triés, 8/ligne.
 *
 * EXCLUSIONS assumées :
 *   - Malaisie : stockanalysis n'expose que le code alpha (MAYBANK), Yahoo exige le numérique
 *     (1155.KL) → prix live cassé. À traiter avec une table de correspondance dédiée.
 *   - Royaume-Uni / Suisse : déjà couverts par euLargeCaps (région EU) → éviter le double comptage.
 *   - Mexique : top-500 dominé par des DR étrangers (bmv/AAPL…) → bruité.
 *   - Brésil : pas de page list exploitable → on garde le bloc curé BRAZIL verbatim.
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

// slug page liste → { seg attendu, suffixe Yahoo, const TS, libellé }. Ordre = ordre dans le fichier.
const EXCHANGES = [
  { slug: 'toronto-stock-exchange',        seg: 'tsx',     suffix: '.TO', group: 'CANADA',       label: 'Canada · Toronto (.TO)' },
  { slug: 'australian-securities-exchange',seg: 'asx',     suffix: '.AX', group: 'AUSTRALIA',    label: 'Australie · ASX (.AX)' },
  { slug: 'tokyo-stock-exchange',          seg: 'tyo',     suffix: '.T',  group: 'JAPAN',        label: 'Japon · Tokyo (.T)' },
  { slug: 'hong-kong-stock-exchange',      seg: 'hkg',     suffix: '.HK', group: 'HONG_KONG',    label: 'Hong Kong (.HK)' },
  { slug: 'shanghai-stock-exchange',       seg: 'sha',     suffix: '.SS', group: 'SHANGHAI',     label: 'Chine · Shanghai (.SS)' },
  { slug: 'shenzhen-stock-exchange',       seg: 'she',     suffix: '.SZ', group: 'SHENZHEN',     label: 'Chine · Shenzhen (.SZ)' },
  { slug: 'korea-stock-exchange',          seg: 'krx',     suffix: '.KS', group: 'KOREA',        label: 'Corée · Séoul (.KS)' },
  { slug: 'taiwan-stock-exchange',         seg: 'tpe',     suffix: '.TW', group: 'TAIWAN',       label: 'Taïwan (.TW)' },
  { slug: 'nse-india',                     seg: 'nse',     suffix: '.NS', group: 'INDIA',        label: 'Inde · NSE (.NS)' },
  { slug: 'indonesia-stock-exchange',      seg: 'idx',     suffix: '.JK', group: 'INDONESIA',    label: 'Indonésie · IDX (.JK)' },
  { slug: 'stock-exchange-of-thailand',    seg: 'bkk',     suffix: '.BK', group: 'THAILAND',     label: 'Thaïlande · SET (.BK)' },
  { slug: 'singapore-exchange',            seg: 'sgx',     suffix: '.SI', group: 'SINGAPORE',    label: 'Singapour · SGX (.SI)' },
  { slug: 'saudi-stock-exchange',          seg: 'tadawul', suffix: '.SR', group: 'SAUDI',        label: 'Arabie Saoudite · Tadawul (.SR)' },
  { slug: 'johannesburg-stock-exchange',   seg: 'jse',     suffix: '.JO', group: 'SOUTH_AFRICA', label: 'Afrique du Sud · JSE (.JO)' },
  { slug: 'borsa-istanbul',                seg: 'ist',     suffix: '.IS', group: 'TURKEY',       label: 'Turquie · BIST (.IS)' },
];
// Groupes SANS bloc curé existant (pas d'union) — les autres unissent l'existant.
const NEW_GROUPS = new Set(['SHANGHAI', 'SHENZHEN', 'INDONESIA', 'THAILAND', 'SAUDI', 'SOUTH_AFRICA', 'TURKEY']);
// Blocs européens + Brésil : NON régénérés (préservés verbatim), placés après les blocs générés.
const VERBATIM_TAIL = ['SWEDEN', 'DENMARK', 'NORWAY', 'FINLAND', 'BRAZIL'];

// Titres qu'on veut TOUJOURS inclure même hors du top-500 par capi (données stockanalysis vérifiées).
const CURATED_EXTRAS = {
  HONG_KONG: ['1681.HK'], // Consun Pharmaceutical (~HK$11 Md, sous le cutoff top-500 ~HK$13,6 Md)
};
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
 * Grandes & moyennes capitalisations mondiales (hors US couvert par sp500Universe, hors EU couvert
 * par euLargeCaps).
 *
 * Pourquoi une liste curée + élargie : Finnhub free ne liste que les symboles US. Pour le reste du
 * monde on fournit une sélection par place boursière, scorée via Yahoo (prix + date d'earnings, qui
 * pilote la cadence de re-scoring) et stockanalysis (fondamentaux trimestriels/semestriels).
 *
 * Univers (juillet 2026) : top ~500 par capitalisation de chaque bourse, extrait des pages
 * stockanalysis.com/list/{bourse}/ (champ \`stockData\`) via scripts/gen-intl-universe.mjs — à
 * relancer pour rafraîchir. Bourses : Canada, Australie, Tokyo, Hong Kong, Shanghai, Shenzhen,
 * Corée, Taïwan, Inde (NSE), Indonésie, Thaïlande, Singapour (mainboard), Arabie Saoudite, Afrique
 * du Sud, Turquie. Nordiques + Brésil restent curés. Exclus : Malaisie (code alpha ≠ code numérique
 * Yahoo → prix cassé), UK/Suisse (déjà en EU), Mexique (DR étrangers).
 *
 * Garantie « données disponibles » : le pipeline filtre — un ticker sans fondamentaux/prix
 * suffisants est marqué \`nodata\` et n'apparaît jamais dans le screener (scoreChiffresMax ≥ 8).
 * Élargir la liste n'introduit donc aucun faux résultat, seulement plus de candidats.
 *
 * Format = symbole Yahoo complet (suffixe d'exchange) :
 *   .TO Toronto · .AX Australie · .ST Stockholm · .CO Copenhague · .OL Oslo · .HE Helsinki
 *   .T Tokyo · .HK Hong Kong · .SS Shanghai · .SZ Shenzhen · .KS Corée · .TW Taïwan
 *   .NS Inde · .JK Indonésie · .BK Thaïlande · .SI Singapour · .SR Arabie Saoudite
 *   .JO Afrique du Sud · .IS Turquie · .SA Brésil
 *
 * ⚠️ Codes numériques (7203.T, 0700.HK, 600519.SS, 005930.KS, 2222.SR) ou symboles longs
 * (BAJAJFINSV.NS) et certaines classes nordiques à tiret (VOLV-B.ST) → le schéma de ticker accepte
 * chiffres/tiret et jusqu'à 15 caractères (cf. analyze.ts, screener.ts).
 */`;

async function main() {
  const generated = {};
  for (const ex of EXCHANGES) {
    const tk = parseTickers(await fetchList(ex.slug), ex);
    const extras = CURATED_EXTRAS[ex.group] ?? [];
    const merged = NEW_GROUPS.has(ex.group) ? [...tk, ...extras] : [...existingTickers(ex.group), ...tk, ...extras];
    generated[ex.group] = fmtArray(ex.group, ex.label, merged);
    console.log(`  ${ex.group.padEnd(13)}: ${String(tk.length).padStart(3)} extraits → ${new Set(merged).size} après union`);
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
