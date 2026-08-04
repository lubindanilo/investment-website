/**
 * SEC EDGAR — source AUTORITATIVE des fondamentaux US (data.sec.gov, gratuit, sans clé).
 *
 * Rôle : COMBLE-TROUS. Finnhub /financials-reported a des trimestres manquants (dérivation Q4
 * ratée quand le Q3 YTD manque, tags XBRL variables…) — même pour NVDA (~9 trous). EDGAR a
 * l'historique complet (les sociétés y déposent leurs 10-Q/10-K). On l'utilise pour récupérer
 * UNIQUEMENT les trimestres que Finnhub n'a pas, et on fusionne (cf. getReportedTimeseries).
 *
 * On ne touche à aucune formule : on rend une série {date, value} trimestrielle homogène à
 * celle de Finnhub (mêmes unités absolues, flux dé-cumulés).
 *
 * US uniquement (EDGAR ne couvre que les émetteurs SEC). Non-US → renvoie [] (le caller garde Finnhub/Yahoo).
 */
import type { TimeseriesPoint } from '@lubin/shared';
import { METRICS, type MetricKey } from './finnhubFundamentals.js';

const UA = 'lubin-investment (admin@hyperstack.studio)'; // SEC exige un User-Agent identifiable
const CONCEPT_BASE = 'https://data.sec.gov/api/xbrl/companyconcept';
const TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';

// ─── Résolution ticker → CIK (mappe SEC, mis en cache à vie process) ─────────
let cikMap: Map<string, string> | null = null;
let cikMapPromise: Promise<Map<string, string>> | null = null;

async function loadCikMap(): Promise<Map<string, string>> {
  if (cikMap) return cikMap;
  if (!cikMapPromise) {
    cikMapPromise = (async () => {
      const res = await fetch(TICKERS_URL, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`SEC tickers HTTP ${res.status}`);
      const data = await res.json() as Record<string, { cik_str: number; ticker: string }>;
      const m = new Map<string, string>();
      for (const v of Object.values(data)) {
        if (v?.ticker && typeof v.cik_str === 'number') m.set(v.ticker.toUpperCase(), String(v.cik_str).padStart(10, '0'));
      }
      cikMap = m;
      return m;
    })().catch(err => { cikMapPromise = null; throw err; });
  }
  return cikMapPromise;
}

async function getCik(ticker: string): Promise<string | null> {
  if (ticker.includes('.')) return null; // non-US → pas EDGAR
  try {
    const m = await loadCikMap();
    return m.get(ticker.toUpperCase()) ?? null;
  } catch { return null; }
}

// ─── Fetch d'un concept XBRL (cache process) ─────────────────────────────────
interface ConceptEntry { start?: string; end: string; val: number; fy?: number; fp?: string; form?: string }
const unitsCache = new Map<string, Record<string, ConceptEntry[]> | null>();

/**
 * Vrai si le tableau `USD` d'un concept XBRL n'est qu'une **conversion de convenance** :
 * l'émetteur reporte dans une autre devise (déposant 20-F étranger — TCOM en CNY, FUTU en
 * HKD, TM en JPY…) et joint une colonne USD indicative dans son 20-F.
 *
 * Pourquoi c'est bloquant : EDGAR ne sert ICI qu'à COMBLER les trous d'une série dont le
 * reste (Finnhub, stockanalysis, Yahoo) est libellé en devise de REPORTING. Injecter la
 * colonne USD mélange donc deux devises dans la MÊME série du store, et tout ratio qui
 * croise un poste de bilan avec un flux devient faux du taux de change.
 * Cas constaté en prod (TCOM) : bilan en USD via EDGAR (totalAssets, currentLiabilities,
 * goodwill, equity…) et flux en CNY via stockanalysis (cfo, capex, sbc, revenue) → le
 * graphe Cash ROCE traçait FCF(CNY)/CapitalEmployed(USD), soit ~7× trop haut, sous une
 * ligne de seuil à 15 %. Idem pour le CCC (AR/AP en USD, CA en CNY).
 *
 * Signal retenu : présence d'une clé d'unité MONÉTAIRE ≠ USD. Mesuré sur 29 déposants
 * (AAPL, MSFT, AMZN, WMT, KR, TGT, CVS, DAL, LUV, F, GM, INTC, NVDA, BKNG, MEDP, JPM,
 * XOM, PG, KO, MCD, NKE, ADBE, CRM, TPL + les étrangers qui reportent en USD : SHOP,
 * MELI, MNDY, FVRR, GLBE) → `units` ne contient que `USD` dans TOUS les cas, donc zéro
 * faux positif. À l'inverse les déposants en devise étrangère ont toujours leur devise
 * native en plus, et mieux fournie (TCOM CNY:36 vs USD:18, FUTU HKD:17 vs USD:7,
 * TM JPY:32 vs USD:4). Ceux qui ne publient QUE leur devise native (ASML → EUR seul)
 * étaient déjà écartés : `units.USD` est alors absent.
 *
 * Conséquence voulue : pour ces émetteurs, EDGAR ne comble plus rien et les services de
 * graphe basculent sur leur repli annuel Yahoo, homogène en devise de reporting.
 */
export function foreignReportingCurrency(units: Record<string, unknown>): string | null {
  // Les clés d'unité XBRL sont soit un code ISO 4217 ('USD', 'CNY'), soit 'shares',
  // 'pure', 'USD/shares'… Seules les monnaies pures nous intéressent.
  return Object.keys(units).find(k => k !== 'USD' && /^[A-Z]{3}$/.test(k)) ?? null;
}

/** Toutes les unités d'un concept, mémoïsées (un seul download par concept et par process). */
async function fetchConceptUnits(cik: string, taxonomy: string, concept: string): Promise<Record<string, ConceptEntry[]> | null> {
  const key = `${cik}|${taxonomy}|${concept}`;
  if (unitsCache.has(key)) return unitsCache.get(key)!;
  try {
    const url = `${CONCEPT_BASE}/CIK${cik}/${taxonomy}/${encodeURIComponent(concept)}.json`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) { unitsCache.set(key, null); return null; }
    const data = await res.json() as { units?: Record<string, ConceptEntry[]> };
    const units = data.units ?? {};
    unitsCache.set(key, units);
    return units;
  } catch { unitsCache.set(key, null); return null; }
}

async function fetchConcept(cik: string, taxonomy: string, concept: string, unit: 'USD' | 'shares'): Promise<ConceptEntry[] | null> {
  const units = await fetchConceptUnits(cik, taxonomy, concept);
  if (!units) return null;
  if (unit === 'USD') {
    const native = foreignReportingCurrency(units);
    if (native) {
      console.log(`[edgar CIK${cik}/${concept}] devise de reporting ${native} ≠ USD → EDGAR ignoré (la colonne USD n'est qu'une conversion de convenance, cf foreignReportingCurrency)`);
      return null;
    }
  }
  return units[unit] ?? null;
}

/**
 * Devise de reporting d'un déposant SEC, ou null s'il reporte en USD (ou est introuvable).
 *
 * Sert aux ratios de VALORISATION, qui croisent un prix en devise de cotation avec un
 * fondamental en devise de reporting (cf le module `fx`). On la lit chez EDGAR et non chez
 * Yahoo pour deux raisons :
 *   - `getCik` écarte gratuitement tout ticker suffixé, donc les ~25 000 titres non-US du
 *     screener ne coûtent AUCUNE requête : seuls les tickers cotés aux États-Unis sont sondés,
 *     et c'est exactement le périmètre concerné (les ADR) ;
 *   - data.sec.gov n'est pas la ressource fragile ici. Le limiter Yahoo plafonne à 30 req/min
 *     et son throttle a déjà provoqué une panne (PR #147) : une requête Yahoo de plus par
 *     titre aurait amputé le débit du drain nocturne.
 *
 * Le concept sonde est `Assets` : tout déposant qui publie un bilan l'expose. Mémoïsé par le
 * cache de `fetchConceptUnits`, donc un seul download par process et par émetteur.
 */
export async function getSecReportingCurrency(ticker: string): Promise<string | null> {
  const cik = await getCik(ticker);
  if (!cik) return null;
  const units = await fetchConceptUnits(cik, 'us-gaap', 'Assets');
  if (!units) return null;
  return foreignReportingCurrency(units);
}

const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400000;

/** Dé-cumule une métrique de FLUX (revenue, cfo, capex, sbc, NI, opIncome) en trimestres. */
function decumulateFlow(entries: ConceptEntry[]): TimeseriesPoint[] {
  // Les points YTD d'un même exercice partagent le MÊME `start` (début d'exercice).
  // On groupe par start, on dédoublonne par end (restatements), on dé-cumule par ordre de fin.
  const valid = entries.filter(e => e.start && e.end && Number.isFinite(e.val) && (e.form === '10-Q' || e.form === '10-K'));
  const byStart = new Map<string, Map<string, number>>(); // start → (end → val), dédup end
  // Périodes DIRECTEMENT trimestrielles (~3 mois) : certains émetteurs publient à la fois le
  // cumulé YTD (start = début d'exercice) ET le trimestre isolé (start = début de trimestre)
  // pour un même `end`. Sans dédup, on émettait alors 2 points à la même date (doublon observé
  // sur SHOP : 2024-06-30 ×2). On mémorise la valeur trimestrielle directe → elle prime.
  const directQuarter = new Map<string, number>();       // end → val (période ~90j)
  for (const e of valid) {
    const dur = daysBetween(e.start!, e.end);
    if (dur < 60 || dur > 400) continue;               // garde Q1(~90)/H1(~180)/9M(~270)/FY(~365)
    if (dur <= 100 && !directQuarter.has(e.end)) directQuarter.set(e.end, e.val);
    if (!byStart.has(e.start!)) byStart.set(e.start!, new Map());
    byStart.get(e.start!)!.set(e.end, e.val);          // dernier gagne (restatement)
  }
  // Dé-cumul par chaîne YTD, PUIS dédup par `end` : une même fin de trimestre ne produit qu'UN
  // point. La période trimestrielle directe (si elle existe) prime sur la valeur dé-cumulée
  // (plus fiable — pas d'erreur de dé-cumul quand un maillon YTD intermédiaire manque).
  const byEnd = new Map<string, number>();
  for (const ends of byStart.values()) {
    const chain = [...ends.entries()].sort((a, b) => a[0].localeCompare(b[0])); // par end croissant
    let prev = 0;
    for (const [end, val] of chain) {
      const q = val - prev;
      prev = val;
      byEnd.set(end, directQuarter.get(end) ?? q);
    }
  }
  // Trimestres directs jamais rencontrés dans une chaîne YTD (sécurité).
  for (const [end, val] of directQuarter) if (!byEnd.has(end)) byEnd.set(end, val);
  return [...byEnd.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Métrique de STOCK / non-cumulative : shares (moyenne 3 mois) ou bilan (instantané). */
function pointInTime(entries: ConceptEntry[], isShares: boolean): TimeseriesPoint[] {
  const out: TimeseriesPoint[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    if (!Number.isFinite(e.val) || !e.end) continue;
    if (isShares) {
      // shares = moyenne pondérée → on prend les périodes ~3 mois (valeur trimestrielle).
      if (!e.start) continue;
      const dur = daysBetween(e.start, e.end);
      if (dur < 60 || dur > 100) continue;
    }
    if (seen.has(e.end)) continue; seen.add(e.end);
    // Échelle des shares : on stocke la valeur BRUTE. La normalisation d'échelle (÷1000/×1e6
    // intermittents des filings XBRL) est faite À LA LECTURE via normalizeShareScale, de façon
    // cohérente pour toutes les sources — pas de rescale ×1e6 ad hoc ici (il faussait la médiane).
    out.push({ date: e.end, value: e.val });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Série trimestrielle EDGAR pour une métrique (homogène à getReportedTimeseries Finnhub).
 * Renvoie [] si non-US, concept introuvable, ou erreur. Best-effort.
 */
export async function getEdgarQuarterlySeries(ticker: string, metric: MetricKey): Promise<TimeseriesPoint[]> {
  // FCF = CFO − CapEx, reconstruit depuis EDGAR (même définition que le calcul aval Finnhub).
  if (metric === 'fcf') {
    const [cfo, capex] = await Promise.all([
      getEdgarQuarterlySeries(ticker, 'cfo'),
      getEdgarQuarterlySeries(ticker, 'capex'),
    ]);
    if (cfo.length === 0) return [];
    const capexByDate = new Map(capex.map(p => [p.date, Math.abs(p.value)]));
    return cfo.map(c => ({ date: c.date, value: c.value - (capexByDate.get(c.date) ?? 0) }));
  }

  // Operating income : tag direct prioritaire (us-gaap_OperatingIncomeLoss). Fallback
  // GP − SG&A pour les déposants qui ne publient pas ce tag (NKE & sociétés produit
  // dont l'income statement va GP → SG&A → IncomeBeforeIncomeTax sans agrégation).
  // Identique à __computed_operatingIncome__ côté Finnhub (extractValue) : on garde
  // les deux pipelines alignés pour que la fusion append-only reste cohérente.
  if (metric === 'operatingIncome') {
    const cik = await getCik(ticker);
    if (!cik) return [];
    const direct = await fetchConcept(cik, 'us-gaap', 'OperatingIncomeLoss', 'USD');
    if (direct && direct.length > 0) return decumulateFlow(direct);
    const [gpRaw, sgaRaw] = await Promise.all([
      fetchConcept(cik, 'us-gaap', 'GrossProfit', 'USD'),
      fetchConcept(cik, 'us-gaap', 'SellingGeneralAndAdministrativeExpense', 'USD'),
    ]);
    if (!gpRaw?.length || !sgaRaw?.length) return [];
    const gp = decumulateFlow(gpRaw);
    const sga = decumulateFlow(sgaRaw);
    const sgaByDate = new Map(sga.map(p => [p.date, p.value]));
    return gp
      .filter(p => sgaByDate.has(p.date))
      .map(p => ({ date: p.date, value: p.value - sgaByDate.get(p.date)! }));
  }
  const cfg = METRICS[metric];
  if (!cfg) return [];
  const concepts = cfg.concepts.filter(c => !c.startsWith('__')); // skip les métriques computed (totalDebt, cash)
  if (concepts.length === 0) return [];
  const cik = await getCik(ticker);
  if (!cik) return [];

  const isShares = metric === 'shares';
  const unit: 'USD' | 'shares' = isShares ? 'shares' : 'USD';

  // On UNIT tous les concepts candidats (une société change de tag XBRL dans le temps —
  // ex NVDA capex : PaymentsToAcquirePropertyPlantAndEquipment puis PaymentsToAcquireProductiveAssets).
  // Prendre le 1er non vide laisserait des trous. On concatène et on dé-cumule l'union.
  const all: ConceptEntry[] = [];
  for (const raw of concepts) {
    const [taxonomy, ...rest] = raw.split('_');         // 'us-gaap_Revenues' → ['us-gaap','Revenues']
    const concept = rest.join('_');
    if (!taxonomy || !concept) continue;
    const entries = await fetchConcept(cik, taxonomy, concept, unit);
    if (entries && entries.length) all.push(...entries);
  }
  if (all.length === 0) return [];
  return cfg.cumulative ? decumulateFlow(all) : pointInTime(all, isShares);
}
