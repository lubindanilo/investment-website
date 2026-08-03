import type { UniverseEntry } from './resilienceStarsCron.js';

/**
 * Univers de TEST : les ~20 plus grosses capitalisations mondiales cotees
 * (capis approximatives en USD, pour l'ordre uniquement). Sert a voir le cron
 * tourner en live sur une cohorte de 20. L'univers de production sera derive
 * dynamiquement de sp500Universe + market cap Finnhub (etape suivante).
 */
export const TOP20_UNIVERSE: UniverseEntry[] = [
  { ticker: 'AAPL', name: 'Apple', marketCapUsd: 3.4e12, brief: "Marque premium tres forte + ecosysteme + installed base + services. En retard sur IA. Exposition/concurrence Chine hardware largement mitigee." },
  { ticker: 'MSFT', name: 'Microsoft', marketCapUsd: 3.3e12, brief: "Windows/Office/Azure/identite/GitHub, indispensables. Manie l'IA (Copilot, OpenAI). Cloud + agents renforcent. Capture diversifiee durable." },
  { ticker: 'NVDA', name: 'NVIDIA', marketCapUsd: 3.2e12, brief: "GPU + CUDA (lock-in logiciel) au coeur de l'IA. Demande explosive. Dependances de production (TSMC), concurrence custom silicon a terme." },
  { ticker: 'GOOGL', name: 'Alphabet (Google)', marketCapUsd: 2.3e12, brief: "Search+ads+YouTube+Android+Cloud+stack IA (Gemini/TPU). Menace: agents IA sur le search. Revenus concentres pub." },
  { ticker: 'AMZN', name: 'Amazon', marketCapUsd: 2.1e12, brief: "Marketplace + fulfillment/logistique possedee + Prime + AWS (infra cloud) + retail media. Manie l'IA. Absorbe massivement l'adjacent. Marges retail minces, regulation." },
  { ticker: 'META', name: 'Meta', marketCapUsd: 1.4e12, brief: "Graphe social + attention + enchere pub + 3B+ utilisateurs. Manie l'IA a fond. Paris metaverse non prouves. Dependance plateforme (ATT), regulation." },
  { ticker: 'AVGO', name: 'Broadcom', marketCapUsd: 1.1e12, brief: "Semi-conducteurs (ASIC custom IA, networking) + logiciels d'infrastructure (VMware). Relations clients hyperscalers profondes, IP. Concurrence, cyclicite." },
  { ticker: 'TSM', name: 'TSMC', marketCapUsd: 1.0e12, brief: "Fonderie de pointe quasi-monopolistique (noeuds avances), capacite et savoir-faire rares, indispensable a toute l'IA. Risque geopolitique Taiwan/Chine." },
  { ticker: 'BRK', name: 'Berkshire Hathaway', marketCapUsd: 1.0e12, brief: "Conglomerat: assurance (float), rail (BNSF), energie, participations. Actifs reels + allocation de capital. Diversifie mais pas de goulot systemique unique." },
  { ticker: 'LLY', name: 'Eli Lilly', marketCapUsd: 0.85e12, brief: "Pharma; leader obesite/diabete (GLP-1), pipeline profond et brevets s'etendant au-dela de 2033 sur plusieurs actifs, fabrication massive. Demande obesite en forte hausse." },
  { ticker: 'TSLA', name: 'Tesla', marketCapUsd: 0.8e12, brief: "Auto EV: marque forte (image Musk), tech/software, GROS parc, reseau de recharge. Coeur auto menace par les Chinois moins chers. Robotaxi/Optimus non prouves. Mieux place pour recharge/energie grace au parc." },
  { ticker: 'WMT', name: 'Walmart', marketCapUsd: 0.7e12, brief: "Parc magasins CONVERTI en fulfillment/dernier km + retail media + donnee. Essentiels/grocery. Concurrence Amazon + Chine directe. Marges minces." },
  { ticker: 'JPM', name: 'JPMorgan', marketCapUsd: 0.65e12, brief: "Banque universelle: bilan-forteresse, systemique, depots collants, flux/conservation, cartes, marches, techno. Cycle credit/taux. Le secteur bancaire se concentre." },
  { ticker: 'V', name: 'Visa', marketCapUsd: 0.58e12, brief: "Reseau de paiement (duopole avec Mastercard), rails indispensables, effets de reseau. Fintech/stablecoins pressent l'interface sans absorber le rail. Take-rate durable." },
  { ticker: 'XOM', name: 'Exxon Mobil', marketCapUsd: 0.52e12, brief: "Petrole/gaz integre + reserves + raffinage + petrochimie. Demande fossile decline a long terme mais persiste; actifs reels. Transition energetique = menace structurelle." },
  { ticker: 'ORCL', name: 'Oracle', marketCapUsd: 0.5e12, brief: "Bases de donnees d'entreprise (switching costs eleves) + cloud OCI en croissance IA. Systeme d'enregistrement critique. Concurrence hyperscalers, migration possible." },
  { ticker: 'MA', name: 'Mastercard', marketCapUsd: 0.48e12, brief: "Reseau de paiement (duopole avec Visa), rails indispensables, effets de reseau, services a valeur ajoutee. Fintech/stablecoins pressent l'interface. Take-rate durable." },
  { ticker: 'COST', name: 'Costco', marketCapUsd: 0.42e12, brief: "Distribution: membership tres collant (renouvellement ~90%), echelle d'achat, marque de valeur/confiance. Peu d'aspiration adjacente. Marges volontairement basses." },
  { ticker: 'NFLX', name: 'Netflix', marketCapUsd: 0.4e12, brief: "Streaming: marque, distribution, recommandation, echelle. Dependance au contenu (cout), concurrence forte. Abonnement collant, pricing power prouve." },
  { ticker: 'JNJ', name: 'Johnson & Johnson', marketCapUsd: 0.38e12, brief: "Pharma + medtech diversifie, portefeuille large, marques, R&D, distribution. Falaises de brevets ponctuelles mais portefeuille renouvele. Demande sante persistante." },
];
