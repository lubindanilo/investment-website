/* ============================================================
   LUBIN — Données mock (fictives mais crédibles)
   Deux sociétés : HLMS ~9/10 (compounder) · BRND ~5/10 (moyen)
   ============================================================ */

// Générateur pseudo-aléatoire déterministe (séries stables au reload)
function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Série de prix réaliste (marche aléatoire avec tendance + volatilité)
function priceSeries(seed, points, start, drift, vol) {
  const r = rng(seed);
  const out = [];
  let p = start;
  for (let i = 0; i < points; i++) {
    const shock = (r() - 0.5) * vol;
    p = Math.max(2, p * (1 + drift + shock));
    out.push(p);
  }
  return out;
}

// Série trimestrielle avec croissance + bruit, avec quelques trous (null)
function quarterly(seed, n, start, growth, noise, holes) {
  const r = rng(seed);
  const out = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    v = v * (1 + growth + (r() - 0.5) * noise);
    out.push({ q: i, v });
  }
  if (holes) holes.forEach((h) => { if (out[h]) out[h].v = null; });
  return out;
}

function ratioSeries(seed, n, start, slope, noise, holes) {
  const r = rng(seed);
  const out = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    v = v + slope + (r() - 0.5) * noise;
    out.push({ q: i, v });
  }
  if (holes) holes.forEach((h) => { if (out[h]) out[h].v = null; });
  return out;
}

// — Définition des 10 critères chiffrés —
// status: "good" | "warn" | "bad" ; chart: "bar" (flux) | "line" (ratio)
function criteria(values) {
  return [
    { key: "marge_nette", label: "Rentabilité — marge nette", target: "> 15 %", unit: "%", chart: "line",
      why: "La marge nette mesure ce qui reste pour l'actionnaire après toutes les charges. Une marge élevée et stable signale un pricing power réel et un business peu capitalistique.",
      calc: "Résultat net ÷ chiffre d'affaires, sur les 12 derniers mois.", ...values.marge_nette },
    { key: "croissance_ca", label: "Croissance du CA — 5 ans", target: "> 10 %/an", unit: "%", chart: "bar",
      why: "Une croissance soutenue du chiffre d'affaires alimente la création de valeur sur le long terme et confirme la demande pour le produit.",
      calc: "CAGR du chiffre d'affaires sur les 5 derniers exercices.", ...values.croissance_ca },
    { key: "croissance_fcf", label: "Croissance FCF/action — 5 ans", target: "> 10 %/an", unit: "%", chart: "bar",
      why: "Le FCF par action capture la trésorerie réellement générée pour chaque action, dilution comprise. Sa croissance est le moteur du rendement long terme.",
      calc: "CAGR du free cash-flow par action sur 5 ans.", ...values.croissance_fcf },
    { key: "marge_fcf", label: "Marge de FCF (ajustée)", target: "> 12 %", unit: "%", chart: "line",
      why: "Part du chiffre d'affaires convertie en trésorerie libre. Un niveau élevé indique un modèle peu gourmand en capital.",
      calc: "Free cash-flow ajusté ÷ chiffre d'affaires.", ...values.marge_fcf },
    { key: "operating_leverage", label: "Operating leverage", target: "> 1,0×", unit: "×", chart: "line",
      why: "Mesure si les profits croissent plus vite que le CA — signe d'un effet d'échelle qui s'amplifie avec la taille.",
      calc: "Croissance du résultat opérationnel ÷ croissance du CA.", ...values.operating_leverage },
    { key: "cash_roce", label: "Cash ROCE", target: "> 15 %", unit: "%", chart: "line",
      why: "Rendement en cash des capitaux employés : combien de trésorerie l'entreprise tire de chaque euro investi dans l'activité.",
      calc: "Free cash-flow ÷ capitaux employés (dette nette + fonds propres).", ...values.cash_roce },
    { key: "dette_fcf", label: "Dette nette / FCF", target: "< 3,0×", unit: "×", chart: "line",
      why: "Nombre d'années de free cash-flow nécessaires pour rembourser la dette nette. Plus c'est bas, plus le bilan est solide.",
      calc: "Dette nette ÷ free cash-flow annuel.", ...values.dette_fcf },
    { key: "cash_conversion", label: "Cash Conversion Rate", target: "> 90 %", unit: "%", chart: "line",
      why: "Capacité à transformer le bénéfice comptable en cash réel. Un ratio proche ou supérieur à 100 % indique des bénéfices de qualité.",
      calc: "Free cash-flow ÷ résultat net.", ...values.cash_conversion },
    { key: "current_ratio", label: "Current Ratio", target: "> 1,5×", unit: "×", chart: "line",
      why: "Liquidité court terme : l'actif courant couvre-t-il le passif courant ? Au-dessus de 1,5× la trésorerie immédiate est confortable.",
      calc: "Actif courant ÷ passif courant.", ...values.current_ratio },
    { key: "p_fcf", label: "P/FCF actuel", target: "< 25×", unit: "×", chart: "line",
      why: "Prix payé pour chaque euro de free cash-flow. C'est un repère de valorisation — jugé séparément de la qualité du business.",
      calc: "Capitalisation boursière ÷ free cash-flow annuel.", ...values.p_fcf },
  ];
}

// — Société A : HLMS (compounder, ~9/10) —
const HLMS = {
  ticker: "HLMS",
  name: "Helios Microsystems",
  sector: "Semi-conducteurs · Calcul",
  country: "US",
  price: 284.16,
  change: 1.84,
  changeAbs: 5.14,
  currency: "$",
  score: 9,
  verdict: "Business de très grande qualité, généreux en cash et peu endetté. La valorisation reste le seul point de vigilance.",
  marketCap: "412,8 Md$",
  fcfYield: "3,1 %",
  priceSeed: 7,
  criteria: criteria({
    marge_nette:        { value: "31,4 %",  status: "good", note: "Marge nette élevée et en expansion, soutenue par un fort pricing power." },
    croissance_ca:      { value: "+24,8 %", status: "good", note: "Croissance à deux chiffres soutenue sur tout le cycle." },
    croissance_fcf:     { value: "+29,1 %", status: "good", note: "Le FCF/action croît plus vite que le CA — effet de levier." },
    marge_fcf:          { value: "27,6 %",  status: "good", note: "Modèle asset-light : forte conversion en cash." },
    operating_leverage: { value: "1,38×",   status: "good", note: "Les profits accélèrent plus vite que le chiffre d'affaires." },
    cash_roce:          { value: "34,2 %",  status: "good", note: "Rendement du capital exceptionnel et durable." },
    dette_fcf:          { value: "0,4×",    status: "good", note: "Bilan quasi sans dette nette." },
    cash_conversion:    { value: "104 %",   status: "good", note: "Bénéfices intégralement convertis en cash." },
    current_ratio:      { value: "2,1×",    status: "good", note: "Liquidité court terme très confortable." },
    p_fcf:              { value: "32,4×",   status: "warn", note: "Valorisation exigeante — qualité déjà bien payée." },
  }),
  earnings: {
    last: { date: "24 avr. 2026", epsActual: 4.86, epsExpected: 4.51, surprise: 7.8, revActual: "18,4 Md$", revSurprise: 3.2 },
    next: { date: "23 juil. 2026", epsExpected: 5.12, inDays: 53 },
    history: [
      { q: "T2 25", a: 3.41, e: 3.30 }, { q: "T3 25", a: 3.78, e: 3.62 },
      { q: "T4 25", a: 4.22, e: 4.05 }, { q: "T1 26", a: 4.86, e: 4.51 },
    ],
  },
  valuation: { eps: 17.2, fcfPerShare: 8.7, growth: 18, exitMultiple: 24, targetReturn: 12 },
  qualBusiness: [
    { label: "Moat (avantage concurrentiel)", status: "good", note: "Écosystème logiciel propriétaire difficile à répliquer." },
    { label: "Asset light", status: "good", note: "Fabrication externalisée, faibles besoins en capital." },
    { label: "Marché en croissance", status: "good", note: "Demande structurelle tirée par le calcul accéléré." },
    { label: "Revenus prévisibles", status: "warn", note: "Part récurrente en hausse mais reste cyclique." },
    { label: "Pricing power", status: "good", note: "Capacité démontrée à augmenter les prix." },
    { label: "Diversification clients", status: "warn", note: "Concentration sur quelques grands comptes." },
    { label: "Barrières à l'entrée", status: "good", note: "R&D et propriété intellectuelle considérables." },
    { label: "Scalabilité", status: "good", note: "Coûts marginaux faibles à mesure du volume." },
    { label: "Effets de réseau", status: "good", note: "Plateforme renforcée par sa base de développeurs." },
    { label: "Résilience aux cycles", status: "warn", note: "Sensible aux cycles d'investissement." },
  ],
  qualMgmt: [
    { label: "Allocation du capital", status: "good", note: "Rachats opportunistes et R&D disciplinée." },
    { label: "Ancienneté du CEO", status: "good", note: "Fondateur toujours aux commandes depuis 28 ans." },
    { label: "Skin in the game", status: "good", note: "Dirigeants détiennent une part significative." },
    { label: "Transparence", status: "good", note: "Communication financière claire et constante." },
    { label: "Track record", status: "good", note: "Création de valeur soutenue sur deux décennies." },
  ],
  news: [
    { src: "Reuters", time: "il y a 2 h", title: "Helios dévoile sa nouvelle architecture, marges revues à la hausse" },
    { src: "Bloomberg", time: "il y a 6 h", title: "Les commandes du segment data center dépassent les attentes" },
    { src: "Financial Times", time: "Hier", title: "Le fondateur réaffirme sa stratégie d'allocation du capital" },
  ],
};

// — Société B : BRND (moyen, ~5/10) —
const BRND = {
  ticker: "BRND",
  name: "Brandt Industrials",
  sector: "Industrie · Équipements",
  country: "US",
  price: 58.92,
  change: -0.74,
  changeAbs: -0.44,
  currency: "$",
  score: 5,
  verdict: "Entreprise correcte mais sans avantage marqué : croissance molle et bilan tendu pèsent sur la note. Prix raisonnable.",
  marketCap: "14,2 Md$",
  fcfYield: "5,4 %",
  priceSeed: 19,
  criteria: criteria({
    marge_nette:        { value: "8,2 %",   status: "warn", note: "Marge correcte mais sans pouvoir de fixation des prix." },
    croissance_ca:      { value: "+4,1 %",  status: "bad",  note: "Croissance atone, proche de l'inflation." },
    croissance_fcf:     { value: "+2,7 %",  status: "bad",  note: "Le FCF/action stagne sur la période." },
    marge_fcf:          { value: "9,8 %",   status: "warn", note: "Conversion en cash moyenne, alourdie par le capex." },
    operating_leverage: { value: "0,82×",   status: "bad",  note: "Les coûts progressent plus vite que le CA." },
    cash_roce:          { value: "11,4 %",  status: "warn", note: "Rendement du capital sous le seuil de qualité." },
    dette_fcf:          { value: "4,2×",    status: "bad",  note: "Endettement élevé au regard du cash généré." },
    cash_conversion:    { value: "78 %",    status: "warn", note: "Une partie du bénéfice ne se transforme pas en cash." },
    current_ratio:      { value: "1,6×",    status: "good", note: "Liquidité court terme adéquate." },
    p_fcf:              { value: "18,5×",   status: "good", note: "Valorisation raisonnable — point favorable." },
  }),
  earnings: {
    last: { date: "29 avr. 2026", epsActual: 1.12, epsExpected: 1.19, surprise: -5.9, revActual: "3,6 Md$", revSurprise: -1.4 },
    next: { date: "30 juil. 2026", epsExpected: 1.21, inDays: 60 },
    history: [
      { q: "T2 25", a: 1.08, e: 1.05 }, { q: "T3 25", a: 1.14, e: 1.16 },
      { q: "T4 25", a: 1.21, e: 1.18 }, { q: "T1 26", a: 1.12, e: 1.19 },
    ],
  },
  valuation: { eps: 4.6, fcfPerShare: 3.2, growth: 5, exitMultiple: 15, targetReturn: 12 },
  qualBusiness: [
    { label: "Moat (avantage concurrentiel)", status: "warn", note: "Position installée mais peu différenciée." },
    { label: "Asset light", status: "bad", note: "Forte intensité capitalistique (usines)." },
    { label: "Marché en croissance", status: "warn", note: "Marché mûr, croissance lente." },
    { label: "Revenus prévisibles", status: "good", note: "Carnet de commandes et contrats pluriannuels." },
    { label: "Pricing power", status: "bad", note: "Marché concurrentiel, prix subis." },
    { label: "Diversification clients", status: "good", note: "Base clients large et diversifiée." },
    { label: "Barrières à l'entrée", status: "warn", note: "Modérées, liées à l'outil industriel." },
    { label: "Scalabilité", status: "bad", note: "Croissance gourmande en capital." },
    { label: "Effets de réseau", status: "bad", note: "Absents sur ce modèle." },
    { label: "Résilience aux cycles", status: "warn", note: "Exposé au cycle industriel." },
  ],
  qualMgmt: [
    { label: "Allocation du capital", status: "warn", note: "Dividende généreux mais peu de réinvestissement." },
    { label: "Ancienneté du CEO", status: "warn", note: "En poste depuis 3 ans, track record court." },
    { label: "Skin in the game", status: "bad", note: "Détention des dirigeants faible." },
    { label: "Transparence", status: "good", note: "Reporting standard et régulier." },
    { label: "Track record", status: "warn", note: "Performances inégales sur le cycle." },
  ],
  news: [
    { src: "Reuters", time: "il y a 4 h", title: "Brandt revoit ses prévisions annuelles légèrement à la baisse" },
    { src: "Les Échos", time: "il y a 9 h", title: "Plan d'économies annoncé pour soutenir les marges" },
    { src: "Bloomberg", time: "Hier", title: "Le titre sous pression après des résultats trimestriels mitigés" },
  ],
};

const COMPANIES = { HLMS, BRND };

// — Univers du screener / vitrine "les mieux notées" —
const UNIVERSE = [
  { ticker: "HLMS", name: "Helios Microsystems", sector: "Semi-conducteurs", score: 10, pfcf: 32.4, price: 284.16, change: 1.84, mcap: "412,8 Md$" },
  { ticker: "NVTA", name: "Novanta Cloud", sector: "Logiciel", score: 10, pfcf: 29.1, price: 612.40, change: 0.92, mcap: "188,0 Md$" },
  { ticker: "ARTE", name: "Arteon Payments", sector: "Paiements", score: 10, pfcf: 27.7, price: 91.05, change: 2.31, mcap: "96,4 Md$" },
  { ticker: "LUMA", name: "Lumadex Health", sector: "Santé", score: 9, pfcf: 24.8, price: 145.22, change: -0.41, mcap: "61,2 Md$" },
  { ticker: "VELO", name: "Velora Logistics", sector: "Transport", score: 9, pfcf: 19.4, price: 78.10, change: 0.55, mcap: "33,9 Md$" },
  { ticker: "QDRA", name: "Quadra Analytics", sector: "Logiciel", score: 9, pfcf: 31.2, price: 220.77, change: 1.12, mcap: "44,1 Md$" },
  { ticker: "SOLA", name: "Solaris Energy", sector: "Énergie", score: 8, pfcf: 14.6, price: 52.34, change: -1.20, mcap: "21,8 Md$" },
  { ticker: "MERI", name: "Meridian Foods", sector: "Conso. de base", score: 8, pfcf: 21.0, price: 119.88, change: 0.18, mcap: "38,5 Md$" },
  { ticker: "KORE", name: "Korewave Audio", sector: "Conso. discrét.", score: 7, pfcf: 16.9, price: 64.50, change: 0.74, mcap: "12,3 Md$" },
  { ticker: "FERN", name: "Fernhill Capital", sector: "Finance", score: 7, pfcf: 11.3, price: 88.20, change: -0.33, mcap: "29,7 Md$" },
  { ticker: "ORBI", name: "Orbion Space", sector: "Aérospatial", score: 6, pfcf: 38.5, price: 41.66, change: 3.02, mcap: "9,1 Md$" },
  { ticker: "BRND", name: "Brandt Industrials", sector: "Industrie", score: 5, pfcf: 18.5, price: 58.92, change: -0.74, mcap: "14,2 Md$" },
  { ticker: "TIDE", name: "Tidewater Marine", sector: "Industrie", score: 5, pfcf: 9.8, price: 33.10, change: -0.92, mcap: "5,4 Md$" },
  { ticker: "PALD", name: "Palladio Retail", sector: "Distribution", score: 4, pfcf: 22.6, price: 27.45, change: 0.40, mcap: "6,8 Md$" },
];

// — Watchlist initiale —
const WATCHLIST_INIT = [
  { ticker: "HLMS", name: "Helios Microsystems", price: 284.16, change: 1.84, pfcf: 32.4, score: 10, nextEarnings: "23 juil. 2026" },
  { ticker: "ARTE", name: "Arteon Payments", price: 91.05, change: 2.31, pfcf: 27.7, score: 10, nextEarnings: "12 août 2026" },
  { ticker: "LUMA", name: "Lumadex Health", price: 145.22, change: -0.41, pfcf: 24.8, score: 9, nextEarnings: "05 août 2026" },
  { ticker: "SOLA", name: "Solaris Energy", price: 52.34, change: -1.20, pfcf: 14.6, score: 8, nextEarnings: "29 juil. 2026" },
  { ticker: "BRND", name: "Brandt Industrials", price: 58.92, change: -0.74, pfcf: 18.5, score: 5, nextEarnings: "30 juil. 2026" },
];

// — Données graphiques par critère (pour la modale) —
// Génère barres trimestrielles (flux) ou courbes (ratios) avec quelques trous.
function makeCriterionSeries(seed, type, base, n) {
  if (type === "bar") return quarterly(seed, n, base * 0.45, 0.05, 0.16, [n - 9, n - 8]);
  return ratioSeries(seed, n, base, 0.4, 3.2, [n - 11, n - 10]);
}

// Cours sur plusieurs horizons
function priceHorizons(seed, base) {
  return {
    "1A": priceSeries(seed + 1, 52, base * 0.78, 0.005, 0.045).map((v, i) => v),
    "5A": priceSeries(seed + 2, 60, base * 0.32, 0.018, 0.06),
    "10A": priceSeries(seed + 3, 80, base * 0.12, 0.026, 0.07),
    "Tout": priceSeries(seed + 4, 110, base * 0.05, 0.03, 0.08),
  };
}

window.LUBIN_DATA = {
  COMPANIES, UNIVERSE, WATCHLIST_INIT,
  makeCriterionSeries, priceHorizons, rng,
};
