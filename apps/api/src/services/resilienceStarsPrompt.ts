import type { CompanyBrief } from './resilienceStars.js';

/**
 * Baremes du modele Resilience 5 etoiles (spec canonique cote Vault :
 * lubin-investment-resilience-modele-5-etoiles.md). Cette recette a reproduit
 * 18/20 des grades valides et une cohorte aveugle acceptee par Lubin.
 *
 * Le LLM ne choisit jamais la note finale : il remplit un contrat JSON par
 * critere, le score total est agrege de maniere deterministe cote TypeScript.
 */
export const RESILIENCE_RUBRIC = `Tu es un scoreur du modèle Résilience (Lubin Investment). Tu notes la place économique d'une entreprise dans le monde de 2033 (IA et agents partout, robotique très avancée, forte montée industrielle chinoise, compression des interfaces/logiciels reproductibles). Tu ne mesures NI la valorisation NI la qualité passée. Marges, croissance, FCF, bilan présent ne donnent AUCUN point.

Tu notes 5 critères, chacun vaut 0, 0.5 ou 1 (rien d'autre). Total = somme, de 0 à 5. ÉCHELLE ABSOLUE, jamais à la courbe. Un 4/5 doit valoir la même chose dans tous les secteurs.

CRITÈRES:
1. besoin — la demande PAYÉE du rôle du secteur survit-elle et grandit-elle en 2033 (pas la simple existence d'un besoin humain)? 0 = la demande payée du rôle s'effondre. 0.5 = persiste mais se contracte/se banalise. 1 = persiste et croît structurellement.
2. controle — un contrôle propre, rare, dur à contourner sur la MAJORITÉ du cœur (actif rare, droit régulé, liquidité de réseau, stack/donnée propriétaire, installed base, marque de préférence, réseau physique CONVERTI en fulfillment/donnée)? 0 = aucun, hors cœur, interface reconstructible, ou actif possédé NON converti. 0.5 = réel mais étroit/contesté/réplicable sous ~5 ans. 1 = rare, couvre la majorité du cœur, dur à contourner même par agents. Une marque de préférence compte (test: à produit identique moins cher en face, le client reste et paie plus; simple notoriété = 0). RÈGLE: un droit temporaire (brevet) SANS visibilité explicite jusqu'en 2033 plafonne à 0.
3. forces — tient face aux 3 forces (IA/agents, robotique, Chine)? 0 = une force absorbe plausiblement >50% du rôle sans réponse contrôlée. 0.5 = neutre/mitigé. 1 = au moins DEUX forces la renforcent. RÈGLE: une force qui change/banalise l'INTERFACE n'absorbe pas le rôle si l'entreprise garde l'inventaire, l'actif, la donnée, le réseau ou le plan de contrôle sous-jacent (0 seulement si le CŒUR est absorbé). RÈGLE: une entreprise qui POSSÈDE les modèles IA, l'infra, la boucle de données ou le graphe est RENFORCÉE par l'IA.
4. adjacent — sa base installée la place-t-elle mieux qu'un pur-player pour absorber les besoins voisins et livrer l'outcome? 0 = pur-player, plutôt absorbé. 0.5 = avantage adjacent réel mais partiel. 1 = base large qui absorbe l'adjacent et livre le résultat. RÈGLE: crédite QUE l'adjacent réalisé ou quasi-certain, JAMAIS une option spéculative non prouvée (ex. robotaxi).
5. capture — se fait payer durablement (pricing power, switching costs qui tiennent) sans dépendance unique fatale? 0 = capture faible/érodable OU choc unique non mitigé menace la continuité. 0.5 = payée sous pression, dépendance partiellement mitigée. 1 = capture durable + aucune dépendance fatale. RÈGLE: une falaise de brevets/contrat sur la majorité du cœur = choc de continuité => 0.

EXEMPLES NOTÉS (calibrage, format [besoin/controle/forces/adjacent/capture]): Microsoft 5/5 [1/1/1/1/1] · Visa 4/5 [1/1/0.5/0.5/1] · Costco 3/5 [1/0.5/0.5/0/1] · Dropbox 2/5 [0.5/0.5/0/0.5/0.5] · DocuSign 1/5 [0.5/0/0/0/0.5].
Un rôle qui persiste et croît = besoin 1. Une infra, un oligopole régulé, un réseau de paiement, un graphe social, une installed base indispensable = controle 1 et souvent forces 1. Sois sévère sur les interfaces reconstructibles.`;

/**
 * Construit le prompt complet pour noter un lot d'entreprises en un seul appel.
 * Sortie demandee : un tableau JSON, un objet par entreprise, avec pour chaque
 * critere une note `s` (0/0.5/1) et une justification `r` d'une phrase.
 *
 * LES ACCENTS SE JOUENT ICI. Les `r` etaient rendus sans accents sur le site
 * (« Concessions regulees de tres longue duree ») parce que ce prompt etait lui-meme
 * ecrit en francais desaccentue : un modele imite l'orthographe de son contexte. Le bareme
 * ci-dessus est donc accentue, et la consigne le redit explicitement. Les CLES du contrat
 * JSON, elles, restent sans accents (`controle`) : ce sont des identifiants, pas du texte.
 * Filet de securite en aval : parseScores repare ce qui passerait quand meme.
 */
export function buildScoringPrompt(companies: CompanyBrief[]): string {
  const list = companies
    .map((c, i) => `${i + 1}. ${c.name} — ${c.brief}`)
    .join('\n');
  return `${RESILIENCE_RUBRIC}

NOTE CHACUNE des entreprises ci-dessous. Pour chaque critère: "s" = 0, 0.5 ou 1; "r" = UNE phrase claire (~25 mots) qui justifie la note (ex: "extension de chaîne de valeur insuffisante: reste une fonctionnalité isolée, pas un opérateur d'outcome").

ORTHOGRAPHE (obligatoire): les "r" sont publiés tels quels sur un site français. Écris-les en français PARFAITEMENT ACCENTUÉ (é, è, ê, à, ù, ç, ô, î), y compris sur les majuscules (État), et avec les apostrophes (l'IA, jusqu'à). Un "r" sans accents est une réponse invalide. Les CLÉS JSON, elles, restent sans accents.

Réponds UNIQUEMENT en JSON, un TABLEAU, un objet par entreprise dans l'ordre donné:
[{"nom":"...","besoin":{"s":0,"r":"..."},"controle":{"s":0,"r":"..."},"forces":{"s":0,"r":"..."},"adjacent":{"s":0,"r":"..."},"capture":{"s":0,"r":"..."}}]

ENTREPRISES:
${list}`;
}
