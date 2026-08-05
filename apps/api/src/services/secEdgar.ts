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
import { METRICS, computeCashAndEquivalents, type MetricKey } from './finnhubFundamentals.js';

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

// ─── Séries ANNUELLES en devise NATIVE (déposants 20-F étrangers) ─────────────
//
// Pour un déposant en devise étrangère, `fetchConcept` refuse la colonne USD (conversion de
// convenance) → EDGAR ne fournit plus RIEN à ces émetteurs côté trimestriel. Mais leur colonne
// NATIVE, elle, est la plus profonde qui existe : chaque 20-F re-publie les exercices
// comparatifs, soit 14-18 exercices là où Yahoo plafonne à ~4 (mesuré sur TCOM : CFO 14,
// CapEx 18, Assets/CurLiab/Goodwill 17, NI 18). C'est ce qui permet aux graphes annuels des
// ADR d'avoir un vrai historique — sans mélange de devises, puisque Yahoo
// /fundamentals-timeseries est lui aussi en devise de reporting.

/** Formulaires ANNUELS acceptés. Écarte les 6-K (snapshots intérimaires à dates non-FY). */
const EDGAR_ANNUAL_FORMS = new Set(['20-F', '20-F/A', '40-F', '40-F/A', '10-K', '10-K/A']);

/**
 * Points annuels d'un concept de FLUX (ou moyenne pondérée type shares) : une entrée par
 * exercice plein (durée 330-400 j — tolère les exercices 52/53 semaines et décalés).
 * Dédup par date de fin, DERNIER gagne : les 20-F suivants re-publient les exercices
 * comparatifs, éventuellement restatés — on garde la version la plus récente.
 * Exporté pour tests.
 */
export function annualDurationPoints(entries: ConceptEntry[]): TimeseriesPoint[] {
  const byEnd = new Map<string, number>();
  for (const e of entries) {
    if (!e.start || !e.end || !Number.isFinite(e.val)) continue;
    if (!EDGAR_ANNUAL_FORMS.has(e.form ?? '')) continue;
    const dur = daysBetween(e.start, e.end);
    if (dur < 330 || dur > 400) continue;
    byEnd.set(e.end, e.val);
  }
  return [...byEnd.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Points annuels d'un concept de BILAN (instantané, pas de `start`). Le filtre de formulaire
 * fait le tri des dates : un 20-F ne publie que des fins d'exercice. Exporté pour tests.
 */
export function annualInstantPoints(entries: ConceptEntry[]): TimeseriesPoint[] {
  const byEnd = new Map<string, number>();
  for (const e of entries) {
    if (e.start || !e.end || !Number.isFinite(e.val)) continue;
    if (!EDGAR_ANNUAL_FORMS.has(e.form ?? '')) continue;
    byEnd.set(e.end, e.val);
  }
  return [...byEnd.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Types annuels du store (clés Yahoo) qui mappent DIRECTEMENT un MetricKey. Les types composés
 * de plusieurs concepts XBRL (FCF, dette totale, trésorerie) sont traités à part, cf.
 * COMPOSED_ANNUAL_TYPES.
 */
const ANNUAL_TYPE_TO_METRIC: Record<string, MetricKey> = {
  annualTotalRevenue: 'revenue',
  annualNetIncome: 'netIncome',
  annualOperatingIncome: 'operatingIncome',
  annualOperatingCashFlow: 'cfo',
  annualCapitalExpenditure: 'capex',
  annualTotalAssets: 'totalAssets',
  annualCurrentLiabilities: 'currentLiabilities',
  annualCurrentAssets: 'currentAssets',
  annualGoodwill: 'goodwill',
  annualStockholdersEquity: 'equity',
  annualDilutedAverageShares: 'shares',
  // Postes du CCC (DSO/DIO/DPO) : bilan (instant) sauf COGS (flux cumulatif).
  annualCostOfRevenue: 'costOfRevenue',
  annualAccountsReceivable: 'accountsReceivable',
  annualInventory: 'inventory',
  annualAccountsPayable: 'accountsPayable',
};
/**
 * Composantes XBRL des types annuels COMPOSÉS (dette totale, trésorerie). Miroir exact des
 * listes de `extractValue` (__computed_totalDebt__ / __computed_cash__) côté Finnhub : les deux
 * pipelines doivent produire la MÊME définition, sinon la fusion append-only du store mélange
 * deux conventions de dette dans la même série.
 *
 * Dans chaque rôle, les concepts sont essayés dans l'ordre et le PREMIER renseigné gagne, par
 * date (une société change de tag XBRL au fil des années).
 */
// `annualTotalDebt` reste VOLONTAIREMENT hors périmètre. Mesuré en composant les mêmes concepts
// que Finnhub sur 4 ADR : le total EDGAR ne vaut que 5 à 77 % de celui de Yahoo, et le rapport
// varie d'un exercice à l'autre (TCOM 0,24-0,51 ; BABA 0,07-0,17 ; NTES 0,05-0,16 ; JD 0,39-0,77).
// Ce n'est donc pas un écart de convention rattrapable par calibration : la dette de ces
// émetteurs vit sous des tags que la définition actuelle n'interroge pas (TCOM expose
// `DebtCurrent` sur 26 exercices, plus des convertibles). L'injecter donnerait des exercices
// profonds sous-endettés de façon erratique, donc un netDebtFcf faussement rassurant.
// La reprendre suppose de redéfinir la dette des déposants étrangers ET de garder le miroir
// avec le chemin trimestriel Finnhub, sans double compter : c'est un chantier à part entière.

const CASH_PARTS = {
  cash: ['us-gaap_CashAndCashEquivalentsAtCarryingValue', 'us-gaap_CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 'us-gaap_Cash'],
  shortTermInvestments: ['us-gaap_ShortTermInvestments', 'us-gaap_MarketableSecuritiesCurrent', 'us-gaap_AvailableForSaleSecuritiesCurrent'],
} as const;

// ─── Déposants IFRS (taxonomie ifrs-full) ─────────────────────────────────────
//
// Le reste de ce module suppose la taxonomie us-gaap. Or 478 des 5 587 titres cotés aux US
// déposent en `ifrs-full` (TSM, NVS, AZN, SHEL, HSBC, RY, EQNR…) : `us-gaap/Assets` leur est
// absent, donc jusqu'ici ni devise de reporting ni profondeur annuelle. C'est plus du double
// des 221 déposants us-gaap en devise étrangère, et ces émetteurs n'ont AUCUNE autre source
// profonde — Yahoo les plafonne aux mêmes ~4 exercices.
//
// Couverture mesurée sur 6 gros déposants (nombre d'entrées par concept) : revenue, netIncome,
// cfo, totalAssets, currentAssets, currentLiabilities, equity, inventory, cash et costOfRevenue
// sont présents quasi partout ; goodwill et capex manquent chez certains ; les banques (RY)
// n'ont pas de bilan classé, ce qui est déjà géré par le repli secteur financier du Cash ROCE.
//
// `shares` est VOLONTAIREMENT absent : aucun de ces déposants n'expose de nombre d'actions
// dilué moyen exploitable (seul `AdjustedWeightedAverageShares` traîne, de sémantique incertaine)
// et c'est la métrique où une erreur d'unité coûte le plus cher — un ADS TSM vaut 5 actions
// ordinaires, exactement le piège traité par la calibration ADS. Les shares restent donc celles
// de Yahoo, et la profondeur IFRS bénéficie au Cash ROCE et au CCC, pas au P/FCF.
const IFRS_ANNUAL_CONCEPTS: Partial<Record<MetricKey, { concepts: string[]; cumulative: boolean }>> = {
  revenue:            { concepts: ['ifrs-full_RevenueFromSaleOfGoods', 'ifrs-full_RevenueFromContractsWithCustomers', 'ifrs-full_Revenue'], cumulative: true },
  netIncome:          { concepts: ['ifrs-full_ProfitLoss', 'ifrs-full_ProfitLossAttributableToOwnersOfParent'], cumulative: true },
  operatingIncome:    { concepts: ['ifrs-full_ProfitLossFromOperatingActivities'], cumulative: true },
  cfo:                { concepts: ['ifrs-full_CashFlowsFromUsedInOperatingActivities'], cumulative: true },
  capex:              { concepts: ['ifrs-full_PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities'], cumulative: true },
  costOfRevenue:      { concepts: ['ifrs-full_CostOfSales'], cumulative: true },
  totalAssets:        { concepts: ['ifrs-full_Assets'], cumulative: false },
  currentAssets:      { concepts: ['ifrs-full_CurrentAssets'], cumulative: false },
  currentLiabilities: { concepts: ['ifrs-full_CurrentLiabilities'], cumulative: false },
  goodwill:           { concepts: ['ifrs-full_Goodwill'], cumulative: false },
  equity:             { concepts: ['ifrs-full_Equity', 'ifrs-full_EquityAttributableToOwnersOfParent'], cumulative: false },
  inventory:          { concepts: ['ifrs-full_Inventories'], cumulative: false },
  accountsReceivable: { concepts: ['ifrs-full_TradeAndOtherCurrentReceivables', 'ifrs-full_CurrentTradeReceivables'], cumulative: false },
  accountsPayable:    { concepts: ['ifrs-full_TradeAndOtherCurrentPayables', 'ifrs-full_CurrentTradePayables'], cumulative: false },
};

/** Trésorerie IFRS. Pas d'équivalent direct des placements court terme → cash seul. */
const IFRS_CASH_PARTS = { cash: ['ifrs-full_CashAndCashEquivalents'], shortTermInvestments: [] as string[] } as const;

/** Types annuels reconstruits en composant plusieurs concepts, pas en mappant un MetricKey. */
const COMPOSED_ANNUAL_TYPES = [
  'annualFreeCashFlow',                 // cfo − |capex|
  'annualCashAndCashEquivalents',       // cash seul
  'annualCashAndShortTermInvestments',  // cash + placements court terme
] as const;

export const EDGAR_ANNUAL_TYPES: ReadonlySet<string> = new Set([...Object.keys(ANNUAL_TYPE_TO_METRIC), ...COMPOSED_ANNUAL_TYPES]);

/**
 * Séries ANNUELLES en devise NATIVE pour un déposant 20-F étranger.
 *
 * Renvoie une Map vide si l'émetteur reporte en USD (son pipeline existant couvre déjà), n'a
 * pas de CIK (tickers suffixés → non-US), ou si EDGAR n'a rien. Best-effort, jamais de throw.
 * Le point de vigilance devise ne se pose pas : on ne lit QUE la colonne de la devise de
 * reporting, homogène avec Yahoo et stockanalysis.
 */
export async function getEdgarAnnualNative(ticker: string, types: string[]): Promise<Map<string, TimeseriesPoint[]>> {
  const out = new Map<string, TimeseriesPoint[]>();
  const wanted = types.filter(t => EDGAR_ANNUAL_TYPES.has(t));
  if (wanted.length === 0) return out;
  const cik = await getCik(ticker);
  if (!cik) return out;
  const profile = await secReportingProfile(ticker);
  if (!profile) return out;
  const isIfrs = profile.taxonomy === 'ifrs-full';
  // Déposant us-gaap qui reporte en USD : son pipeline trimestriel (Finnhub + EDGAR) le couvre
  // déjà, pas de profondeur annuelle à aller chercher. Les déposants IFRS, eux, y ont droit
  // quelle que soit leur devise — c'est leur SEULE source profonde, et la colonne USD n'y est
  // pas une conversion de convenance mais bien leur devise de publication.
  if (!isIfrs && profile.currency === 'USD') return out;
  const native = profile.currency;

  const needFcf = wanted.includes('annualFreeCashFlow');
  const needCash = wanted.includes('annualCashAndCashEquivalents') || wanted.includes('annualCashAndShortTermInvestments');
  const metricSet = new Set<MetricKey>();
  for (const t of wanted) { const m = ANNUAL_TYPE_TO_METRIC[t]; if (m) metricSet.add(m); }
  if (needFcf) { metricSet.add('cfo'); metricSet.add('capex'); }

  const byMetric = new Map<MetricKey, TimeseriesPoint[]>();
  for (const metric of metricSet) {
    const cfg = isIfrs ? IFRS_ANNUAL_CONCEPTS[metric] : METRICS[metric];
    if (!cfg) continue;   // métrique sans équivalent IFRS (shares, dette) → simplement absente
    const concepts = cfg.concepts.filter(c => !c.startsWith('__'));
    // shares est une moyenne pondérée sur l'exercice (durée FY), pas un montant monétaire.
    const unit = metric === 'shares' ? 'shares' : native;
    const all: ConceptEntry[] = [];
    for (const raw of concepts) {
      const [taxonomy, ...rest] = raw.split('_');
      const concept = rest.join('_');
      if (!taxonomy || !concept) continue;
      const units = await fetchConceptUnits(cik, taxonomy, concept);
      const entries = units?.[unit];
      if (entries?.length) all.push(...entries);
    }
    const pts = (metric === 'shares' || cfg.cumulative) ? annualDurationPoints(all) : annualInstantPoints(all);
    if (pts.length) byMetric.set(metric, pts);
  }

  for (const t of wanted) {
    if (t === 'annualFreeCashFlow') continue;
    const pts = byMetric.get(ANNUAL_TYPE_TO_METRIC[t]!);
    if (pts?.length) out.set(t, pts);
  }
  if (needFcf) {
    // Même définition que le fcf trimestriel EDGAR : CFO − |CapEx|, capex absent = 0.
    const cfo = byMetric.get('cfo') ?? [];
    const capexByDate = new Map((byMetric.get('capex') ?? []).map(p => [p.date, Math.abs(p.value)]));
    const fcf = cfo.map(c => ({ date: c.date, value: c.value - (capexByDate.get(c.date) ?? 0) }));
    if (fcf.length) out.set('annualFreeCashFlow', fcf);
  }
  if (needCash) {
    const parts = await annualPartsByRole(cik, native, isIfrs ? IFRS_CASH_PARTS : CASH_PARTS);
    if (wanted.includes('annualCashAndCashEquivalents')) {
      const c = composeAnnual(parts, v => v.cash);
      if (c.length) out.set('annualCashAndCashEquivalents', c);
    }
    if (wanted.includes('annualCashAndShortTermInvestments')) {
      const c = composeAnnual(parts, v => computeCashAndEquivalents({ cash: v.cash, shortTermInvestments: v.shortTermInvestments }));
      if (c.length) out.set('annualCashAndShortTermInvestments', c);
    }
  }
  if (out.size) {
    console.log(`[edgar annual ${ticker}] ${native} : ${[...out.entries()].map(([t, p]) => `${t}=${p.length}`).join(' ')}`);
  }
  return out;
}

/**
 * Pour chaque RÔLE d'un type composé, la série annuelle de bilan en devise native, indexée par
 * date. Les concepts d'un rôle sont essayés dans l'ordre et le premier renseigné gagne POUR
 * CHAQUE DATE — une société qui change de tag XBRL en cours de route garde une série continue.
 */
async function annualPartsByRole<K extends string>(
  cik: string,
  unit: string,
  roles: Record<K, readonly string[]>,
): Promise<Map<K, Map<string, number>>> {
  const out = new Map<K, Map<string, number>>();
  for (const role of Object.keys(roles) as K[]) {
    const byDate = new Map<string, number>();
    for (const raw of roles[role]) {
      const [taxonomy, ...rest] = raw.split('_');
      const concept = rest.join('_');
      if (!taxonomy || !concept) continue;
      const units = await fetchConceptUnits(cik, taxonomy, concept);
      const entries = units?.[unit];
      if (!entries?.length) continue;
      for (const p of annualInstantPoints(entries)) {
        if (!byDate.has(p.date)) byDate.set(p.date, p.value); // premier concept renseigné gagne
      }
    }
    out.set(role, byDate);
  }
  return out;
}

/**
 * Applique une formule de composition à chaque exercice présent dans AU MOINS un rôle. Un rôle
 * absent à une date vaut `null` — c'est exactement ce qu'attendent computeTotalDebt et
 * computeCashAndEquivalents, qui distinguent « composante absente » de « zéro ».
 */
function composeAnnual<K extends string>(
  parts: Map<K, Map<string, number>>,
  formula: (values: Record<K, number | null>) => number | null,
): TimeseriesPoint[] {
  const dates = new Set<string>();
  for (const byDate of parts.values()) for (const d of byDate.keys()) dates.add(d);
  const out: TimeseriesPoint[] = [];
  for (const date of [...dates].sort()) {
    const values = {} as Record<K, number | null>;
    for (const [role, byDate] of parts) values[role] = byDate.get(date) ?? null;
    const v = formula(values);
    if (v != null && Number.isFinite(v)) out.push({ date, value: v });
  }
  return out;
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
  const profile = await secReportingProfile(ticker);
  if (!profile) return null;
  // Contrat inchangé : null quand l'émetteur publie en USD (rien à convertir en aval).
  return profile.currency === 'USD' ? null : profile.currency;
}

/**
 * Taxonomie de dépôt et devise de PUBLICATION d'un émetteur SEC, ou null s'il n'expose aucun
 * bilan XBRL. Contrairement à `getSecReportingCurrency`, la devise est toujours renseignée,
 * USD compris — l'extraction a besoin de savoir dans quelle colonne lire, pas seulement s'il
 * faut convertir.
 *
 * On sonde `Assets` dans us-gaap puis, à défaut, dans ifrs-full : c'est ce second passage qui
 * ouvre les 478 déposants IFRS restés sans profondeur jusqu'ici. Mémoïsé par le cache de
 * `fetchConceptUnits`, donc au plus deux téléchargements par émetteur et par process.
 */
async function secReportingProfile(ticker: string): Promise<{ taxonomy: 'us-gaap' | 'ifrs-full'; currency: string } | null> {
  const cik = await getCik(ticker);
  if (!cik) return null;
  const gaap = await fetchConceptUnits(cik, 'us-gaap', 'Assets');
  if (gaap && Object.keys(gaap).length > 0) {
    return { taxonomy: 'us-gaap', currency: foreignReportingCurrency(gaap) ?? 'USD' };
  }
  const ifrs = await fetchConceptUnits(cik, 'ifrs-full', 'Assets');
  if (ifrs && Object.keys(ifrs).length > 0) {
    return { taxonomy: 'ifrs-full', currency: foreignReportingCurrency(ifrs) ?? 'USD' };
  }
  return null;
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
