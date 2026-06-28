#!/usr/bin/env node
/**
 * check-article-titles.mjs — garde-fou éditorial sur les titres / metas d'articles.
 *
 * Critères (skill lubin-blog-writer §4) verifies sur ce qui est vu AVANT le clic
 * (title, metaDescription, excerpt) :
 *   - JARGON INTERDIT (echec) : pas de « 10/10 » ni « X/10 », pas de « P/FCF »,
 *     « price to free cash flow », « EV/EBITDA », ni ratio chiffre « 18x » / « 17,6x ».
 *   - Longueur (avertissement seulement) : title <= 60, metaDescription <= 160.
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
  if (MAX[field] && value.length > MAX[field]) {
    warns.push({ field, len: value.length, max: MAX[field], value });
  }
}

for (const w of warns) {
  console.log(`::warning::${w.field} trop long (${w.len} > ${w.max}) : ${w.value}`);
}
for (const f of fails) {
  console.log(`::error::Jargon interdit avant le clic [${f.label}] dans ${f.field} : ${f.value}`);
}

if (fails.length) {
  console.log(`\n${fails.length} violation(s) de jargon. Reformule sans ratio ni note chiffree (le jargon s'explique dans le CORPS, jamais dans le titre/meta/excerpt).`);
  process.exit(1);
}
console.log(`OK : aucun jargon avant le clic dans les titres/metas ajoutes (${warns.length} avertissement(s) de longueur).`);
