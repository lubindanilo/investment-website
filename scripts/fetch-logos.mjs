/**
 * fetch-logos.mjs — télécharge les logos officiels UNE FOIS et les versionne dans le repo.
 *
 * POURQUOI un stockage local plutôt que la résolution à la volée :
 *   - les deux fournisseurs (Finnhub pour les titres US, l'icône du domaine officiel ailleurs)
 *     peuvent tomber, changer d'URL ou fermer. Un logo versionné, lui, s'affiche toujours ;
 *   - la résolution à la volée coûte deux allers-retours (notre API, puis le tiers) et son
 *     cache est en RAM, donc reperdu à chaque démarrage de fonction. Un fichier de `public/`
 *     est servi par le CDN Vercel ;
 *   - plus aucun navigateur de visiteur ne contacte un tiers pour les titres stockés.
 *
 * L'endpoint /api/screener/logo/:ticker reste le FILET pour tout ce qui n'est pas stocké
 * (cf. <CompanyLogo>) : la couverture locale n'a donc pas besoin d'être exhaustive.
 *
 * La liste stockée = les plus grosses capitalisations notées (ce sont les fiches réellement
 * ouvertes) + les listes éditoriales codées en dur (vitrine, palmarès, découverte).
 *
 * Usage :  node scripts/fetch-logos.mjs            (défaut : 400 titres)
 *          node scripts/fetch-logos.mjs --limit=800
 *          node scripts/fetch-logos.mjs --only=V,MSFT,ASML.AS
 *
 * Requiert DATABASE_URL et FINNHUB_API_KEY dans .env (LECTURE SEULE sur la base).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'apps/web/public/logos');
const MANIFEST = path.join(ROOT, 'apps/web/src/data/logoManifest.ts');

const args = process.argv.slice(2);
const argOf = (name) => args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const LIMIT = Number(argOf('limit') ?? 400);
const ONLY = argOf('only')?.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

// Charge .env sans dépendance (le repo n'a pas dotenv à la racine).
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const FINNHUB_KEY = process.env.FINNHUB_API_KEY ?? '';

/** Titres toujours stockés : ils sont affichés par du code, pas par le hasard des visites. */
const ALWAYS = [
  // vitrine de la landing (SHOWCASE_TICKERS)
  'ASML.AS', 'ADBE', 'MC.PA', 'GOOGL', 'MSFT', 'RMS.PA', 'NVO', 'V', 'NKE', 'SAP.DE',
  // découverte de /analyser (POPULAR_TICKERS)
  'AAPL', 'NVDA', 'AMZN', 'META',
  // palmarès du backtest (PALMARES_PICKS)
  'FIX', 'LRCX', 'MU', 'CIEN', 'RMBS', 'MLI', 'PWR', 'ANET', 'FORM', 'APH', 'PHM',
];

/** Au-delà, la capitalisation stockée est forcément fausse (aucune société cotée n'atteint
 *  ce niveau, même en yens ou en wons). Cf. le commentaire de tickerList(). */
const MARKETCAP_SANITY_MAX = 6e14;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Lubin-Investment/0.1';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Extension réelle d'après le type MIME (une .ico enregistrée en .png ne s'affiche pas partout). */
function extOf(contentType) {
  const t = (contentType ?? '').toLowerCase();
  if (t.includes('png')) return 'png';
  if (t.includes('svg')) return 'svg';
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('webp')) return 'webp';
  if (t.includes('avif')) return 'avif';
  if (t.includes('gif')) return 'gif';
  if (t.includes('icon') || t.includes('ico')) return 'ico';
  return null;
}

/** Domaine → icône officielle. Même service que l'endpoint, pour un rendu identique. */
function iconOfWebsite(website) {
  if (!website) return null;
  try {
    const host = new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace(/^www\./, '');
    return host.includes('.') ? `https://icons.duckduckgo.com/ip3/${host}.ico` : null;
  } catch { return null; }
}

async function finnhubProfile(ticker) {
  if (!FINNHUB_KEY || ticker.includes('.')) return null;   // 403 garanti sur les symboles suffixés
  try {
    const r = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(ticker)}`,
      { headers: { 'X-Finnhub-Token': FINNHUB_KEY } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// Session Yahoo (cookies + crumb), nécessaire pour quoteSummary.
let yahooSession = null;
async function getYahooSession() {
  if (yahooSession) return yahooSession;
  let cookies = '';
  try {
    const s = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual' });
    cookies = (s.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ');
  } catch { /* best effort */ }
  const headers = { 'User-Agent': UA, Accept: 'text/plain' };
  if (cookies) headers.Cookie = cookies;
  const cr = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers });
  yahooSession = { crumb: (await cr.text()).trim(), cookies };
  return yahooSession;
}

async function yahooWebsite(ticker) {
  try {
    const s = await getYahooSession();
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}`
      + `?modules=assetProfile&crumb=${encodeURIComponent(s.crumb)}`;
    const headers = { 'User-Agent': UA, Accept: 'application/json' };
    if (s.cookies) headers.Cookie = s.cookies;
    const r = await fetch(url, { headers });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.quoteSummary?.result?.[0]?.assetProfile?.website ?? null;
  } catch { return null; }
}

/**
 * CANDIDATS par ordre de préférence, pas une seule URL : le logo officiel de Finnhub est le
 * plus beau mais parfois trop lourd pour une pastille (Nvidia : 62 Ko, Comcast : 75 Ko). Dans
 * ce cas on veut basculer sur l'icône du domaine, bien plus légère, plutôt que d'abandonner
 * le titre. Même ordre que resolveLogo() dans apps/api/src/routes/screener.ts.
 */
async function logoCandidates(ticker) {
  const out = [];
  const p = await finnhubProfile(ticker);
  if (p?.logo) out.push(p.logo);
  const fromFinnhub = iconOfWebsite(p?.weburl ?? null);
  if (fromFinnhub) out.push(fromFinnhub);
  if (!out.length || !p?.weburl) {
    const fromYahoo = iconOfWebsite(await yahooWebsite(ticker));
    if (fromYahoo && !out.includes(fromYahoo)) out.push(fromYahoo);
  }
  return out;
}

/** Premier candidat qui donne un fichier exploitable et assez léger. */
async function downloadFirst(urls) {
  for (const url of urls) {
    const file = await download(url);
    if (file) return file;
  }
  return null;
}

/** Poids max d'un logo versionné. Au-delà on préfère ne pas le stocker : le filet côté API
 *  prendra le relais à l'affichage, et le repo ne gonfle pas pour une pastille de 34 px. */
const MAX_BYTES = 48 * 1024;

/**
 * Un .ico est un CONTENEUR : il empile toutes les résolutions (jusqu'à 364 Ko pour une seule
 * société). On en extrait UNE image, la plus grande jusqu'à 128 px, quand elle est encodée en
 * PNG (cas courant des .ico modernes). Évite d'embarquer une bibliothèque d'images juste pour ça.
 *
 * Format : en-tête 6 o, puis N entrées de 16 o {largeur, hauteur, …, taille(4), offset(4)}.
 */
function pngFromIco(buf) {
  if (buf.length < 6 || buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null;
  const count = buf.readUInt16LE(4);
  let best = null;
  for (let i = 0; i < count; i++) {
    const off = 6 + i * 16;
    if (off + 16 > buf.length) break;
    const width = buf[off] === 0 ? 256 : buf[off];       // 0 code une image de 256 px
    const size = buf.readUInt32LE(off + 8);
    const start = buf.readUInt32LE(off + 12);
    if (start + size > buf.length || size <= 0) continue;
    const blob = buf.subarray(start, start + size);
    // Signature PNG : l'entrée est un fichier PNG autonome, réutilisable tel quel.
    if (!(blob[0] === 0x89 && blob[1] === 0x50 && blob[2] === 0x4e && blob[3] === 0x47)) continue;
    if (width > 128) continue;
    if (!best || width > best.width) best = { width, blob };
  }
  return best ? Buffer.from(best.blob) : null;
}

async function download(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  let ext = extOf(r.headers.get('content-type'));
  if (!ext) return null;
  let buf = Buffer.from(await r.arrayBuffer());
  // Une icône par défaut fait quelques dizaines d'octets : ce n'est pas un logo.
  if (buf.length < 200) return null;

  if (ext === 'ico') {
    const png = pngFromIco(buf);
    if (png && png.length < buf.length) { buf = png; ext = 'png'; }
  }
  if (buf.length > MAX_BYTES) return null;
  return { buf, ext };
}

/**
 * Prisma vit dans apps/api (pnpm ne le remonte pas à la racine) : on le charge à la demande,
 * pour que `--only=...` fonctionne sans base ni DATABASE_URL.
 */
async function loadPrisma() {
  for (const spec of ['@prisma/client', path.join(ROOT, 'apps/api/node_modules/@prisma/client/default.js')]) {
    try { return (await import(spec)).PrismaClient; } catch { /* on tente le suivant */ }
  }
  throw new Error("@prisma/client introuvable — lance `pnpm --filter @lubin/api exec prisma generate`");
}

/**
 * Tickers cités par un article du blog : ce sont des liens internes réels, donc les fiches
 * les plus ouvertes. Bien plus fiable que la capitalisation pour deviner ce qui sera affiché.
 */
function articleTickers() {
  const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/articles.ts'), 'utf8');
  return [...new Set([...src.matchAll(/^\s*ticker:\s*'([^']+)'/gm)].map(m => m[1].toUpperCase()))];
}

async function tickerList() {
  if (ONLY) return ONLY;
  const base = [...ALWAYS, ...articleTickers()];

  const PrismaClient = await loadPrisma();
  const prisma = new PrismaClient();
  try {
    // LECTURE SEULE, une requête. On complète par les plus grosses capitalisations, mais avec
    // un GARDE-FOU : le champ `marketCap` est corrompu pour une partie de l'univers (des
    // micro-caps stockées au-delà de 1 000 milliards), donc un tri brut remonte n'importe quoi.
    // Le plafond écarte l'absurde sans écarter les vraies grandes capis en devise locale
    // (Toyota vaut ~4e13 JPY, ce qui reste sous la limite).
    const rows = await prisma.screenerTicker.findMany({
      where: { status: 'scored', marketCap: { gt: 1e9, lt: MARKETCAP_SANITY_MAX } },
      orderBy: { marketCap: 'desc' },
      take: LIMIT,
      select: { ticker: true },
    });
    // Les opportunités du moment : c'est le vivier dans lequel la landing puise ses lignes de
    // veille, donc des logos affichés en page d'accueil, quelle que soit leur capitalisation.
    const opps = await prisma.screenerTicker.findMany({
      where: { status: 'scored', opportunity: true, scoreChiffresMax: { gte: 8 } },
      orderBy: { scoreRatio: 'desc' },
      take: 200,
      select: { ticker: true },
    });
    return [...new Set([...base, ...opps.map(r => r.ticker), ...rows.map(r => r.ticker)])];
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const tickers = await tickerList();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // On repart de ce qui est déjà là : le script est ré-exécutable sans tout retélécharger.
  const existing = new Map();
  for (const f of fs.readdirSync(OUT_DIR)) {
    const m = /^(.+)\.([a-z]+)$/.exec(f);
    if (m) existing.set(m[1].replace(/_/g, '.'), m[2]);
  }

  let added = 0, kept = 0, missing = 0;
  for (const [i, ticker] of tickers.entries()) {
    if (existing.has(ticker)) { kept++; continue; }
    const file = await downloadFirst(await logoCandidates(ticker));
    if (file) {
      // Le point d'un suffixe de bourse casserait l'extension : ASML.AS → ASML_AS.png
      fs.writeFileSync(path.join(OUT_DIR, `${ticker.replace(/\./g, '_')}.${file.ext}`), file.buf);
      existing.set(ticker, file.ext);
      added++;
    } else {
      missing++;
    }
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${tickers.length} — ${added} ajoutés, ${kept} déjà là, ${missing} sans logo`);
    await sleep(120);   // on ménage les deux fournisseurs
  }

  // Manifeste : le front sait quels tickers sont stockés, donc il n'émet aucune requête 404
  // avant de tomber sur le filet.
  const entries = [...existing.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  fs.writeFileSync(MANIFEST,
    `/**\n * Logos versionnés dans apps/web/public/logos/ — GÉNÉRÉ, ne pas éditer à la main.\n`
    + ` * Régénérer :  node scripts/fetch-logos.mjs\n *\n`
    + ` * Le front lit ce manifeste pour servir le fichier local quand il existe, et ne\n`
    + ` * retombe sur /api/screener/logo/:ticker que pour les titres absents d'ici.\n */\n`
    + `export const LOGO_FILES: Record<string, string> = {\n`
    + entries.map(([t, ext]) => `  ${JSON.stringify(t)}: ${JSON.stringify(`${t.replace(/\./g, '_')}.${ext}`)},`).join('\n')
    + `\n};\n`);

  console.log(`\n✅ ${entries.length} logos stockés (${added} nouveaux, ${missing} sans logo connu).`);
  console.log(`   Images  : apps/web/public/logos/`);
  console.log(`   Manifeste : apps/web/src/data/logoManifest.ts`);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
