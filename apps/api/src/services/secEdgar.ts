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
const conceptCache = new Map<string, ConceptEntry[] | null>();

async function fetchConcept(cik: string, taxonomy: string, concept: string, unit: 'USD' | 'shares'): Promise<ConceptEntry[] | null> {
  const key = `${cik}|${taxonomy}|${concept}`;
  if (conceptCache.has(key)) return conceptCache.get(key)!;
  try {
    const url = `${CONCEPT_BASE}/CIK${cik}/${taxonomy}/${encodeURIComponent(concept)}.json`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) { conceptCache.set(key, null); return null; }
    const data = await res.json() as { units?: Record<string, ConceptEntry[]> };
    const arr = data.units?.[unit] ?? null;
    conceptCache.set(key, arr);
    return arr;
  } catch { conceptCache.set(key, null); return null; }
}

const daysBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400000;

/** Dé-cumule une métrique de FLUX (revenue, cfo, capex, sbc, NI, opIncome) en trimestres. */
function decumulateFlow(entries: ConceptEntry[]): TimeseriesPoint[] {
  // Les points YTD d'un même exercice partagent le MÊME `start` (début d'exercice).
  // On groupe par start, on dédoublonne par end (restatements), on dé-cumule par ordre de fin.
  const valid = entries.filter(e => e.start && e.end && Number.isFinite(e.val) && (e.form === '10-Q' || e.form === '10-K'));
  const byStart = new Map<string, Map<string, number>>(); // start → (end → val), dédup end
  for (const e of valid) {
    const dur = daysBetween(e.start!, e.end);
    if (dur < 60 || dur > 400) continue;               // garde Q1(~90)/H1(~180)/9M(~270)/FY(~365)
    if (!byStart.has(e.start!)) byStart.set(e.start!, new Map());
    byStart.get(e.start!)!.set(e.end, e.val);          // dernier gagne (restatement)
  }
  const out: TimeseriesPoint[] = [];
  for (const ends of byStart.values()) {
    const chain = [...ends.entries()].sort((a, b) => a[0].localeCompare(b[0])); // par end croissant
    let prev = 0;
    for (const [end, val] of chain) { out.push({ date: end, value: val - prev }); prev = val; }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
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
    // NORMALISATION D'ÉCHELLE shares : certains émetteurs (MCD) publient leurs shares en
    // MILLIONS sans renseigner `decimals` dans le XBRL — val=713.5 = 713,5M actions. Notre
    // pipeline (et Finnhub) attend des unités directes (10^8 à 10^11). Si val < 10^7 mais
    // que la société est manifestement cotée (val > 0), on multiplie par 10^6 pour rattraper.
    // Aucune vraie société cotée n'a < 10M d'actions en circulation.
    let value = e.val;
    if (isShares && value > 0 && value < 1e7) value *= 1e6;
    out.push({ date: e.end, value });
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
