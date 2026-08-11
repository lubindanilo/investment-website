#!/usr/bin/env node
/**
 * Genere `packages/shared/src/frenchAccentsLexicon.ts` : la table
 * « forme sans accent » -> « forme accentuee », APPRISE sur le corpus francais du
 * repo au lieu d'etre tapee a la main.
 *
 * POURQUOI. Les justifications de resilience sortent du LLM sans accents (cf.
 * resilienceStarsPrompt.ts). La reparation vivait dans une liste de 90 mots ecrite a la
 * main cote web : chaque nouveau mot manquant demandait un commit, et il en manquait des
 * dizaines par ticker. Le blog, lui, contient deja ~2,7 Mo de francais correctement
 * accentue sur EXACTEMENT le meme vocabulaire (finance, industrie, strategie). On lit ce
 * francais-la et on en deduit la table : elle grandit toute seule a chaque article.
 *
 * SOURCES. Uniquement les blocs `fr:` de apps/api/src/data/articles.ts (le fichier est
 * trilingue : « role », « control », « tres » sont des mots anglais/espagnols valides et
 * pollueraient la table) plus apps/web/src/i18n/locales/fr.json. Les URLs, liens markdown,
 * balises et slugs (`actions-pea-eligibles-de-qualite`) sont retires : un slug est du
 * francais volontairement desaccentue, c'est du poison pour cet apprentissage.
 *
 * REGLES (calibrees pour ZERO faux positif, cf. l'audit des 76 entrees limites) :
 *   - la forme accentuee doit apparaitre au moins 3 fois (sinon c'est une coquille) ;
 *   - s'il existe plusieurs formes accentuees (cote/cote/cote), la premiere doit dominer
 *     la deuxieme d'un facteur 5, sinon on n'ecrit RIEN : l'ambiguite se tranche au sens,
 *     pas a la frequence, et c'est le travail de la passe LLM ;
 *   - la forme NUE peut exister dans le corpus, mais 20 fois moins souvent que l'accentuee
 *     (« marche » 10 vs « marche » 963). En dessous, mot ambigu, on n'ecrit rien.
 *
 * Les cas que ces regles refusent volontairement (participes du type developpe/developpe)
 * sont rattrapes en aval : ACCENT_OVERRIDES pour les choix editoriaux, puis la passe Haiku
 * de resilienceStarsReaccent.ts pour le reste.
 *
 * QUATRE FICHIERS ECRITS, ET POURQUOI. apps/api ne peut pas importer de VALEUR depuis
 * @lubin/shared (le package resout vers du .ts, que la lambda ne sait pas charger : cf.
 * scripts/check-api-shared-imports.mjs). Le moteur et sa table sont donc recopies dans
 * apps/api/src/lib, exactement comme articles.ts l'est deja dans apps/api/src/data. La copie
 * est faite ICI, a l'octet pres, et non a la main : c'est ce qui garantit qu'elle ne derive pas.
 *
 *   node scripts/gen-accent-lexicon.mjs            # regenere table + copies
 *   node scripts/gen-accent-lexicon.mjs --check    # echoue si un fichier commite est perime (CI)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const CHECK_ONLY = process.argv.includes('--check');
const ENGINE_SRC = 'packages/shared/src/frenchAccents.ts';
const OUT = 'packages/shared/src/frenchAccentsLexicon.ts';
const API_LEXICON = 'apps/api/src/lib/frenchAccentsLexicon.ts';
const API_ENGINE = 'apps/api/src/lib/frenchAccents.ts';

const stale = [];

/** Ecrit le fichier, ou (mode --check) note qu'il est perime sans rien toucher. */
function emit(path, content) {
  let current = null;
  try {
    current = readFileSync(path, 'utf8');
  } catch {
    current = null;
  }
  if (current === content) return;
  if (CHECK_ONLY) {
    stale.push(path);
    return;
  }
  writeFileSync(path, content, 'utf8');
}
const MIN_ACCENTED_COUNT = 3;
const AMBIGUITY_RATIO = 5;
const PLAIN_RATIO = 20;
const MIN_LENGTH = 3;

/** Retire les diacritiques ET la ligature œ, pour comparer deux graphies au meme etalon. */
function deaccent(value) {
  return value
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/** Ne garde que les tranches `fr: { ... }` d'un fichier d'articles trilingue. */
function frenchSlices(source) {
  const parts = [];
  const opener = /\n {4}fr: \{/g;
  for (let match = opener.exec(source); match; match = opener.exec(source)) {
    const end = source.indexOf('\n    en: {', match.index);
    parts.push(source.slice(match.index, end === -1 ? source.length : end));
  }
  return parts.join('\n');
}

function stripNonProse(text) {
  return text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\(\/[^)]*\)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[a-z0-9]+(?:-[a-z0-9]+)+/g, ' '); // slugs : du francais desaccentue volontaire
}

const corpus = stripNonProse(
  `${frenchSlices(readFileSync('apps/api/src/data/articles.ts', 'utf8'))}\n${readFileSync('apps/web/src/i18n/locales/fr.json', 'utf8')}`,
);

const counts = new Map();
for (const match of corpus.matchAll(/\p{L}+/gu)) {
  const word = match[0].toLowerCase();
  counts.set(word, (counts.get(word) ?? 0) + 1);
}

/** Regroupe toutes les graphies d'un meme mot sous sa forme desaccentuee. */
const groups = new Map();
for (const [word, count] of counts) {
  const key = deaccent(word);
  const variants = groups.get(key) ?? new Map();
  variants.set(word, count);
  groups.set(key, variants);
}

const lexicon = new Map();
for (const [key, variants] of groups) {
  if (key.length < MIN_LENGTH) continue;
  const accented = [...variants].filter(([word]) => word !== key).sort((a, b) => b[1] - a[1]);
  const best = accented[0];
  if (!best || best[1] < MIN_ACCENTED_COUNT) continue;
  const runnerUp = accented[1];
  if (runnerUp && runnerUp[1] * AMBIGUITY_RATIO > best[1]) continue;
  const plain = variants.get(key) ?? 0;
  if (plain * PLAIN_RATIO > best[1]) continue;
  lexicon.set(key, best[0]);
}

const entries = [...lexicon].sort(([a], [b]) => (a < b ? -1 : 1));
const body = entries.map(([key, value]) => `  ${key}: '${value.replace(/'/g, "\\'")}',`).join('\n');

const lexiconFile = `/**
 * FICHIER GENERE — ne pas editer a la main.
 * Regenerer : \`node scripts/gen-accent-lexicon.mjs\` (voir ce script pour les regles).
 *
 * ${entries.length} formes apprises sur le francais du blog (blocs \`fr:\` des articles + i18n web).
 * Les choix editoriaux et les cas ambigus vivent dans ACCENT_OVERRIDES (frenchAccents.ts),
 * qui a la priorite sur cette table.
 */
export const ACCENT_LEXICON: Record<string, string> = {
${body}
};
`;

const copyHeader = `/**
 * COPIE GENEREE de ${ENGINE_SRC} — ne pas editer a la main.
 * Regenerer : \`node scripts/gen-accent-lexicon.mjs\`.
 *
 * Pourquoi une copie : apps/api ne peut pas importer de VALEUR depuis @lubin/shared sans faire
 * tomber la lambda (cf. scripts/check-api-shared-imports.mjs). Meme raison que la duplication
 * de articles.ts. La copie est produite par script, jamais a la main, donc elle ne derive pas.
 */
`;

emit(OUT, lexiconFile);
emit(API_LEXICON, `${copyHeader}${lexiconFile.replace(/^\/\*\*[\s\S]*?\*\/\n/, '')}`);
emit(API_ENGINE, `${copyHeader}${readFileSync(ENGINE_SRC, 'utf8')}`);

if (CHECK_ONLY) {
  if (stale.length > 0) {
    console.error('\n❌ Lexique d accents perime. Lance `node scripts/gen-accent-lexicon.mjs` et commite :');
    for (const path of stale) console.error(`   • ${path}`);
    console.error('');
    process.exit(1);
  }
  console.log('✅ Lexique d accents a jour (table apprise + copies apps/api).');
} else {
  console.log(`✅ ${entries.length} entrees apprises sur ${counts.size} mots distincts, 3 fichiers ecrits.`);
}
