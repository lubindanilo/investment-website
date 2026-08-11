import { ACCENT_LEXICON } from './frenchAccentsLexicon.js';

/**
 * Reparation des accents du francais produit par un LLM, partagee api + web.
 *
 * LE PROBLEME. Les justifications du score de resilience sortent du modele sans accents
 * (« Concessions regulees de tres longue duree »). La cause est en amont : le bareme de
 * resilienceStarsPrompt.ts etait lui-meme ecrit sans accents, et un modele imite l'orthographe
 * de son prompt. Le prompt est corrige, mais deux choses restent vraies : les ~1000 tickers
 * deja notes portent le texte fautif en base, et aucun prompt ne garantit 100 % des sorties.
 *
 * LA REPARATION, EN TROIS COUCHES, DE LA PLUS SURE A LA PLUS SOUPLE :
 *   1. ACCENT_OVERRIDES : les choix editoriaux et les mots ambigus tranches a la main.
 *   2. ACCENT_LEXICON : ~1350 formes APPRISES sur le francais du blog (scripts/gen-accent-lexicon.mjs),
 *      donc sur exactement le meme vocabulaire, et qui grandit a chaque article publie.
 *   3. la passe Haiku de resilienceStarsReaccent.ts, pour le residu que rien de deterministe ne
 *      peut trancher (« developpe » = developpe ou developpe ?).
 *
 * Les couches 1 et 2 tournent a l'ecriture ET a la lecture : une justification ecrite avant ce
 * correctif est reparee a l'affichage sans attendre le passage en base.
 */

/** Retire diacritiques et ligature œ : l'etalon pour comparer deux graphies d'un meme mot. */
export function deaccent(value: string): string {
  return value
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Vrai si deux textes portent EXACTEMENT la meme suite de lettres, aux accents pres.
 *
 * C'est l'invariant qui rend une passe LLM sans danger : on ne verifie pas que le modele a
 * « bien travaille », on verifie qu'il n'a rien pu reecrire d'autre que des diacritiques. Si le
 * modele reformule, resume, traduit ou coupe une phrase, la comparaison echoue et on garde le
 * texte d'origine.
 *
 * La comparaison ignore casse, espaces et ponctuation : « jusqu a » et « jusqu'à » doivent etre
 * reconnus identiques, sinon le rattrapage de l'apostrophe serait rejete comme une reecriture.
 * Ce qui est verrouille, c'est la suite des lettres, et c'est bien la que se joue le sens.
 */
export function sameLetters(a: string, b: string): boolean {
  const flatten = (value: string) => deaccent(value).toLowerCase().replace(/[^\p{L}]+/gu, '');
  return flatten(a) === flatten(b);
}

/**
 * Choix a la main, prioritaires sur la table apprise.
 *
 * Deux familles seulement : les mots que le corpus refuse de trancher parce que les deux graphies
 * y vivent (« marche »/« marche »), et les preferences typographiques de Lubin (« coeur » avec la
 * ligature). Tout le reste doit venir du corpus : une entree ajoutee ici est une entree qu'il
 * faudra maintenir a la main, c'est exactement ce qu'on cherche a ne plus faire.
 */
export const ACCENT_OVERRIDES: Record<string, string> = {
  aggrege: 'agrège',
  coeur: 'cœur',
  coeurs: 'cœurs',
  controlee: 'contrôlée',
  controlees: 'contrôlées',
  controles: 'contrôles',
  croit: 'croît',
  eleve: 'élevé',
  elevee: 'élevée',
  elevees: 'élevées',
  eleves: 'élevés',
  marche: 'marché',
  marches: 'marchés',
  paye: 'payé',
  payee: 'payée',
  payees: 'payées',
  payes: 'payés',
  role: 'rôle',
  roles: 'rôles',
};

/**
 * Corrections de groupes de mots : ce que le mot a mot ne peut pas voir.
 *
 * `a` seul est INDECIDABLE hors contexte (verbe avoir ou preposition), et la regle generale
 * qu'on serait tente d'ecrire (« a » devant un infinitif) se trompe sur tous les passes composes :
 * « a genere » deviendrait « a genere ». On ne corrige donc que les tournures ou la preposition
 * est certaine parce que le mot d'avant appelle un complement. Le reste est laisse a la passe LLM,
 * qui, elle, lit la phrase.
 */
const PHRASE_FIXES: Array<[RegExp, string]> = [
  [/\bconcentration revenus\b/gi, 'concentration des revenus'],
  [/\bdependance manufacturing Chine\b/gi, 'dépendance à la production en Chine'],
  [/\bmanufacturing Chine\b/gi, 'production en Chine'],
  [/\bse commoditise\b/gi, 'se banalise'],
  [/\b(impossibles?|difficiles?|faciles?|durs?|dures?|prets?|pretes?|aptes?|longs?|lentes?|prompts?) a\b/gi, '$1 à'],
  [/\b(reste|restent|cherche|cherchent|vise|visent|sert|servent|aide|aident|commence|commencent|continue|continuent|parvient|parviennent|consiste|consistent|contribue|contribuent) a\b/gi, '$1 à'],
  // « jusqu a » se traite d'un coup : en JS `\b` est ASCII, donc un `\bjusqu à\b` en deux temps
  // ne matcherait jamais (la limite de mot n'existe pas apres un « à »).
  [/\bjusqu a\b/gi, "jusqu'à"],
  [/\b(face|grace|quant|contrairement|par rapport) a\b/gi, '$1 à'],
];

/**
 * Elisions et noms propres : invisibles pour le mot a mot.
 * `l`, `d` et `qu` isoles ne sont jamais des mots francais : l'apostrophe manque, toujours.
 */
const PROPER_NOUN_FIXES: Array<[RegExp, string]> = [
  [/\b([ldLD]) (?=\p{L})/gu, "$1'"],
  [/\b(qu|Qu) (?=\p{L})/gu, "$1'"],
  [/\bEtat\b/g, 'État'],
  [/\bEtats\b/g, 'États'],
  [/\bTaiwan\b/gi, 'Taïwan'],
  [/\bBresil\b/gi, 'Brésil'],
  [/\bCoree\b/gi, 'Corée'],
];

function preserveCase(source: string, replacement: string): string {
  if (source === source.toUpperCase() && source.length > 1) return replacement.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) return replacement[0]!.toUpperCase() + replacement.slice(1);
  return replacement;
}

function accentedFormOf(word: string): string | undefined {
  const key = word.toLowerCase();
  return ACCENT_OVERRIDES[key] ?? ACCENT_LEXICON[key];
}

/**
 * Terminaisons que l'on ose ajouter a une forme connue. Uniquement des marques d'accord :
 * le blog ecrit « régulée » 14 fois et « régulées » 2 fois, la table apprise ne retient que la
 * premiere, et il serait absurde de laisser passer la seconde pour un « s ».
 */
const INFLECTIONS = ['s', 'e', 'es'] as const;

/**
 * Accentuation deduite d'une forme connue a laquelle il ne manque qu'une marque d'accord.
 *
 * CE QU'ON S'INTERDIT, ET POURQUOI. La version generale de cette idee (partager le RADICAL entre
 * mots d'une meme famille) a ete essayee puis retiree : mesuree sur 2 806 mots nus du blog, elle
 * ecrivait « budgéts » depuis « budgétaire », « systéms » depuis « systématique », « achèter »
 * depuis « achète » et « financièrs » depuis « financière ». Un accent FAUX est bien pire qu'un
 * accent manquant : il est visible, il a l'air d'une faute d'inattention, et personne ne le
 * signale. On se limite donc a l'accord, et le vocabulaire derive part a la passe Haiku.
 *
 * La base doit finir par une VOYELLE : sans cette condition, « revers » deviendrait « rêvers »
 * (depuis « rêver ») et « excess » « excèss » (depuis « excès »).
 */
function inferAccentedForm(word: string): string | undefined {
  for (const suffix of INFLECTIONS) {
    if (!word.endsWith(suffix) || word.length <= suffix.length + 2) continue;
    const base = word.slice(0, -suffix.length);
    const accented = ACCENT_OVERRIDES[base] ?? ACCENT_LEXICON[base];
    if (!accented || !/[aeiouyàâéèêëîïôùûü]$/.test(accented)) continue;
    if (deaccent(accented) !== base) continue; // ligature œ : la reconstruction ne tiendrait pas
    return accented + suffix;
  }
  return undefined;
}

/**
 * Reecrit les mots dont la forme accentuee est connue ou deductible, casse d'origine respectee.
 * Un mot deja accente n'est jamais retouche : la table ne connait que des cles sans accent.
 *
 * L'inference par radical est reservee aux mots TOUT EN MINUSCULES. Un mot capitalise au milieu
 * d'une phrase est presque toujours un nom propre, et une marque n'a pas a etre corrigee :
 * « Vinci Energies » s'ecrit sans accent, c'est son nom.
 */
export function repairAccents(text: string): string {
  let out = text;
  for (const [pattern, replacement] of PHRASE_FIXES) out = out.replace(pattern, replacement);
  out = out.replace(/\p{L}+/gu, word => {
    const known = accentedFormOf(word);
    if (known) return preserveCase(word, known);
    if (word !== word.toLowerCase()) return word;
    return inferAccentedForm(word) ?? word;
  });
  for (const [pattern, replacement] of PROPER_NOUN_FIXES) out = out.replace(pattern, replacement);
  return out;
}

/**
 * Mots dont on SAIT qu'il leur manque un accent (ils sont dans la table et n'ont pas ete reparés).
 *
 * Detecteur volontairement conservateur : il ne pretend pas voir tout le francais mal accentue,
 * il repere a coup sur la panne systemique (un prompt qui repart sans accents produit forcement
 * des « controle », « tres », « marche »). C'est ce qui permet d'en faire un garde-fou de test
 * plutot qu'une alerte bruyante.
 */
export function missingAccentWords(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\p{L}+/gu)) {
    const word = match[0];
    if (deaccent(word) !== word) continue; // deja accente
    if (accentedFormOf(word)) found.add(word.toLowerCase());
  }
  return [...found];
}

/**
 * Texte pret a afficher : accents reparés, puis typographie (espaces autour de la ponctuation,
 * majuscule de debut de phrase). Applique a l'ecriture comme a la lecture, et idempotent.
 */
export function polishFrenchText(text: string): string {
  let out = repairAccents(text.trim().replace(/\s+/g, ' '));
  out = out.replace(/\s+([,.;:!?])/g, '$1');
  out = out.replace(/([,.;:!?])(?=\S)/g, '$1 ');
  out = out.replace(/(^|[.!?]\s+)([a-zà-ÿ])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
  return out;
}
