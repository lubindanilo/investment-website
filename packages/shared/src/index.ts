/**
 * Types partagés entre apps/web (React) et apps/api (Express).
 * Tout ce qui voyage sur le réseau doit être typé ici.
 */

// ─── Contenu éditorial (blog) — source unique web + api ─────────────────────
export * from './articles.js';

// ─── Critères ──────────────────────────────────────────────────────────────

export type CriterionStatus = 'pass' | 'fail' | 'warn';

/** Statut sémantique « data » côté affichage (vert/orange/rouge). */
export type DataStatus = 'good' | 'warn' | 'bad';

export interface Criterion {
  /**
   * Identifiant stable, indépendant de la langue (ex 'fcfGrowth5y'). Présent sur les
   * critères chiffrés déterministes ; sert à retrouver le graphique/brief associé sans
   * dépendre du libellé `nom` (qui, lui, est localisé). Absent sur les critères qualitatifs.
   */
  key?: string;
  nom: string;
  valeur: string;
  cible: string;
  statut: CriterionStatus;
  explication: string;
}

export type CriteriaCategory = 'chiffres' | 'business' | 'management' | 'valorisation';

/** Un pair coté du secteur avec son P/FCF (pour le détail concurrentiel). */
export interface SectorPeer {
  ticker: string;
  name: string | null;
  pfcf: number;
}

/** Benchmark sectoriel : médiane du P/FCF des pairs cotés suivis + position du titre. */
export interface SectorBenchmark {
  /** Industrie (chaîne canonique anglaise — traduite côté front via le namespace `industries`). */
  sector: string;
  /** Médiane du P/FCF des pairs (P/FCF > 0). */
  medianPfcf: number;
  /** Moyenne du P/FCF des pairs (P/FCF > 0). */
  meanPfcf: number;
  /** Nombre de pairs valides ayant servi au calcul. */
  count: number;
  /** Percentile du P/FCF du titre vs ses pairs (0-100, bas = moins cher). Null si P/FCF du titre indispo. */
  percentile: number | null;
  /** Liste des pairs (ticker + P/FCF), triée croissant — pour la modale « + de détails ». */
  peers: SectorPeer[];
}

/** Un versement de dividende (par action). */
export interface DividendPayment {
  /** YYYY-MM-DD du versement. */
  date: string;
  /** Montant par action (devise du titre). */
  amount: number;
}

/** Infos dividende (Yahoo). `paysDividend=false` → la société n'en verse pas. */
export interface DividendInfo {
  paysDividend: boolean;
  /** Rendement en % (ex 1.8 pour 1,8 %). */
  yieldPct: number | null;
  /** Dividende annuel par action (devise du titre). */
  ratePerShare: number | null;
  /** Taux de distribution (payout) en % du résultat. */
  payoutRatioPct: number | null;
  /** Prochaine date ex-dividende (YYYY-MM-DD). */
  exDate: string | null;
  /** Croissance annualisée (CAGR) du dividende sur 5 ans, en %. Null si historique < 5 ans. */
  growth5yPct: number | null;
  /** Historique complet des versements, AJUSTÉ DES SPLITS (ancien→récent) — graphe d'évolution. */
  payments: DividendPayment[];
}

/**
 * « Part de marché · position concurrentielle » — critère qualitatif enrichi (GPT + recherche web).
 * Affiché en tête de la partie qualitative, HORS notation. `series` alimente le graphe d'évolution
 * (empilé entre acteurs / courbe de la société). `series[0]` = la société analysée ; dernière entrée
 * souvent « Autres ». Chaque `data` = part en % par année, aligné sur `years`.
 */
export interface MarketShareSeries {
  name: string;
  /** Part de marché en % par année (aligné sur `years`). */
  data: number[];
}
export interface MarketShare {
  /** Phrase d'en-tête, ex. « ≈ 42 % du voyage en ligne ». */
  valeur: string;
  /** pass = leader/en hausse · warn = stable/fragmenté · fail = en recul. */
  statut: CriterionStatus;
  /** 1-2 phrases : tendance + dynamique concurrentielle. */
  explication: string;
  /** Source + date (les chiffres sont des estimations). */
  source?: string;
  /** Années de l'axe X (ex. ["2019",…,"2024"]). */
  years: string[];
  /** Une série par acteur ; series[0] = la société analysée. */
  series: MarketShareSeries[];
}

// ─── Fondamentaux dérivés ─────────────────────────────────────────────────

export interface DerivedMetrics {
  netMargin: number | null;
  revenueCagr: number | null;
  fcfPerShareCagr: number | null;
  /**
   * CAGR (sur ~4-5 ans) du nombre d'actions en circulation.
   * Négatif = rachats nets (création de valeur), positif = dilution.
   * Source : Yahoo Finance (raw) en primaire, dérivation Finnhub en fallback.
   */
  shareCagr: number | null;
  /** Origine du chiffre, pour transparence côté UI/logs. */
  shareCagrSource: 'yahoo' | 'finnhub-derived' | null;
  fcfMargin: number | null;
  operatingLeverage: boolean | null;
  cashROCE: number | null;
  /**
   * Indique quelle variante de la formule Cash ROCE a été appliquée :
   *  - 'strict' : FCF / (Assets − CurLiab − Goodwill − ExcessCash) — formule complète Damodaran
   *  - 'no-excess-fallback' : FCF / (Assets − CurLiab − Goodwill) — fallback pour boîtes
   *    ultra-cash-rich (cash excédentaire > capital op net). Bettin/Mauboussin classique.
   *  - 'no-goodwill-fallback' : FCF / (Assets − CurLiab) — Buffett classique incluant le
   *    goodwill, pour boîtes asset-light sur-acquisitives (MEDP-style) où le goodwill
   *    dépasse le capital tangible net. Le goodwill représente du capital réellement
   *    payé via M&A, défendable de l'inclure quand la version "tangible" n'est plus
   *    calculable.
   *  - 'financial-equity' : FCF / (Equity + LT Debt − Goodwill) — fallback secteur financier
   *    (assureurs, banques) où le bilan est unclassified (pas de Current Liabilities séparé).
   *  - null si cashROCE n'est pas calculable du tout
   */
  cashROCEFormula?: 'strict' | 'no-excess-fallback' | 'no-goodwill-fallback' | 'financial-equity' | null;
  netDebtFcf: number | null;
  ccr: number | null;
  nwc: number | null;
  nwcCurrentRatio: number | null;
  /**
   * Cash Conversion Cycle (CCC) en JOURS = DSO + DIO − DPO. Remplace currentRatio
   * pour l'évaluation de l'efficacité du BFR. Négatif = modèle float (Amazon, Costco).
   */
  ccc: number | null;
  /** Sous-composantes (jours) pour l'affichage détaillé : créances / stocks / fournisseurs. */
  cccDso: number | null;
  cccDio: number | null;
  cccDpo: number | null;
  /** Pente de la régression linéaire CCC vs temps, en JOURS/AN (≥ 4 trimestres requis).
   *  < -3 = compression, ∈ [-3,+3] = stable, > +3 = allongement. */
  cccSlopeDaysPerYear: number | null;
  /** True si le CCC courant est calculé en mode APPROCHÉ (COGS non publié → DIO/DPO
   *  utilisent revenue comme dénominateur). Les niveaux absolus sont sous-estimés,
   *  mais la tendance reste fiable. Null si CCC indispo. */
  cccApproximated: boolean | null;
  pfcfTTM: number | null;
  /** Marché capitalisation (USD millions) */
  marketCap: number | null;
  /** Prix action courant (USD) */
  price: number | null;
  /** Part du SBC sur le FCF — alerte si > 0.15 */
  sbcShareOfFcf: number | null;
  /**
   * Raisons spécifiques pour les ratios qui sont null. Permet au front d'afficher
   * "Non calculable" + un message précis (ex: "FCF négatif sur le dernier exercice")
   * plutôt qu'un vague "N/A" — principe d'honnêteté radicale, pas de fallback caché.
   *
   * Les clés correspondent aux champs DerivedMetrics, les valeurs sont les explications.
   */
  notCalculableReasons?: Partial<Record<string, string>>;
}

// ─── Valorisation (Buffett-style) ─────────────────────────────────────────

export interface ValoParams {
  /** Toujours 0.15 (rendement annualisé visé verrouillé) */
  targetReturn: number;
  /** Croissance FCF/action projetée 5 ans (en décimal) */
  fcfGrowth: number;
  /** Multiple P/FCF cible dans 5 ans */
  targetMultiple: number;
}

export interface ValuationResult extends Criterion {
  fcfPsNow: number | null;
  currentPfcf: number | null;
  fcfPs5Y: number | null;
  exitValue: number | null;
  buyPrice: number | null;
  currentPrice: number | null;
  discountPct: number | null;
}

// ─── News ─────────────────────────────────────────────────────────────────

export type NewsType = 'rachat' | 'dividende' | 'résultats' | 'M&A' | 'mgmt';

export interface NewsItem {
  titre: string;
  date: string;
  type: NewsType;
  resume: string;
  url: string;
  source: string;
}

// ─── Réponse complète de /api/analyze ──────────────────────────────────────

export interface AnalyzeResponse {
  ticker: string;
  company: string;
  /** Prix actuel (USD) */
  price: number | null;
  metrics: DerivedMetrics;
  criteres: Criterion[];
  /** Score brut (pass + 0.5 × warn) */
  score: number;
  scoreMax: number;
  /** True si score/scoreMax >= 0.7 */
  achat: boolean;
  /** 1-2 phrases percutantes (GPT) */
  verdict_direct: string;
  /** Vraies news Finnhub des 60 derniers jours */
  news: NewsItem[];
  /** Valorisation DCF avec params en input */
  valuation: ValuationResult;
  valoParams: ValoParams;
  /**
   * Timestamp ISO de la génération initiale du business model (lifetime cache).
   * Null si l'analyse qualitative n'a pas encore été générée pour ce ticker.
   */
  businessCachedAt: string | null;
  /**
   * Timestamp ISO du dernier refresh management. Null si pas encore généré.
   * L'utilisateur peut rafraîchir via le bouton dédié quand le CEO/CFO change.
   */
  managementCachedAt: string | null;
  /**
   * true si business + management sont tous les deux cachés et inclus dans criteres.
   * false → le front affiche un CTA "Générer l'analyse qualitative".
   */
  qualitativeAvailable: boolean;
  /** Date du prochain + dernier earnings (Finnhub /calendar/earnings) */
  earnings: EarningsInfo;
  /**
   * False quand AUCUNE source ne renvoie de fondamentaux (Finnhub vide + Yahoo introuvable).
   * Le front affiche alors un bandeau, masque le chart TradingView et grise les chiffres.
   */
  fundamentalsAvailable: boolean;
  /**
   * Source ayant fourni les fondamentaux :
   *   - 'finnhub' : tickers US (couverture pre-computed ratios)
   *   - 'yahoo'   : tickers non-US résolus via suffixes (.SW, .PA, .DE…)
   *   - null      : indisponible
   */
  fundamentalsSource: 'finnhub' | 'yahoo' | null;
  /** Devise de reporting : USD pour Finnhub, CHF/EUR/GBP… pour Yahoo selon l'exchange. */
  currency: string;
  /** Symbol résolu chez Yahoo si fallback Yahoo (ex "COPN.SW" quand l'utilisateur a tapé "COPN"). */
  yahooSymbol?: string;
  /** Percentile actuel du P/FCF vs son propre historique (0-100). Null si historique insuffisant. */
  pfcfPercentile: number | null;
  /** « Opportunité du moment » : P/FCF dans son décile bas historique (≤10) ET < 25. */
  opportunity: boolean;
  /**
   * « Part de marché · position concurrentielle » (qualitatif GPT, hors notation).
   * Null si l'analyse qualitative n'a pas encore été générée (ou générée avant cette feature).
   */
  marketShare?: MarketShare | null;
  /**
   * Benchmark sectoriel du P/FCF : médiane parmi les sociétés cotées suivies de la même
   * industrie + le percentile du titre. Null si industrie inconnue ou trop peu de pairs.
   */
  sectorBenchmark?: SectorBenchmark | null;
  /** Infos dividende (Yahoo). Null si non récupérable ; `paysDividend=false` si pas de dividende. */
  dividend?: DividendInfo | null;
  /**
   * True si le ticker est déjà dans la watchlist de l'utilisateur connecté.
   * Calculé côté serveur (optionalAuth) → source unique, pas de course avec un
   * second fetch. Undefined si l'utilisateur n'est pas connecté.
   */
  inWatchlist?: boolean;
}

// ─── Watchlist ─────────────────────────────────────────────────────────────

export interface WatchlistEntry {
  ticker: string;
  name: string;
  price: number | null;
  pfcfTTM: number | null;
  scoreChiffres: number;
  scoreChiffresMax: number;
  /** Devise de reporting (USD pour Finnhub, CHF/EUR/GBP pour Yahoo selon l'exchange) */
  currency?: string;
  /** Source qui a fourni la donnée — utile pour distinguer EU vs US dans l'UI */
  source?: 'finnhub' | 'yahoo' | null;
  /** Date du prochain earnings (YYYY-MM-DD). Null si inconnue. Cachée jusqu'à la date. */
  nextEarningsDate?: string | null;
  /** « Opportunité du moment » (P/FCF dans son décile bas historique ET < 25). */
  opportunity?: boolean;
  /** Percentile actuel du P/FCF vs historique (0-100). Null si indisponible. */
  pfcfPercentile?: number | null;
  // ─── Champs internes pour recompute P/FCF live ──────────────────────────
  // Ces 2 champs ne changent qu'à chaque earnings (FCF) ou très peu (shares).
  // Ils permettent de recomputer pfcfTTM = (price × shares) / adjFcfTtm avec un
  // prix temps réel à chaque GET, sans refaire tous les calculs lourds.
  adjFcfTtm?: number | null;
  sharesOutstanding?: number | null;
}

// ─── Comparaison side-by-side ──────────────────────────────────────────────

/** Valeur d'un critère pour un ticker dans la table de comparaison. */
export interface CompareCell {
  /** Affichage formaté (ex "27.1%", "✓ Expansion", "1.03"). */
  d: string;
  /** Numérique comparable pour le "meilleur par ligne" (null si non comparable, ex texte). */
  n: number | null;
  /** Statut data : vert/orange/rouge. */
  s: DataStatus;
}

/** Un ticker dans la comparaison (en-tête + cellules par critère). */
export interface CompareTicker {
  ticker: string;
  company: string;
  sector: string | null;
  currency: string;
  price: number | null;
  dayChangePct: number | null;
  /** Note /10 = round(scoreChiffres / scoreChiffresMax × 10). */
  scoreChiffres: number;
  scoreChiffresMax: number;
  /** Cellules indexées par clé de critère (10 chiffres + 'pfcf' + 'valuation'). */
  cells: Record<string, CompareCell>;
  /** Prix d'achat conseillé (DCF) — pour la ligne Valorisation. */
  buyPrice: number | null;
}

/** Définition (localisée) d'un critère pour les libellés de lignes de la comparaison. */
export interface CompareCriterionDef { key: string; label: string; target: string }

export interface CompareResponse {
  tickers: CompareTicker[];
  /** Les 10 critères chiffrés (libellé + cible localisés), pour la colonne de gauche. */
  criteria: CompareCriterionDef[];
}

/** Suggestion d'autocomplétion (recherche de ticker pour la comparaison). */
export interface TickerSuggestion {
  ticker: string;
  name: string | null;
  sector: string | null;
  scoreChiffres: number | null;
  scoreChiffresMax: number | null;
}

// ─── Earnings (calendrier + résultats) ─────────────────────────────────────

/** Une ligne du screener (vue "meilleures notes"). */
export interface ScreenerTopRow {
  ticker: string;
  name: string | null;
  scoreChiffres: number | null;
  scoreChiffresMax: number | null;
  pfcfTTM: number | null;
  currency: string | null;
  nextEarningsDate: string | null;
  /** Secteur/industrie (Finnhub). Null pour beaucoup de titres Yahoo. */
  sector: string | null;
  /** Dernier cours connu (au scoring). */
  price: number | null;
  /** Variation du jour en %. */
  dayChangePct: number | null;
  /** Closes mensuels ~1 an pour la sparkline. */
  spark: number[] | null;
  /** « Opportunité du moment » : P/FCF dans son décile bas historique (≤10) ET < 25. */
  opportunity: boolean;
  /** Percentile actuel du P/FCF vs historique (0-100). Null si indisponible. */
  pfcfPercentile: number | null;
}

/**
 * Ligne du panier « Bat le marché » (stratégie value + momentum, validée en backtest :
 * Sharpe ~1,5, bat le S&P500 à risque comparable). Sélection : parmi le top 50 % des actions
 * par momentum de prix 12 mois, on prend les N moins chères en P/FCF absolu, équipondérées.
 */
export interface MarketBeatRow {
  ticker: string;
  name: string | null;
  scoreChiffres: number | null;
  scoreChiffresMax: number | null;
  pfcfTTM: number | null;
  currency: string | null;
  nextEarningsDate: string | null;
  sector: string | null;
  price: number | null;
  dayChangePct: number | null;
  spark: number[] | null;
  opportunity: boolean;
  pfcfPercentile: number | null;
  /** Momentum de prix ~12 mois (12-1, on saute le dernier mois). 0,42 = +42 %. Null si historique insuffisant. */
  momentum12m: number | null;
  /** Capitalisation boursière live (prix du jour × actions). Null si indisponible. */
  marketCap: number | null;
  /** Poids équipondéré dans le panier (ex. 0,05 = 5 %). */
  weight: number;
}

/** Position d'un portefeuille suivi (prix d'entrée figé + prix live + flag pépite). */
export interface ForwardComparePosition {
  ticker: string;
  name: string | null;
  entry: number | null;
  live: number | null;
  /** Rendement depuis l'entrée (live/entry − 1, ou réalisé si vendue). Null si prix indisponible. */
  ret: number | null;
  /** « Pépite du moment » actuelle (note≥8 + P/FCF<25 + percentile≤10). Le titre est-il AUSSI une pépite ? */
  opportunity: boolean;
  // ── Champs « Ma sélection » uniquement (positions gérées par l'utilisateur) ──
  id?: string;
  buyDate?: string;
  sellDate?: string | null;
  sellPrice?: number | null;
  note?: string | null;
}

/** Position du portefeuille personnel (CRUD). */
export interface PortfolioPositionDTO {
  id: string;
  ticker: string;
  buyDate: string;
  buyPrice: number;
  sellDate: string | null;
  sellPrice: number | null;
  note: string | null;
}

/** Un portefeuille du suivi forward comparé (équipondéré). */
export interface ForwardComparePortfolio {
  id: string;
  label: string;
  /** Rendement équipondéré du panier depuis l'inception. Null si aucun prix. */
  returnPct: number | null;
  positions: ForwardComparePosition[];
}

/** Réponse du suivi forward comparé (page « Bat le marché »). */
export interface ForwardCompareResponse {
  inception: string;
  asOf: string;
  portfolios: ForwardComparePortfolio[];
  benchmark: { label: string; entry: number | null; live: number | null; returnPct: number | null };
}

/** Progression de la veille screener. */
export interface ScreenerStats {
  pending: number;
  scored: number;
  nodata: number;
  error: number;
  total: number;
}

export interface EarningsResult {
  /** YYYY-MM-DD */
  date: string;
  quarter: number;
  year: number;
  /** "bmo" (before market open), "amc" (after market close), null si inconnu */
  hour: string | null;
  epsActual: number | null;
  epsEstimate: number | null;
  /** epsActual - epsEstimate */
  epsSurprise: number | null;
  /** epsSurprise / |epsEstimate|, en décimal (0.115 = +11.5%) */
  epsSurprisePct: number | null;
  /** En USD millions */
  revenueActual: number | null;
  revenueEstimate: number | null;
  /** revenueSurprise / |revenueEstimate|, en décimal */
  revenueSurprisePct: number | null;
}

export interface EarningsInfo {
  /** Le prochain earnings (dans le futur). Null si pas connu. */
  next: EarningsResult | null;
  /** Le dernier earnings (dans le passé). Null si pas connu. */
  last: EarningsResult | null;
}

// ─── Séries temporelles trimestrielles (histogrammes UI) ───────────────────

export interface TimeseriesPoint {
  date: string;       // YYYY-MM-DD
  value: number;
}

export interface TimeseriesResponse {
  ticker: string;
  metric: string;
  freq: 'quarterly' | 'annual';
  years: number;
  points: TimeseriesPoint[];
  /**
   * true si le ticker est non-US et que la donnée vient de Yahoo annual.
   * Yahoo /fundamentals-timeseries n'expose PAS le quarterly pour les bourses européennes
   * (juste 4 années annuelles). Le front affiche un petit notice pour expliquer.
   */
  euAnnualOnly?: boolean;
}

/** Période disponible dans le sélecteur UI */
export type TimeseriesPeriod = '1Y' | '5Y' | '10Y' | '20Y' | 'All';

export const PERIOD_YEARS: Record<TimeseriesPeriod, number> = {
  '1Y': 1, '5Y': 5, '10Y': 10, '20Y': 20, 'All': 50,
};

/**
 * Mapping nom de critère → métrique Finnhub financials-reported + libellé + format.
 * Seuls les critères listés ici sont cliquables (histogrammable).
 *
 * `metricKey` correspond à une clé du mapping METRICS dans `finnhubFundamentals.ts` côté API.
 */
export type TimeseriesMetricKey = 'revenue' | 'netIncome' | 'operatingIncome' | 'fcf' | 'cfo' | 'shares' | 'totalDebt' | 'equity' | 'cashAndEquivalents' | 'totalAssets' | 'currentLiabilities' | 'goodwill';

/**
 * Métriques-RATIO : calculées par /api/timeseries à partir de DEUX séries sous-jacentes
 * (TTM glissant côté US, par exercice côté EU/ADR). Contrairement aux métriques brutes,
 * la série renvoyée est déjà le ratio lui-même — marge en % (unit 'percent') ou multiple
 * × (unit 'multiple') — pas une grandeur absolue. Le dernier point = la valeur de la carte.
 */
export type RatioMetricKey = 'netMargin' | 'fcfMargin' | 'operatingMargin' | 'netDebtFcf' | 'cashConversion';
export const RATIO_METRIC_KEYS: readonly RatioMetricKey[] = ['netMargin', 'fcfMargin', 'operatingMargin', 'netDebtFcf', 'cashConversion'];

/**
 * Nombre maxi de titres comparables côté /comparer. Source unique de vérité partagée
 * entre le front (sélecteur + slots) et l'API (/api/compare). Pour en autoriser plus,
 * il suffit de modifier cette constante. Min toujours 2.
 */
export const MAX_COMPARE_TICKERS = 5;

export interface CriterionHistogram {
  metricKey: TimeseriesMetricKey | RatioMetricKey;
  /** Libellé français (fallback). Le front affiche plutôt `t(labelKey)`. */
  label: string;
  /** Clé i18n du titre du graphique (ex 'charts.fcf'). */
  labelKey: string;
  /** Format : 'currency' (montant $), 'count' (nb actions), 'percent' (×100 + %), 'multiple' (× , ex 2.5×) */
  unit: 'currency' | 'count' | 'percent' | 'multiple';
}

/**
 * Liste des critères qui ouvrent un graphique LINE (≠ histogramme).
 * À étendre si on ajoute d'autres ratios trackables (PE, PB, EV/EBITDA, etc.).
 */
// Clés stables des critères chiffrés (indépendantes de la langue). Servent à indexer
// graphiques, briefs et catalogues i18n sans dépendre du libellé localisé.
export type QuantCriterionKey =
  | 'netMargin' | 'revenueGrowth5y' | 'fcfGrowth5y' | 'shareCount5y' | 'fcfMargin'
  | 'operatingLeverage' | 'cashRoce' | 'netDebtFcf' | 'cashConversion' | 'ccc'
  | 'pfcf' | 'valuation';

/** Critères ouvrant un graphique LINE, indexés par clé stable. `labelKey` = clé i18n du titre. */
export const CRITERION_LINECHARTS: Record<string, { label: string; labelKey: string; kind: 'pfcf' | 'cashRoce' }> = {
  pfcf:     { label: 'Évolution du P/FCF dans le temps', labelKey: 'charts.pfcf', kind: 'pfcf' },
  cashRoce: { label: 'Évolution du Cash ROCE dans le temps', labelKey: 'charts.cashRoce', kind: 'cashRoce' },
};

/** Critères ouvrant un HISTOGRAMME, indexés par clé stable. `labelKey` = clé i18n du titre. */
export const CRITERION_HISTOGRAMS: Record<string, CriterionHistogram> = {
  netMargin:         { metricKey: 'netMargin',       label: 'Marge nette (TTM)',                  labelKey: 'charts.netMargin',       unit: 'percent'  },
  revenueGrowth5y:   { metricKey: 'revenue',         label: 'CA trimestriel',                     labelKey: 'charts.revenue',         unit: 'currency' },
  fcfGrowth5y:       { metricKey: 'fcf',             label: 'Free cash flow trimestriel',         labelKey: 'charts.fcf',             unit: 'currency' },
  shareCount5y:      { metricKey: 'shares',          label: 'Actions diluées (moyenne)',          labelKey: 'charts.shares',          unit: 'count'    },
  fcfMargin:         { metricKey: 'fcfMargin',       label: 'Marge FCF (TTM)',                    labelKey: 'charts.fcfMargin',       unit: 'percent'  },
  operatingLeverage: { metricKey: 'operatingMargin', label: 'Marge opérationnelle (TTM)',         labelKey: 'charts.operatingMargin', unit: 'percent'  },
  netDebtFcf:        { metricKey: 'netDebtFcf',      label: 'Dette nette / FCF (TTM)',            labelKey: 'charts.netDebtFcf',      unit: 'multiple' },
  cashConversion:    { metricKey: 'cashConversion',  label: 'Conversion cash FCF/RN (TTM)',       labelKey: 'charts.cashConversion',  unit: 'multiple' },
};

// ─── P/FCF historique (graphique line cliquable depuis le critère) ────────

export interface PfcfHistoryPoint {
  /** YYYY-MM-DD */
  date: string;
  /** Multiple P/FCF (ex 22.5). Toujours > 0 — points où le ratio est non-pertinent sont omis. */
  pfcf: number;
}

export interface PfcfHistoryResponse {
  ticker: string;
  years: number;
  points: PfcfHistoryPoint[];
  cached: boolean;
  ageMs?: number;
  fetchedInMs?: number;
}

// ─── Cash ROCE historique (graphique line cliquable depuis le critère) ────

export interface CashRoceHistoryPoint {
  /** YYYY-MM-DD */
  date: string;
  /** Ratio Cash ROCE (ex 0.225 pour 22.5 %). Toujours > 0 — points dégénérés omis. */
  cashRoce: number;
}

export interface CashRoceHistoryResponse {
  ticker: string;
  years: number;
  points: CashRoceHistoryPoint[];
  cached: boolean;
  ageMs?: number;
  fetchedInMs?: number;
}

// ─── Auth (user public — pas de password ni hash) ──────────────────────────

export interface PublicUser {
  id: string;
  email: string;
  /** ISO 8601 */
  createdAt: string;
}

// ─── Erreurs API normalisées ───────────────────────────────────────────────

export interface ApiError {
  error: string;
  details?: string;
}
