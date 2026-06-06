/**
 * stockanalysisFundamentals — source EU/INTL des fondamentaux (TRIMESTRIEL / SEMESTRIEL).
 *
 * Yahoo ne donne que ~5 trimestres glissants pour les non-US. Finnhub free ne couvre pas les
 * EU. stockanalysis.com (gratuit, server-rendered HTML) expose en revanche **20 périodes**
 * (5 ans quarterly OU 10 ans semestriel selon la cadence native de la société) dans un payload
 * JS embarqué (`financialData:{...}`) que l'on parse directement.
 *
 * Couverture vérifiée :
 *   - ~60 % des large caps EU/INTL : vrai trimestriel, 5 ans (SAP, ASML, SHEL, AZN, NVS…)
 *   - ~25 % : semestriel natif, 10 ans (LVMH, Hermès, L'Oréal, Air Liquide, Nestlé, Roche…)
 *     — c'est la cadence RÉELLE de publication de ces sociétés (directive Transparence UE 2013)
 *   - ~15 % : indisponible → fallback Yahoo annuel via yahooAnnualStore
 *
 * Robustesse :
 *   - throttle 1 req/s (token bucket global)
 *   - 3 retries avec back-off sur erreurs réseau / 403 / 5xx
 *   - User-Agent navigateur réel
 *   - 3 pages séparées (income, cash-flow, balance-sheet) → 3 fetches par ticker
 *   - parser tolérant (le payload est du JS, pas du JSON — clés sans guillemets)
 */
import type { TimeseriesPoint } from '@lubin/shared';
import Bottleneck from 'bottleneck';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const BASE = 'https://stockanalysis.com';

// Throttle : 1 req/s, max 2 concurrentes (pour ne pas déclencher Cloudflare).
const limiter = new Bottleneck({ minTime: 1000, maxConcurrent: 2 });

// ─── Mapping suffixe Yahoo → segment URL stockanalysis ──────────────────────
// Format URL : https://stockanalysis.com/quote/{segment}/{base}/financials/...
// Pour les tickers US-listed directement (SAP, ASML, SHEL…), on utilise /stocks/{ticker}/
// — pas de segment ni de tirets/points dans le ticker URL.
const SUFFIX_TO_SEG: Record<string, string> = {
  '.DE': 'etr',  // Deutsche Börse Xetra
  '.PA': 'epa',  // Euronext Paris
  '.AS': 'ams',  // Amsterdam
  '.SW': 'swx',  // SIX Swiss
  '.L':  'lon',  // London Stock Exchange
  '.MI': 'mil',  // Milan
  '.MC': 'bme',  // Madrid
  '.BR': 'ebr',  // Brussels
  '.LS': 'lis',  // Lisbon
  '.HE': 'hel',  // Helsinki
  '.ST': 'sto',  // Stockholm
  '.CO': 'cph',  // Copenhagen
  '.OL': 'osl',  // Oslo
  '.VI': 'vie',  // Vienna
  '.IR': 'dub',  // Dublin
  '.T':  'tyo',  // Tokyo (INTL)
  '.HK': 'hkg',  // Hong Kong
  '.AX': 'asx',  // Australia
  '.TO': 'tse',  // Toronto
  '.SS': 'shh',  // Shanghai
  '.SZ': 'shz',  // Shenzhen
};

// Tickers qui ont une cotation US directe (NYSE/NASDAQ) : on préfère /stocks/{ticker}/
// car la profondeur historique est meilleure et la devise USD est cohérente avec EDGAR.
const US_LISTED_DIRECT = new Set(['SAP', 'ASML', 'SHEL', 'BP', 'AZN', 'NVS', 'UL', 'DEO', 'SNY', 'NVO', 'TM', 'GSK']);

interface YahooTickerInfo { base: string; suffix: string }

function splitTicker(yahooTicker: string): YahooTickerInfo {
  const i = yahooTicker.lastIndexOf('.');
  return i < 0
    ? { base: yahooTicker, suffix: '' }
    : { base: yahooTicker.slice(0, i), suffix: yahooTicker.slice(i) };
}

/** Construit les URL candidates (primaire, fallback) pour un ticker. */
export function buildUrls(yahooTicker: string, statement: 'income' | 'cash-flow' | 'balance-sheet'): string[] {
  const { base, suffix } = splitTicker(yahooTicker.toUpperCase());
  // Vérifié verbatim sur les pages :
  //   income        → /financials/
  //   cash-flow     → /financials/cash-flow-statement/
  //   balance-sheet → /financials/balance-sheet/    (PAS "-statement" — sa-site est asymétrique)
  const path =
    statement === 'income'        ? 'financials' :
    statement === 'cash-flow'     ? 'financials/cash-flow-statement' :
    /* balance-sheet */            'financials/balance-sheet';
  const seg = SUFFIX_TO_SEG[suffix];
  const urls: string[] = [];

  // Cotation US directe (pour les ADR/dual-listed connus) — slug en minuscules.
  if (US_LISTED_DIRECT.has(base) || !suffix) {
    urls.push(`${BASE}/stocks/${base.toLowerCase()}/${path}/?p=quarterly`);
  }
  // Cotation native via segment exchange — slug en MAJUSCULES (vérifié sur MC.PA = /quote/epa/MC/).
  if (seg) {
    urls.push(`${BASE}/quote/${seg}/${base}/${path}/?p=quarterly`);
  }
  // Fallback générique : /stocks/{base}/ — pour les sociétés US-listed qu'on n'a pas explicitement
  // dans US_LISTED_DIRECT (ex Ferrari RACE.MI = /stocks/race/). Tenté en dernier recours, ne coûte
  // qu'un fetch additionnel si les URLs précédentes ont retourné 404.
  if (!US_LISTED_DIRECT.has(base)) {
    urls.push(`${BASE}/stocks/${base.toLowerCase()}/${path}/?p=quarterly`);
  }
  return urls;
}

interface ParseResult {
  /** Dates de fin de période, du plus récent au plus ancien (ordre natif stockanalysis). */
  dates: string[];
  /** Cadence détectée à partir de l'écart médian entre 2 dates consécutives. */
  freq: 'quarterly' | 'semiannual' | 'annual';
  /** Champs primitifs extraits — clés telles que dans le payload. */
  fields: Record<string, (number | null)[]>;
}

/** Extrait la première occurrence du blob `financialData:{...}` du HTML. */
function extractBlob(html: string): string | null {
  // Le payload est un objet JS (clés sans guillemets) : on cherche `financialData:{...}` et
  // on prend tout jusqu'à la première accolade fermante de bon niveau.
  const i = html.indexOf('financialData:{');
  if (i < 0) return null;
  let depth = 0;
  for (let j = i + 'financialData:'.length; j < html.length; j++) {
    const c = html[j];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return html.slice(i + 'financialData:'.length, j + 1);
    }
  }
  return null;
}

/** Extrait un array `key:[…]` depuis le blob. Renvoie le contenu brut (sans crochets). */
function extractArrayRaw(blob: string, key: string): string | null {
  // Match `key:[` puis tout jusqu'au `]` correspondant. Pas de nesting [] dans les valeurs.
  const re = new RegExp(`(?:^|[,{])${key}:\\[([^\\]]*)\\]`);
  const m = blob.match(re);
  return m ? m[1]! : null;
}

/** Parse une liste de valeurs (nombres ou strings entre guillemets ou null). */
function parseValues(raw: string): (number | null)[] {
  if (!raw.trim()) return [];
  const out: (number | null)[] = [];
  // Split simple sur les virgules (sécurisé car pas de nesting dans nos cas).
  const parts = raw.split(',');
  for (const p of parts) {
    const v = p.trim();
    if (!v || v === 'null' || v === 'undefined') { out.push(null); continue; }
    if (v.startsWith('"')) { out.push(null); continue; } // string (date) → on garde ailleurs
    const n = Number(v);
    out.push(Number.isFinite(n) ? n : null);
  }
  return out;
}

/** Parse une liste de strings entre guillemets (typiquement les dates). */
function parseStrings(raw: string): string[] {
  if (!raw.trim()) return [];
  const out: string[] = [];
  const re = /"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) out.push(m[1]!);
  return out;
}

/** Détecte la cadence à partir de l'écart médian entre 2 dates successives (jours). */
function detectFreq(dates: string[]): 'quarterly' | 'semiannual' | 'annual' {
  if (dates.length < 2) return 'quarterly'; // par défaut
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const t0 = Date.parse(dates[i - 1]! + 'T12:00:00Z');
    const t1 = Date.parse(dates[i]! + 'T12:00:00Z');
    if (Number.isFinite(t0) && Number.isFinite(t1)) gaps.push(Math.abs(t0 - t1) / 86400000);
  }
  if (gaps.length === 0) return 'quarterly';
  gaps.sort((a, b) => a - b);
  const med = gaps[Math.floor(gaps.length / 2)]!;
  if (med < 120) return 'quarterly';
  if (med < 250) return 'semiannual';
  return 'annual';
}

function parsePage(html: string, fieldsWanted: string[]): ParseResult | null {
  const blob = extractBlob(html);
  if (!blob) return null;
  const dkRaw = extractArrayRaw(blob, 'datekey');
  if (!dkRaw) return null;
  const dates = parseStrings(dkRaw);
  if (dates.length === 0) return null;
  const fields: Record<string, (number | null)[]> = {};
  for (const k of fieldsWanted) {
    const raw = extractArrayRaw(blob, k);
    if (raw == null) continue;
    fields[k] = parseValues(raw);
  }
  return { dates, freq: detectFreq(dates), fields };
}

async function fetchOnce(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`stockanalysis HTTP ${res.status} ${url}`);
  return res.text();
}

/** Fetch avec retries exponentiels + bascule sur URL fallback si la primaire renvoie 404. */
async function fetchWithRetry(urls: string[]): Promise<string | null> {
  let lastErr: unknown;
  for (const url of urls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await limiter.schedule(() => fetchOnce(url));
      } catch (e) {
        lastErr = e;
        const msg = (e as Error).message ?? '';
        // 404 → bascule URL suivante ; 403/5xx → retry sur la même.
        if (/HTTP 404/.test(msg)) break;
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  if (lastErr) console.warn(`[stockanalysis] échec total :`, (lastErr as Error).message);
  return null;
}

// Mapping clés stockanalysis → clés métriques internes (MetricKey de finnhubFundamentals).
const FIELDS_INCOME: Record<string, string> = {
  revenue: 'revenue',
  netIncome: 'netIncome',
  operatingIncome: 'operatingIncome',
  sharesDiluted: 'shares',
};
const FIELDS_CASHFLOW: Record<string, string> = {
  ncfo: 'cfo',
  capex: 'capex',
  sbcomp: 'sbc',
  fcf: 'fcf',
};
const FIELDS_BALANCE: Record<string, string> = {
  debt: 'totalDebt',
  cashneq: 'cash',
};

export interface StockanalysisBatch {
  freq: 'quarterly' | 'semiannual' | 'annual';
  /** Métriques disponibles → série {date, value}, ordre chronologique croissant. */
  series: Map<string, TimeseriesPoint[]>;
}

/** Fetch + parse les 3 statements pour un ticker Yahoo. Renvoie null si tout échoue. */
export async function getStockanalysisQuarterlyBatch(yahooTicker: string): Promise<StockanalysisBatch | null> {
  const pages = await Promise.all([
    fetchWithRetry(buildUrls(yahooTicker, 'income')),
    fetchWithRetry(buildUrls(yahooTicker, 'cash-flow')),
    fetchWithRetry(buildUrls(yahooTicker, 'balance-sheet')),
  ]);
  const [incomeHtml, cfHtml, bsHtml] = pages;
  if (!incomeHtml && !cfHtml && !bsHtml) return null;

  // Parse + détermine la cadence à partir de la 1re page disponible (toutes les 3 doivent
  // partager la même cadence pour un même ticker).
  const parsedIncome   = incomeHtml ? parsePage(incomeHtml,   Object.keys(FIELDS_INCOME))   : null;
  const parsedCashflow = cfHtml     ? parsePage(cfHtml,       Object.keys(FIELDS_CASHFLOW)) : null;
  const parsedBalance  = bsHtml     ? parsePage(bsHtml,       Object.keys(FIELDS_BALANCE))  : null;
  const first = parsedIncome ?? parsedCashflow ?? parsedBalance;
  if (!first) return null;
  const freq = first.freq;

  // Construit les séries en ORDRE CHRONOLOGIQUE CROISSANT (l'ordre attendu downstream).
  const series = new Map<string, TimeseriesPoint[]>();
  const addAll = (parsed: ParseResult | null, mapping: Record<string, string>) => {
    if (!parsed) return;
    const dates = parsed.dates;
    for (const [src, dst] of Object.entries(mapping)) {
      const vals = parsed.fields[src];
      if (!vals) continue;
      const pts: TimeseriesPoint[] = [];
      for (let i = 0; i < dates.length; i++) {
        const v = vals[i];
        if (typeof v === 'number' && Number.isFinite(v)) pts.push({ date: dates[i]!, value: v });
      }
      pts.sort((a, b) => a.date.localeCompare(b.date));
      if (pts.length) series.set(dst, pts);
    }
  };
  addAll(parsedIncome,   FIELDS_INCOME);
  addAll(parsedCashflow, FIELDS_CASHFLOW);
  addAll(parsedBalance,  FIELDS_BALANCE);

  return { freq, series };
}
