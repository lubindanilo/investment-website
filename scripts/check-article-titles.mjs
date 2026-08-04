#!/usr/bin/env node
/**
 * check-article-titles.mjs — garde-fou éditorial sur les titres / metas d'articles.
 *
 * Critères (skill lubin-blog-writer §4) verifies sur ce qui est vu AVANT le clic
 * (title, metaDescription, excerpt) :
 *   - JARGON INTERDIT (echec) : pas de « 10/10 » ni « X/10 », pas de « P/FCF »,
 *     « price to free cash flow », « EV/EBITDA », ni ratio chiffre « 18x » / « 17,6x ».
 *   - Longueur (avertissement seulement) : title <= 60, metaDescription <= 160.
 *   - CANNIBALISATION (echec, ajout 2026-08-04, Q5 du plan docs/seo/PLAN.md) : un titre
 *     d'article ne doit PAS reprendre le gabarit des 5000 fiches /analyse/TICKER, qui
 *     s'intitulent deja « Faut-il acheter l'action X ? » / « Should you buy X stock? » /
 *     « ¿Comprar la accion X? » et « X est-elle sous-evaluee ». Deux URL du meme site sur la
 *     meme requete se concurrencent et une seule concourt ; corriger la cannibalisation a
 *     rapporte 400 % de trafic dans le cas mesure du corpus. Un proprietaire par intention :
 *     la FICHE possede « faut-il acheter » et « sous-evaluee », l'ARTICLE prend un angle
 *     narratif (mecanisme, resultats trimestriels, pedagogie, etude de donnees).
 *
 * DIFF-ONLY : on ne valide QUE les lignes AJOUTEES dans la PR (argument = fichier
 * diff unifie). Les centaines d'articles legacy anterieurs a la regle ne sont pas
 * re-juges, donc le check ne bloque que les NOUVEAUX articles. Sans argument, lit
 * stdin. Sortie != 0 si au moins une violation de jargon.
 */
import fs from 'fs';

const JARGON = [
  { re: /\b\d{1,2}\/10\b(?!\/)/, label: 'note X/10' },
  { re: /(?<!\d)\/10\b/, label: 'note /10' },
  { re: /\bP\/?FCF\b/i, label: 'P/FCF' },
  { re: /price[\s-]?to[\s-]?free[\s-]?cash[\s-]?flow/i, label: 'price-to-free-cash-flow' },
  { re: /\bEV\/EBITDA\b/i, label: 'EV/EBITDA' },
  { re: /\d+(?:[.,]\d+)?\s*[x×]\b/, label: 'ratio chiffre (Nx)' },
];
// Gabarits reserves aux fiches /analyse/TICKER. Ne s'appliquent qu'au champ `title` : un
// excerpt ou une metaDescription peut legitimement contenir la question, c'est le TITRE qui
// se dispute la requete dans la page de resultats.
const CANNIBAL = [
  { re: /faut-il\s+acheter\s+(l'|l’)?action/i, label: "« Faut-il acheter l'action X » (gabarit de la fiche /analyse)" },
  { re: /should\s+you\s+buy\b/i, label: '« Should you buy X » (gabarit de la fiche /analyse)' },
  { re: /(¿|\?)?\s*comprar\s+la\s+acci[oó]n/i, label: '« Comprar la accion X » (gabarit de la fiche /analyse)' },
  { re: /est[- ]elle\s+sous[- ]?[eé]valu[eé]e/i, label: '« X est-elle sous-evaluee » (gabarit de la fiche /analyse)' },
  { re: /\bis\b.*\bundervalued\b/i, label: '« X is undervalued » (gabarit de la fiche /analyse)' },
  { re: /est[aá]\s+infravalorada/i, label: '« X esta infravalorada » (gabarit de la fiche /analyse)' },
];
const FIELD_RE = /^\s*(title|metaDescription|excerpt):\s*(["'])(.*?)\2\s*,?\s*$/;
const MAX = { title: 60, metaDescription: 160 };

const input = process.argv[2]
  ? fs.readFileSync(process.argv[2], 'utf8')
  : fs.readFileSync(0, 'utf8');

const fails = [];
const warns = [];

for (const raw of input.split('\n')) {
  // Lignes ajoutees du diff unifie uniquement (mais pas l'entete +++).
  if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
  const line = raw.slice(1);
  const m = line.match(FIELD_RE);
  if (!m) continue;
  const [, field, , value] = m;
  for (const { re, label } of JARGON) {
    if (re.test(value)) fails.push({ field, label, value });
  }
  if (field === 'title') {
    for (const { re, label } of CANNIBAL) {
      if (re.test(value)) fails.push({ field, label, value, cannibal: true });
    }
  }
  if (MAX[field] && value.length > MAX[field]) {
    warns.push({ field, len: value.length, max: MAX[field], value });
  }
}

for (const w of warns) {
  console.log(`::warning::${w.field} trop long (${w.len} > ${w.max}) : ${w.value}`);
}
for (const f of fails) {
  const kind = f.cannibal ? 'Gabarit reserve a la fiche /analyse' : 'Jargon interdit avant le clic';
  console.log(`::error::${kind} [${f.label}] dans ${f.field} : ${f.value}`);
}

if (fails.length) {
  const nCannibal = fails.filter((f) => f.cannibal).length;
  const nJargon = fails.length - nCannibal;
  if (nJargon) {
    console.log(`\n${nJargon} violation(s) de jargon. Reformule sans ratio ni note chiffree (le jargon s'explique dans le CORPS, jamais dans le titre/meta/excerpt).`);
  }
  if (nCannibal) {
    console.log(`\n${nCannibal} titre(s) reprenant le gabarit des fiches /analyse/TICKER. La fiche possede deja « faut-il acheter » et « sous-evaluee » sur 5000 pages : un article qui reprend la formule se concurrence lui-meme, et une seule des deux URL concourt. Prends un angle : le mecanisme du business, les resultats du trimestre, une notion expliquee, une etude de donnees. Exemple : « Sanofi face a sa falaise de brevets : ce que Dupixent compense vraiment » plutot que « Faut-il acheter l'action Sanofi en 2026 ? ».`);
  }
  process.exit(1);
}
console.log(`OK : aucun jargon ni gabarit de fiche dans les titres ajoutes (${warns.length} avertissement(s) de longueur).`);
