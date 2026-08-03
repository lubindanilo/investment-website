import type { CompanyBrief } from './resilienceStars.js';

/**
 * Baremes du modele Resilience 5 etoiles (spec canonique cote Vault :
 * lubin-investment-resilience-modele-5-etoiles.md). Cette recette a reproduit
 * 18/20 des grades valides et une cohorte aveugle acceptee par Lubin.
 *
 * Le LLM ne choisit jamais la note finale : il remplit un contrat JSON par
 * critere, le score total est agrege de maniere deterministe cote TypeScript.
 */
export const RESILIENCE_RUBRIC = `Tu es un scoreur du modele Resilience (Lubin Investment). Tu notes la place economique d'une entreprise dans le monde de 2033 (IA et agents partout, robotique tres avancee, forte montee industrielle chinoise, compression des interfaces/logiciels reproductibles). Tu ne mesures NI la valorisation NI la qualite passee. Marges, croissance, FCF, bilan present ne donnent AUCUN point.

Tu notes 5 criteres, chacun vaut 0, 0.5 ou 1 (rien d'autre). Total = somme, de 0 a 5. ECHELLE ABSOLUE, jamais a la courbe. Un 4/5 doit valoir la meme chose dans tous les secteurs.

CRITERES:
1. besoin — la demande PAYEE du role du secteur survit-elle et grandit-elle en 2033 (pas la simple existence d'un besoin humain)? 0 = la demande payee du role s'effondre. 0.5 = persiste mais se contracte/commoditise. 1 = persiste et croit structurellement.
2. controle — un controle propre, rare, dur a contourner sur la MAJORITE du coeur (actif rare, droit regule, liquidite de reseau, stack/donnee proprietaire, installed base, marque de preference, reseau physique CONVERTI en fulfillment/donnee)? 0 = aucun, hors coeur, interface reconstructible, ou actif possede NON converti. 0.5 = reel mais etroit/conteste/replicable sous ~5 ans. 1 = rare, couvre la majorite du coeur, dur a contourner meme par agents. Une marque de preference compte (test: a produit identique moins cher en face, le client reste et paie plus; simple notoriete = 0). REGLE: un droit temporaire (brevet) SANS visibilite explicite jusqu'en 2033 plafonne a 0.
3. forces — tient face aux 3 forces (IA/agents, robotique, Chine)? 0 = une force absorbe plausiblement >50% du role sans reponse controlee. 0.5 = neutre/mitige. 1 = au moins DEUX forces la renforcent. REGLE: une force qui change/commoditise l'INTERFACE n'absorbe pas le role si l'entreprise garde l'inventaire, l'actif, la donnee, le reseau ou le plan de controle sous-jacent (0 seulement si le COEUR est absorbe). REGLE: une entreprise qui POSSEDE les modeles IA, l'infra, la boucle de donnees ou le graphe est RENFORCEE par l'IA.
4. adjacent — sa base installee la place-t-elle mieux qu'un pur-player pour absorber les besoins voisins et livrer l'outcome? 0 = pur-player, plutot absorbe. 0.5 = avantage adjacent reel mais partiel. 1 = base large qui absorbe l'adjacent et livre le resultat. REGLE: credite QUE l'adjacent realise ou quasi-certain, JAMAIS une option speculative non prouvee (ex. robotaxi).
5. capture — se fait payer durablement (pricing power, switching costs qui tiennent) sans dependance unique fatale? 0 = capture faible/erodable OU choc unique non mitige menace la continuite. 0.5 = payee sous pression, dependance partiellement mitigee. 1 = capture durable + aucune dependance fatale. REGLE: une falaise de brevets/contrat sur la majorite du coeur = choc de continuite => 0.

EXEMPLES NOTES (calibrage, format [besoin/controle/forces/adjacent/capture]): Microsoft 5/5 [1/1/1/1/1] · Visa 4/5 [1/1/0.5/0.5/1] · Costco 3/5 [1/0.5/0.5/0/1] · Dropbox 2/5 [0.5/0.5/0/0.5/0.5] · DocuSign 1/5 [0.5/0/0/0/0.5].
Un role qui persiste et croit = besoin 1. Une infra, un oligopole regule, un reseau de paiement, un graphe social, une installed base indispensable = controle 1 et souvent forces 1. Sois severe sur les interfaces reconstructibles.`;

/**
 * Construit le prompt complet pour noter un lot d'entreprises en un seul appel.
 * Sortie demandee : un tableau JSON, un objet par entreprise, avec pour chaque
 * critere une note `s` (0/0.5/1) et une justification `r` d'une phrase.
 */
export function buildScoringPrompt(companies: CompanyBrief[]): string {
  const list = companies
    .map((c, i) => `${i + 1}. ${c.name} — ${c.brief}`)
    .join('\n');
  return `${RESILIENCE_RUBRIC}

NOTE CHACUNE des entreprises ci-dessous. Pour chaque critere: "s" = 0, 0.5 ou 1; "r" = UNE phrase claire (~25 mots) qui justifie la note (ex: "extension de chaine de valeur insuffisante: reste une fonctionnalite isolee, pas un operateur d'outcome"). Reponds UNIQUEMENT en JSON, un TABLEAU, un objet par entreprise dans l'ordre donne:
[{"nom":"...","besoin":{"s":0,"r":"..."},"controle":{"s":0,"r":"..."},"forces":{"s":0,"r":"..."},"adjacent":{"s":0,"r":"..."},"capture":{"s":0,"r":"..."}}]

ENTREPRISES:
${list}`;
}
