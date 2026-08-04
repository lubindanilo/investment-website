import type { CompanyBrief } from './resilienceStars.js';

/**
 * Cohorte fraiche de 20 entreprises, distinctes de tous les sets precedents
 * (calibrees, fresh-18, top-20). Sert a comparer les modeles (Sonnet vs
 * DeepSeek-V3 vs DeepSeek-R1) sur de l'inedit.
 */
export const FRESH20_COHORT: CompanyBrief[] = [
  { name: 'Coca-Cola', brief: "Marque mondiale iconique + systeme de concentre/embouteilleurs + distribution inegalee. Tendance sante anti-sucre, mais marque et reseau tres durables, pricing power." },
  { name: 'American Express', brief: "Reseau de paiement en boucle fermee + marque premium + clientele aisee + credit. Effets de reseau et donnees; concurrence Visa/Mastercard/fintech." },
  { name: 'Home Depot', brief: "Distribution bricolage a grande echelle + clientele pro (contractants) + supply chain + implantation. Cyclique (immobilier); peu menace par Amazon (volumineux, pro, urgence)." },
  { name: 'GE Aerospace', brief: "Moteurs d'avion (duopole avec Rolls/Pratt) + aftermarket/services tres rentable + installed base + certification. Montee COMAC (Chine) a long terme." },
  { name: 'AMD', brief: "CPU/GPU; gagne des parts mais domination NVIDIA en IA, dependance TSMC, concurrence custom silicon des hyperscalers et montee chinoise." },
  { name: 'Disney', brief: "Franchises IP + parcs (actifs physiques rares) + studios + streaming. Declin du cable, pertes streaming, cout du contenu, succession/execution." },
  { name: 'Qualcomm', brief: "IP puces mobiles + licences (brevets) + modems. Apple internalise ses modems, maturite smartphone, exposition Chine; diversification auto/IoT." },
  { name: 'Lululemon', brief: "Marque athleisure premium + DTC + communaute. Concurrence montante (Alo, Vuori), croissance qui ralentit, marque peut-etre a son pic." },
  { name: 'Chevron', brief: "Petrole/gaz integre + reserves + raffinage. Price taker (prix mondial), transition energetique = declin structurel long terme; actifs reels." },
  { name: 'Stryker', brief: "Medtech (ortho, robotique chirurgicale Mako) + relations hopitaux + installed base + consommables recurrents. Regule, switching costs, robotique = tailwind." },
  { name: 'Snowflake', brief: "Entrepot/plateforme de donnees cloud (modele a la consommation). Concurrence Databricks + hyperscalers; les agents IA pourraient deplacer la couche d'acces aux donnees." },
  { name: 'CrowdStrike', brief: "Cybersecurite cloud (endpoint/XDR) + effets de reseau de donnees de menaces. Surface d'attaque croissante = tailwind; concurrence Microsoft/Palo Alto." },
  { name: 'Block (Square)', brief: "Paiements PME (Square) + Cash App. Forte concurrence (Stripe, PayPal, Apple, banques), moat limite, migration possible des marchands." },
  { name: 'Micron', brief: "Memoire (DRAM/NAND); commodite tres cyclique, guerre des prix, montee capacite chinoise (CXMT/YMTC). HBM pour l'IA = poche premium temporaire." },
  { name: 'Ford', brief: "Constructeur legacy; pertes sur la transition EV, concurrence Chine/BYD, capital-intensif. Marque forte sur les pickups (F-150), franchise commerciale." },
  { name: 'Rivian', brief: "Startup EV (pickups/SUV, fourgons Amazon); echelle et rentabilite non prouvees, forte consommation de cash, concurrence, fragilite financiere." },
  { name: 'Coinbase', brief: "Plateforme d'echange crypto US regulee; revenus tres volatils (frais de trading), regulation, concurrence; leader reglemente mais dependance au cycle crypto." },
  { name: 'Kraft Heinz', brief: "Alimentaire emballe; marques vieillissantes face aux marques de distributeur et aux tendances sante, pricing power erode, modele de reduction de couts." },
  { name: 'Zoom', brief: "Visioconference; commoditisee (Teams/Meet inclus dans les suites), plateau post-pandemie, moat faible, tentative de pivot vers une plateforme de travail IA." },
  { name: 'T-Mobile US', brief: "Operateur mobile US; spectre (actif regule rare) + reseau + echelle apres la fusion Sprint. Capital-intensif, oligopole a 3, position 5G solide." },
];
