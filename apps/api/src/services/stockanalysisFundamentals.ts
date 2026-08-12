/**
 * stockanalysisFundamentals — source EU/INTL des fondamentaux (TRIMESTRIEL / SEMESTRIEL).
 *
 * Yahoo ne donne que ~5 trimestres glissants pour les non-US. Finnhub free ne couvre pas les
 * EU. stockanalysis.com (gratuit, server-rendered HTML) expose en revanche **jusqu'à 20 périodes
 * intra-annuelles** (5 ans quarterly OU 10 ans semestriel selon la cadence native de la société)
 * et **~5 exercices annuels** (au-delà = compte Pro), dans un payload JS embarqué que l'on parse
 * directement (cf. extractBlob : le nom de la clé conteneur varie selon la page).
 *
 * Couverture vérifiée :
 *   - ~60 % des large caps EU/INTL : vrai trimestriel, 5 ans (SAP, ASML, SHEL, AZN, NVS…)
 *   - ~25 % : semestriel natif, 10 ans (LVMH, Hermès, L'Oréal, Air Liquide, Nestlé, Roche…)
 *     — c'est la cadence RÉELLE de publication de ces sociétés (directive Transparence UE 2013)
 *   - ~15 % : indisponible → fallback Yahoo annuel via yahooAnnualStore
 *
 * La profondeur peut DIFFÉRER d'une page à l'autre pour un même titre : sur DG.PA, cash-flow et
 * bilan remontent à 2016 (20 semestres) quand le compte de résultat s'arrête à 2021 (10). Chaque
 * métrique porte donc son propre historique — c'est voulu, on ne tronque pas au plus court.
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

/** Une colonne n'est une période datée que si son `datekey` est une date ISO (cf. « TTM »). */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
  '.TO': 'tsx',  // Toronto (⚠ slug 'tsx', pas 'tse' — 'tse' renvoie 404)
  '.SS': 'sha',  // Shanghai (⚠ slug 'sha', pas 'shh' — 'shh' renvoie 404)
  '.SZ': 'she',  // Shenzhen (⚠ slug 'she', pas 'shz' — 'shz' renvoie 404)
  '.KS': 'krx',  // Corée · Séoul
  '.TW': 'tpe',  // Taïwan
  '.NS': 'nse',  // Inde · NSE
  '.JK': 'idx',  // Indonésie
  '.BK': 'bkk',  // Thaïlande
  '.SI': 'sgx',  // Singapour (mainboard ; Catalist 'sgxc' non couvert)
  '.SR': 'tadawul', // Arabie Saoudite (Tadawul)
  '.JO': 'jse',  // Afrique du Sud (Johannesburg)
  '.IS': 'ist',  // Turquie (Borsa Istanbul)
  '.VN': 'hose', // Vietnam (Ho Chi Minh · HOSE)
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

/** Périodicité de la page demandée (paramètre `?p=` de stockanalysis). */
export type SaPeriod = 'quarterly' | 'annual';

/**
 * Bases d'URL candidates (primaire puis fallbacks) pour un ticker — sans le chemin de page.
 * Mêmes règles de slug que depuis l'origine :
 *   - cotation US directe (ADR/dual-listed connus ou ticker sans suffixe) → /stocks/{base} ;
 *   - cotation native via segment exchange — slug en MAJUSCULES (vérifié sur MC.PA = /quote/epa/MC/) ;
 *   - fallback générique /stocks/{base} en dernier recours (ex Ferrari RACE.MI = /stocks/race/),
 *     ne coûte qu'un fetch additionnel si les URLs précédentes ont retourné 404.
 */
function candidateBases(yahooTicker: string): string[] {
  const { base, suffix } = splitTicker(yahooTicker.toUpperCase());
  const seg = SUFFIX_TO_SEG[suffix];
  const bases: string[] = [];
  if (US_LISTED_DIRECT.has(base) || !suffix) {
    bases.push(`${BASE}/stocks/${base.toLowerCase()}`);
  }
  if (seg) {
    bases.push(`${BASE}/quote/${seg}/${base}`);
  }
  if (!US_LISTED_DIRECT.has(base)) {
    bases.push(`${BASE}/stocks/${base.toLowerCase()}`);
  }
  return [...new Set(bases)];
}

/** Construit les URL candidates (primaire, fallback) pour un ticker. */
export function buildUrls(
  yahooTicker: string,
  statement: 'income' | 'cash-flow' | 'balance-sheet',
  period: SaPeriod = 'quarterly',
): string[] {
  // Vérifié verbatim sur les pages :
  //   income        → /financials/
  //   cash-flow     → /financials/cash-flow-statement/
  //   balance-sheet → /financials/balance-sheet/    (PAS "-statement" — sa-site est asymétrique)
  const path =
    statement === 'income'        ? 'financials' :
    statement === 'cash-flow'     ? 'financials/cash-flow-statement' :
    /* balance-sheet */            'financials/balance-sheet';
  return candidateBases(yahooTicker).map(b => `${b}/${path}/?p=${period}`);
}

export interface ParseResult {
  /** Dates de fin de période, du plus récent au plus ancien (ordre natif stockanalysis). */
  dates: string[];
  /** Cadence détectée à partir de l'écart médian entre 2 dates consécutives. */
  freq: 'quarterly' | 'semiannual' | 'annual';
  /** Champs primitifs extraits — clés telles que dans le payload. */
  fields: Record<string, (number | null)[]>;
}

/** Étend `{` à l'index `open` jusqu'à son accolade fermante de même niveau. */
function objectAt(html: string, open: number): string | null {
  let depth = 0;
  for (let j = open; j < html.length; j++) {
    const c = html[j];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return html.slice(open, j + 1);
    }
  }
  return null;
}

/**
 * Extrait l'objet JS (clés sans guillemets) qui porte les séries de la page.
 *
 * Deux formes coexistent sur le site, et la SEULE invariante est la présence de `datekey:[…]` :
 *   - `financialData:{…}` — pages cash-flow et balance-sheet ;
 *   - `financialData:void 0,…,data:{datekey:[…]}` — page income (compte de résultat), dont le
 *     payload a été déplacé sous une autre clé. L'ancienne implémentation ne cherchait que
 *     `financialData:{` : elle renvoyait null sur TOUTES les pages income, donc revenue /
 *     résultat opérationnel / résultat net n'étaient jamais accumulés (échec silencieux, le
 *     caller traitant `null` comme « source indisponible pour ce ticker »).
 *
 * On ancre donc sur `datekey:[` et on remonte à l'accolade ouvrante de l'objet qui le contient :
 * insensible au nom de la clé conteneur, donc au prochain déplacement.
 */
function extractBlob(html: string): string | null {
  const direct = html.indexOf('financialData:{');
  if (direct >= 0) {
    const blob = objectAt(html, direct + 'financialData:'.length);
    if (blob?.includes('datekey:[')) return blob;
  }
  const dk = html.indexOf('datekey:[');
  if (dk < 0) return null;
  // Remontée vers l'accolade ouvrante de l'objet contenant `datekey` : en scannant à l'envers,
  // chaque `}` rencontré ferme un objet frère (profondeur +1), chaque `{` en referme un — la
  // première accolade ouvrante à profondeur 0 est celle qu'on cherche.
  let depth = 0;
  for (let i = dk; i >= 0; i--) {
    const c = html[i];
    if (c === '}') depth++;
    else if (c === '{') {
      if (depth === 0) return objectAt(html, i);
      depth--;
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

/**
 * Détecte la cadence à partir de l'écart médian entre 2 dates successives (jours).
 * Insensible à l'ordre (écarts en valeur absolue) et aux dates non parsables (colonne « TTM »).
 * Exporté : la route timeseries s'en sert pour qualifier une série RELUE du store, dont la
 * colonne `freq` peut mentir sur les lignes écrites avant son introduction.
 */
export function detectCadence(dates: string[]): 'quarterly' | 'semiannual' | 'annual' {
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

export function parsePage(html: string, fieldsWanted: string[]): ParseResult | null {
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
  return { dates, freq: detectCadence(dates), fields };
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
// ⚠ Les clés du compte de résultat sont celles du payload ACTUEL, relevées sur les pages
// /financials/ de DG.PA et MSFT : `opinc`, `netinccmn`. Les anciennes (`netIncome`,
// `operatingIncome`, `sharesDiluted`) n'existent plus dans le payload — et le nombre d'actions
// n'y figure plus du tout, d'où son absence ici : il continue de venir de Yahoo
// (annualDilutedAverageShares). Le dériver de netinccmn/epsdil serait tentant, mais l'EPS est
// arrondi à 2 décimales → ~0,5 % d'erreur, soit une fausse dilution/relution sur le graphe.
const FIELDS_INCOME: Record<string, string> = {
  revenue: 'revenue',
  opinc: 'operatingIncome',
  netinccmn: 'netIncome',
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
  // Postes du bilan présents dans le payload mais longtemps non mappés (vérifié sur la page
  // quarterly de TCOM : `assets` et `liabilitiesc` remplis 20/20, en devise NATIVE). Ils
  // donnent le capital employé TRIMESTRIEL des ADR/EU — sans goodwill : la chaîne de repli du
  // Cash ROCE traite son absence comme 0 (CE plus grand → ROCE sous-estimé, direction
  // conservatrice).
  // ⚠ Le goodwill EST en réalité disponible sous `balance_sheet_goodwill` (relevé sur DG.PA et
  // MSFT) : le mapper corrigerait ce biais conservateur, mais DÉPLACERAIT le Cash ROCE de tous
  // les titres concernés — donc leur note. À faire à part, avec la mesure de l'écart.
  // AR/AP/inventory, eux, restent absents → le CCC hors de portée de cette source.
  assets: 'totalAssets',
  assetsc: 'currentAssets',
  liabilitiesc: 'currentLiabilities',
  equity: 'equity',
};

export interface StockanalysisBatch {
  freq: 'quarterly' | 'semiannual' | 'annual';
  /** Métriques disponibles → série {date, value}, ordre chronologique croissant. */
  series: Map<string, TimeseriesPoint[]>;
}

/** Fetch + parse les 3 statements TRIMESTRIELS (ou semestriels) pour un ticker Yahoo. */
export function getStockanalysisQuarterlyBatch(yahooTicker: string): Promise<StockanalysisBatch | null> {
  return getStockanalysisBatch(yahooTicker, 'quarterly');
}

/**
 * Fetch + parse les 3 statements ANNUELS. Profondeur ~5 exercices (le 10 ans est derrière le
 * compte Pro de stockanalysis), soit un exercice de plus que Yahoo pour les titres EU, et
 * surtout un historique qui S'APPROFONDIT tout seul : le store étant append-only, chaque
 * passage annuel ajoute l'exercice qui vient de tomber sans jamais perdre les précédents.
 */
export function getStockanalysisAnnualBatch(yahooTicker: string): Promise<StockanalysisBatch | null> {
  return getStockanalysisBatch(yahooTicker, 'annual');
}

/** Fetch + parse les 3 statements pour un ticker Yahoo. Renvoie null si tout échoue. */
async function getStockanalysisBatch(yahooTicker: string, period: SaPeriod): Promise<StockanalysisBatch | null> {
  const pages = await Promise.all([
    fetchWithRetry(buildUrls(yahooTicker, 'income', period)),
    fetchWithRetry(buildUrls(yahooTicker, 'cash-flow', period)),
    fetchWithRetry(buildUrls(yahooTicker, 'balance-sheet', period)),
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
  addSeries(series, parsedIncome,   FIELDS_INCOME);
  addSeries(series, parsedCashflow, FIELDS_CASHFLOW);
  addSeries(series, parsedBalance,  FIELDS_BALANCE);
  deriveFcf(series);

  return { freq, series };
}

/**
 * Reconstitue `fcf` = cfo + capex quand la page ne le publie pas.
 *
 * La ligne `fcf` manque sur certaines pages intra-annuelles (vérifié : DG.PA trimestriel l'omet
 * alors que sa page annuelle l'a) — or c'est EXACTEMENT la définition utilisée partout ailleurs
 * ici, et `capex` est déjà signé négativement par la source. Recoupé sur l'exercice 2025 de
 * Vinci : 11 886 − 3 873 = 8 013, à l'euro près la valeur publiée. Sans cette dérivation, le
 * titre perdait 10 ans de FCF semestriel que ses deux autres lignes couvrent pourtant.
 * Exporté pour tests.
 */
export function deriveFcf(series: Map<string, TimeseriesPoint[]>): void {
  if (series.has('fcf')) return;
  const cfo = series.get('cfo');
  const capex = series.get('capex');
  if (!cfo?.length || !capex?.length) return;
  const capexByDate = new Map(capex.map(p => [p.date, p.value]));
  const pts = cfo
    .filter(p => capexByDate.has(p.date))
    .map(p => ({ date: p.date, value: p.value + capexByDate.get(p.date)! }));
  if (pts.length) series.set('fcf', pts);
}

// ─── Historique du nombre d'employés ─────────────────────────────────────────
//
// stockanalysis expose une page /employees/ distincte des financials, avec l'historique
// ANNUEL de l'effectif (dates = fins d'exercice fiscal, 9-32 exercices selon le titre,
// couverture vérifiée sur 26 bourses dont micro-caps le 12/08/2026). On la lit via son
// endpoint SvelteKit `__data.json` : payload JSON encodé « devalue » (chaque objet référence
// ses valeurs par INDEX dans le tableau `data` du nœud), bien plus stable que le HTML.
//
// ⚠ La donnée est rattachée à la cotation PRIMAIRE : la page 404 sur une cotation
// secondaire (SHOP.TO → NYSE, Sixt FRA → Xetra). candidateBases couvre déjà ce cas
// (slug exchange puis fallback /stocks/).

/**
 * Décodage minimal du format « devalue » de SvelteKit : la valeur à l'index `idx` est un
 * scalaire, ou un objet/tableau dont chaque champ est un INDEX vers une autre entrée de
 * `data`. Les index négatifs sont des trous (undefined). Profondeur bornée : le payload
 * employees est plat (liste d'objets de scalaires), tout cycle serait un payload corrompu.
 */
function decodeDevalue(data: unknown[], idx: number, depth = 0): unknown {
  if (depth > 8 || !Number.isInteger(idx) || idx < 0 || idx >= data.length) return undefined;
  const v = data[idx];
  if (Array.isArray(v)) {
    return v.map(i => (typeof i === 'number' ? decodeDevalue(data, i, depth + 1) : undefined));
  }
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, i] of Object.entries(v as Record<string, unknown>)) {
      if (typeof i === 'number') out[k] = decodeDevalue(data, i, depth + 1);
    }
    return out;
  }
  return v;
}

/**
 * Parse le payload __data.json de la page /employees/ → série {date, value} ASC.
 * On préfère `historical_annual` (les fins d'exercice) à `historical` qui, sur les émetteurs
 * publiant l'effectif en trimestriel (HK, Suède), peut pointer la vue trimestrielle.
 * Exporté pour tests.
 */
export function parseEmployeesPayload(text: string): TimeseriesPoint[] | null {
  let doc: { nodes?: unknown[] };
  try { doc = JSON.parse(text) as { nodes?: unknown[] }; } catch { return null; }
  const nodes = Array.isArray(doc?.nodes) ? doc.nodes : [];
  for (const node of nodes) {
    const data = (node as { data?: unknown[] } | null)?.data;
    if (!Array.isArray(data) || data.length === 0) continue;
    const root = data[0];
    if (root === null || typeof root !== 'object' || Array.isArray(root)) continue;
    const r = root as Record<string, unknown>;
    const histIdx = typeof r.historical_annual === 'number' ? r.historical_annual
      : typeof r.historical === 'number' ? r.historical : null;
    if (histIdx == null) continue;
    const hist = decodeDevalue(data, histIdx);
    if (!Array.isArray(hist)) continue;
    const pts: TimeseriesPoint[] = [];
    for (const h of hist) {
      const row = h as { date?: unknown; count?: unknown } | undefined;
      const date = row?.date;
      const count = row?.count;
      if (typeof date !== 'string' || !ISO_DATE.test(date)) continue;
      if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) continue;
      pts.push({ date, value: count });
    }
    if (pts.length > 0) {
      pts.sort((a, b) => a.date.localeCompare(b.date));
      return pts;
    }
  }
  return null;
}

/**
 * Fetch l'historique annuel du nombre d'employés d'un ticker. Null si la page n'existe pas
 * (cotation secondaire sans fallback valide, ou titre non couvert) ou si le payload a changé.
 * Passe par le même throttle/retry que les pages financials.
 */
export async function getStockanalysisEmployees(yahooTicker: string): Promise<TimeseriesPoint[] | null> {
  const urls = candidateBases(yahooTicker).map(b => `${b}/employees/__data.json`);
  const text = await fetchWithRetry(urls);
  if (!text) return null;
  return parseEmployeesPayload(text);
}

/**
 * Nom de la société porté par un payload __data.json (nœud `info` : nameFull, sinon name).
 * Indispensable avant d'ingérer une page /stocks/ atteinte par HEURISTIQUE de symbole :
 * le même code de ticker désigne des sociétés différentes selon la place (cas réel :
 * /stocks/mc = Moelis & Company, pas LVMH dont le symbole Paris est MC). Exporté pour tests.
 */
export function parseSaCompanyName(text: string): string | null {
  let doc: { nodes?: unknown[] };
  try { doc = JSON.parse(text) as { nodes?: unknown[] }; } catch { return null; }
  const nodes = Array.isArray(doc?.nodes) ? doc.nodes : [];
  for (const node of nodes) {
    const data = (node as { data?: unknown[] } | null)?.data;
    if (!Array.isArray(data) || data.length === 0) continue;
    const root = data[0];
    if (root === null || typeof root !== 'object' || Array.isArray(root)) continue;
    const infoIdx = (root as Record<string, unknown>).info;
    if (typeof infoIdx !== 'number') continue;
    const info = decodeDevalue(data, infoIdx);
    if (info === null || typeof info !== 'object' || Array.isArray(info)) continue;
    const i = info as Record<string, unknown>;
    const name = i.nameFull ?? i.name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return null;
}

/**
 * Historique d'employés via une cotation US /stocks/{symbole} EXPLICITE, avec le nom de la
 * société pour vérification par le caller. Contrairement aux pages exchange (quote/…) et OTC,
 * les pages /stocks/ servent l'historique INTÉGRAL gratuitement (ASML 25 exercices, SAP/NVO
 * 28 — sondage du 12/08/2026) : le paywall de la source suit le type de page, pas la
 * nationalité de la société.
 */
export async function getStockanalysisEmployeesUs(
  usSymbol: string,
): Promise<{ points: TimeseriesPoint[]; name: string | null } | null> {
  const text = await fetchWithRetry([`${BASE}/stocks/${usSymbol.toLowerCase()}/employees/__data.json`]);
  if (!text) return null;
  const points = parseEmployeesPayload(text);
  if (!points || points.length === 0) return null;
  return { points, name: parseSaCompanyName(text) };
}

// ─── Historique PROFOND du chiffre d'affaires annuel ─────────────────────────
//
// Comme /employees/, stockanalysis expose une page /revenue/ dédiée dont le __data.json
// contient BEAUCOUP plus d'exercices annuels que les pages financials (plafonnées à ~5 en
// gratuit) : 21 exercices (2005→2025) relevés sur SPGI/AAPL/Hermès, 22 sur Toyota, 10-14 sur
// HK/Vietnam/micro-caps (sondage du 12/08/2026). C'est le plafond du gratuit : au-delà de
// 2005, il n'existe AUCUNE source structurée non payante (XBRL démarre en 2009, EDGAR
// électronique en 1993).
//
// ⚠ Devise : pour un émetteur étranger coté US (ADR), cette page publie des montants
// CONVERTIS EN USD, quand notre store annuel est en devise de REPORTING. Le caller
// (employeesStore.extendWithDeepRevenue) recoupe donc les exercices communs avant d'étendre
// une série avec ces points — jamais de fusion aveugle.

/**
 * Parse le payload __data.json de la page /revenue/ → série annuelle {date, value} ASC.
 * Structure : un nœud dont data[0] porte `data` → { annual: [{date, revenue, …}], … }.
 * Exporté pour tests.
 */
export function parseRevenuePayload(text: string): TimeseriesPoint[] | null {
  let doc: { nodes?: unknown[] };
  try { doc = JSON.parse(text) as { nodes?: unknown[] }; } catch { return null; }
  const nodes = Array.isArray(doc?.nodes) ? doc.nodes : [];
  for (const node of nodes) {
    const data = (node as { data?: unknown[] } | null)?.data;
    if (!Array.isArray(data) || data.length === 0) continue;
    const root = data[0];
    if (root === null || typeof root !== 'object' || Array.isArray(root)) continue;
    const dataIdx = (root as Record<string, unknown>).data;
    if (typeof dataIdx !== 'number') continue;
    const payload = decodeDevalue(data, dataIdx);
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) continue;
    const annual = (payload as Record<string, unknown>).annual;
    if (!Array.isArray(annual)) continue;
    const pts: TimeseriesPoint[] = [];
    for (const row of annual) {
      const r = row as { date?: unknown; revenue?: unknown } | undefined;
      const date = r?.date;
      const revenue = r?.revenue;
      if (typeof date !== 'string' || !ISO_DATE.test(date)) continue;
      if (typeof revenue !== 'number' || !Number.isFinite(revenue) || revenue <= 0) continue;
      pts.push({ date, value: revenue });
    }
    if (pts.length > 0) {
      pts.sort((a, b) => a.date.localeCompare(b.date));
      return pts;
    }
  }
  return null;
}

/** Fetch l'historique annuel profond du CA. Mêmes conventions que getStockanalysisEmployees. */
export async function getStockanalysisRevenueHistory(yahooTicker: string): Promise<TimeseriesPoint[] | null> {
  const urls = candidateBases(yahooTicker).map(b => `${b}/revenue/__data.json`);
  const text = await fetchWithRetry(urls);
  if (!text) return null;
  return parseRevenuePayload(text);
}

/**
 * Verse les champs d'une page parsée dans `out` sous les clés métriques internes.
 * Exporté (avec parsePage) pour que les tests couvrent les DEUX formes de payload du site.
 */
export function addSeries(
  out: Map<string, TimeseriesPoint[]>,
  parsed: ParseResult | null,
  mapping: Record<string, string>,
): void {
  if (!parsed) return;
  const dates = parsed.dates;
  for (const [src, dst] of Object.entries(mapping)) {
    const vals = parsed.fields[src];
    if (!vals) continue;
    const pts: TimeseriesPoint[] = [];
    for (let i = 0; i < dates.length; i++) {
      // Les pages ANNUELLES ouvrent sur une colonne « TTM » (datekey:["TTM","2025-12-31",…]).
      // Non filtrée, elle entrait en base comme un point de date "TTM" — qui trie après toute
      // date ISO, devient donc `lastEnd` et fait croire à une période plus récente qu'elle.
      if (!ISO_DATE.test(dates[i]!)) continue;
      const v = vals[i];
      if (typeof v === 'number' && Number.isFinite(v)) pts.push({ date: dates[i]!, value: v });
    }
    pts.sort((a, b) => a.date.localeCompare(b.date));
    if (pts.length) out.set(dst, pts);
  }
}
