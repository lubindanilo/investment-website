import type { CompanyBrief } from './resilienceStars.js';

/**
 * Jeu de non-regression du modele 5 etoiles.
 *
 * - CALIBRATED : 20 entreprises deja notees par Lubin, `expected` = la note
 *   calibree (apres la seule correction universelle pharma/optionalite).
 * - FRESH : 18 entreprises de la cohorte aveugle acceptee globalement par Lubin,
 *   `expected` = la note produite par le modele et validee.
 *
 * On tolere +-0,5 etoile (la resolution du modele). Le brief fournit les FAITS ;
 * le bareme (prompt) fournit le JUGEMENT.
 */
export interface ResilienceFixture extends CompanyBrief {
  expected: number;
}

export const STAR_TOLERANCE = 0.5;

export const CALIBRATED: ResilienceFixture[] = [
  { name: "Alphabet (Google)", expected: 4.5, brief: "Search+ads+YouTube+Android+Cloud+stack IA (Gemini/TPU). Menace: agents IA sur le search. Revenus concentres pub." },
  { name: "S&P Global", expected: 5.0, brief: "Notation de credit (oligopole regule) + indices (IP) + donnees financieres. Financiarisation croissante." },
  { name: "NextEra Energy", expected: 4.5, brief: "Utility regulee + plus grande flotte renouvelables US. Demande electrique en hausse (datacenters, electrification)." },
  { name: "Apple", expected: 4.0, brief: "Marque premium tres forte + ecosysteme + installed base + services. En retard sur IA. Exposition/concurrence Chine hardware, largement mitigee." },
  { name: "Booking Holdings", expected: 3.5, brief: "Marketplace voyage, liquidite/profondeur hotels. Les agents peuvent changer l'interface mais ont besoin de l'inventaire. Dependance trafic Google." },
  { name: "Palantir", expected: 4.0, brief: "Plateforme donnees/ops (Foundry/AIP), ontologie, permissions, integrations d'action, relations gouvernementales. Plan de controle utile aux agents." },
  { name: "Netflix", expected: 3.5, brief: "Streaming: marque, distribution, recommandation, echelle. Dependance au contenu (cout), concurrence forte. Abonnement collant, pricing power prouve." },
  { name: "JPMorgan", expected: 4.0, brief: "Banque universelle: bilan-forteresse, systemique, depots collants, flux/conservation, cartes, marches, techno. Cycle credit/taux. Le secteur bancaire se concentre." },
  { name: "Meta", expected: 4.0, brief: "Graphe social + attention + enchere pub + 3B+ utilisateurs. Manie l'IA a fond (pub, contenu). Paris metaverse non prouves. Dependance plateforme (ATT), regulation." },
  { name: "Walmart", expected: 3.5, brief: "Parc magasins CONVERTI en fulfillment/dernier km + retail media + donnee. Essentiels/grocery. Concurrence Amazon + Chine directe. Marges minces." },
  { name: "BYD", expected: 3.5, brief: "Constructeur EV chinois integre verticalement (batterie-vehicule), couts bas, immense base domestique. Moteur = cout/capacite. Guerre des prix, tariffs occidentaux." },
  { name: "Boeing", expected: 3.5, brief: "Duopole aeronautique (avec Airbus), certification, savoir-faire qualifie, actifs. Montee de COMAC (Chine). Crises qualite/securite + dette (fragilite propre)." },
  { name: "Uber", expected: 3.0, brief: "Plateforme mobilite/livraison, algo/matching/densite, liquidite reseau. Baisse voiture individuelle = tailwind. AV (robotaxi) menace ET opportunite, non controle. Dependance conducteurs." },
  { name: "Medpace", expected: 3.0, brief: "CRO (essais cliniques). Plus de recherche IA = plus d'essais. Switching costs pendant un essai actif, execution regulee. Les concurrents gagnent les nouveaux mandats (pas de moat large)." },
  { name: "Adobe", expected: 3.0, brief: "Outils creatifs (formats, IP, distribution) + Document Cloud. IA generative (concurrents) menace une partie du workflow. Repond avec Firefly. Abonnement." },
  { name: "PayPal", expected: 2.5, brief: "Paiements/checkout, reseau deux faces, Venmo. Fortement conteste (Apple Pay, Stripe, banques). Bouton checkout replicable. Compression du take-rate." },
  { name: "Salesforce", expected: 2.0, brief: "CRM entreprise. Les grandes entreprises pourraient reconstruire leur CRM avec des agents; le client possede donnees/config. Plateforme (Slack, Tableau). La demande payee du CRM standalone se contracte." },
  { name: "Tesla", expected: 3.0, brief: "Auto EV: marque forte (mais image Musk), tech/software, GROS parc de voitures, reseau de recharge. Coeur auto menace par les Chinois moins chers. Robotaxi/Optimus NON prouves. Mieux place que quiconque pour recharge/energie grace au parc." },
  { name: "Novo Nordisk", expected: 2.0, brief: "Pharma obesite/diabete (GLP-1). Demande en forte hausse. MAIS brevets cles GLP-1 expirant vers 2031-2032, donc pas de visibilite majoritaire jusqu'en 2033. Concurrence (Lilly), oraux, biosimilaires." },
  { name: "AbbVie", expected: 2.5, brief: "Pharma immunologie. Humira tombe (biosimilaires), relais Skyrizi/Rinvoq avec brevets partiels dans les annees 2030 (visibilite seulement partielle). Demande sante persiste." },
];

export const FRESH: ResilienceFixture[] = [
  { name: "Eli Lilly", expected: 3.5, brief: "Pharma; leader obesite/diabete (GLP-1), pipeline profond et brevets s'etendant plus loin que Novo (visibilite au-dela de 2033 sur plusieurs actifs), fabrication massive. Demande obesite en forte hausse." },
  { name: "Ferrari", expected: 4.0, brief: "Marque de luxe automobile statutaire, rarete volontaire, liste d'attente, pricing power extreme, clientele ultra-fidele. Peu expose au prix/Chine (statut, pas rapport qualite-prix)." },
  { name: "Arm Holdings", expected: 3.0, brief: "Architecture de puces sous licence (IP), quasi-standard mobile, presence croissante datacenter/IA, royalties. RISC-V open source = menace long terme." },
  { name: "ServiceNow", expected: 2.5, brief: "Plateforme de workflow d'entreprise, systeme d'enregistrement + integrations profondes. Risque: agents IA reconstruisant les workflows; opportunite: couche d'orchestration IA de l'entreprise." },
  { name: "Shopify", expected: 2.5, brief: "Infrastructure e-commerce pour marchands (paiements, checkout, logistique partenaire), donnees marchands. Concurrence Amazon; depend des marchands qui peuvent partir." },
  { name: "Nike", expected: 2.5, brief: "Marque sportive mondiale, desir/statut, distribution. Concurrence (On, Hoka), montee des marques chinoises, exposition Chine, execution DTC en difficulte recente." },
  { name: "Starbucks", expected: 2.0, brief: "Marque cafe + reseau de magasins + appli/loyalty + donnees, habitude quotidienne. Exposition Chine (Luckin moins cher), main-d'oeuvre, saturation." },
  { name: "McDonald's", expected: 4.0, brief: "Marque mondiale + franchise + immobilier (foncier) + echelle d'achat + drive/appli. Modele immobilier-franchise tres capte. Automatisation possible. Demande fast-food persistante." },
  { name: "Intuit", expected: 2.5, brief: "Logiciels PME/particuliers (TurboTax, QuickBooks), donnees financieres + reseau comptable + switching costs. Risque: agents IA automatisant compta/impots; Intuit pousse l'IA." },
  { name: "Deere (John Deere)", expected: 4.0, brief: "Equipement agricole; marque + reseau de concessionnaires + donnees agronomiques + autonomie/precision (moat data croissant). Cyclique. Right-to-repair et concurrence." },
  { name: "BlackRock", expected: 3.5, brief: "Plus grand gestionnaire d'actifs; ETF iShares (echelle), plateforme Aladdin (risque/operations, utilisee par des tiers), capte les flux de financiarisation. Compression des frais." },
  { name: "Spotify", expected: 2.0, brief: "Streaming musical, base d'abonnes + recommandation + podcasts. Dependance aux labels (cout des droits), concurrence Apple/Amazon, faible pricing power historique." },
  { name: "UnitedHealth", expected: 4.0, brief: "Assurance sante US + Optum (services, donnees, PBM, soins), echelle massive, integration verticale. Regulation, sentiment politique. Demande soins en hausse (vieillissement)." },
  { name: "Chipotle", expected: 2.5, brief: "Chaine de restauration; marque + qualite percue + execution + appli/loyalty. Automatisation cuisine testee. Tout en propre (pas de franchise). Concurrence, couts." },
  { name: "Peloton", expected: 0.5, brief: "Fitness connecte (velo + abonnement). Pic pandemie retombe, materiel cher, marque affaiblie, concurrence des apps fitness generiques, dette. Moat faible." },
  { name: "Warner Bros Discovery", expected: 1.0, brief: "Media legacy (studios, cable en declin, streaming Max). Bibliotheque de contenu (IP) reelle MAIS declin du cable, dette lourde, concurrence streaming intense." },
  { name: "Delta Air Lines", expected: 2.0, brief: "Compagnie aerienne; hubs/slots (actif rare) + programme fidelite co-brand (capture reelle) + marque premium relative. Cyclique, capital-intensif, carburant, concurrence." },
  { name: "Carvana", expected: 0.5, brief: "E-commerce de voitures d'occasion (vending machines, logistique). Croissance + experience, MAIS pas de moat durable evident, marges fines, dette elevee, replicable, cyclique." },
];

export const ALL_FIXTURES: ResilienceFixture[] = [...CALIBRATED, ...FRESH];
