const PHRASE_FIXES: Array<[RegExp, string]> = [
  [/\bconcentration revenus\b/gi, 'concentration des revenus'],
  [/\bdependance manufacturing Chine\b/gi, 'dépendance à la production en Chine'],
  [/\bmanufacturing Chine\b/gi, 'production en Chine'],
  [/\bse commoditise\b/gi, 'se banalise'],
  [/\bmarche smartphone\b/gi, 'marché du smartphone'],
  [/\bmat[eé]riel-logiciel-services\b/gi, 'matériel-logiciel-services'],
  [/\ba produit equivalent\b/gi, 'à produit équivalent'],
  [/\bproduit equivalent\b/gi, 'produit équivalent'],
];

const WORD_FIXES: Record<string, string> = {
  achete: 'acheté',
  activite: 'activité',
  activites: 'activités',
  aggrege: 'agrège',
  appliquee: 'appliquée',
  asymetrie: 'asymétrie',
  benefice: 'bénéfice',
  benefices: 'bénéfices',
  beneficie: 'bénéficie',
  categorie: 'catégorie',
  categories: 'catégories',
  chere: 'chère',
  coeur: 'cœur',
  controle: 'contrôle',
  controlee: 'contrôlée',
  controlees: 'contrôlées',
  controles: 'contrôles',
  coute: 'coûte',
  couteux: 'coûteux',
  couts: 'coûts',
  croit: 'croît',
  deja: 'déjà',
  dependance: 'dépendance',
  dependances: 'dépendances',
  developpe: 'développe',
  developpee: 'développée',
  developpees: 'développées',
  diversifie: 'diversifié',
  diversifiee: 'diversifiée',
  diversifiees: 'diversifiées',
  diversifies: 'diversifiés',
  ecosysteme: 'écosystème',
  eleve: 'élevé',
  elevee: 'élevée',
  elevees: 'élevées',
  eleves: 'élevés',
  equivalent: 'équivalent',
  equivalentes: 'équivalentes',
  etabli: 'établi',
  etablie: 'établie',
  etroite: 'étroite',
  etroitement: 'étroitement',
  etre: 'être',
  evite: 'évite',
  expose: 'exposé',
  exposee: 'exposée',
  fragilite: 'fragilité',
  generique: 'générique',
  generiques: 'génériques',
  integre: 'intègre',
  integree: 'intégrée',
  installe: 'installé',
  installee: 'installée',
  installees: 'installées',
  installes: 'installés',
  localise: 'localisé',
  localisee: 'localisée',
  materiel: 'matériel',
  marche: 'marché',
  metier: 'métier',
  metiers: 'métiers',
  mitige: 'mitigé',
  mitigee: 'mitigée',
  modele: 'modèle',
  modeles: 'modèles',
  monetise: 'monétise',
  monetisee: 'monétisée',
  paye: 'payé',
  payee: 'payée',
  payees: 'payées',
  perimetre: 'périmètre',
  prefere: 'préfère',
  preference: 'préférence',
  reel: 'réel',
  reelle: 'réelle',
  reellement: 'réellement',
  reseau: 'réseau',
  reseaux: 'réseaux',
  resultat: 'résultat',
  role: 'rôle',
  sante: 'santé',
  securite: 'sécurité',
  substitue: 'substitué',
  systeme: 'système',
  systemes: 'systèmes',
  testee: 'testée',
  tres: 'très',
};

const PROPER_NOUN_FIXES: Array<[RegExp, string]> = [
  [/\bl IA\b/gi, "l'IA"],
  [/\bl [eé]cosystème\b/gi, "l'écosystème"],
  [/\bl adjacent\b/gi, "l'adjacent"],
  [/\bl iPhone\b/gi, "l'iPhone"],
  [/\bqu Apple\b/gi, "qu'Apple"],
  [/\bIA\b/gi, 'IA'],
  [/\bCUDA\b/gi, 'CUDA'],
  [/\bASIC\b/gi, 'ASIC'],
  [/\bTSMC\b/gi, 'TSMC'],
  [/\bTaiwan\b/gi, 'Taïwan'],
  [/\bChine\b/gi, 'Chine'],
  [/\bInfiniBand\b/gi, 'InfiniBand'],
  [/\biPhone\b/gi, 'iPhone'],
];

function preserveCase(source: string, replacement: string): string {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) return replacement[0]!.toUpperCase() + replacement.slice(1);
  return replacement;
}

export function prettifyJustification(text: string): string {
  let out = text.trim().replace(/\s+/g, ' ');
  for (const [pattern, replacement] of PHRASE_FIXES) out = out.replace(pattern, replacement);
  out = out.replace(/\p{L}+/gu, word => {
    const replacement = WORD_FIXES[word.toLowerCase()];
    return replacement ? preserveCase(word, replacement) : word;
  });
  for (const [pattern, replacement] of PROPER_NOUN_FIXES) out = out.replace(pattern, replacement);
  out = out.replace(/\s+([,.;:!?])/g, '$1');
  out = out.replace(/([,.;:!?])(?=\S)/g, '$1 ');
  out = out.replace(/(^|[.!?]\s+)([a-zà-ÿ])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
  return out;
}
