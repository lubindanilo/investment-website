import { polishFrenchText } from '@lubin/shared';

/**
 * Mise en forme d'une justification de resilience avant affichage.
 *
 * Ce fichier a longtemps porte une liste de 90 mots tapee a la main (activite -> activité,
 * modele -> modèle...). Elle ne pouvait pas gagner : le modele produit du vocabulaire ouvert,
 * chaque ticker ramenait ses propres mots manquants (« regulees », « concedes », « aeroports »),
 * et chacun demandait un commit. La table vit desormais dans @lubin/shared, APPRISE sur le
 * francais du blog (scripts/gen-accent-lexicon.mjs), donc elle s'etend toute seule.
 *
 * Ceci reste un filet de LECTURE : depuis le correctif, le texte arrive deja accentue de la base
 * (parseScores a l'ecriture + la passe de rattrapage resilienceStarsReaccent). Il couvre les
 * lignes ecrites avant, et il est idempotent sur un texte deja propre.
 */
export function prettifyJustification(text: string): string {
  return polishFrenchText(text);
}
