#!/usr/bin/env node
/**
 * Garde-fou déterministe : dans les fichiers d'articles, `export const ARTICLES = [...]`
 * doit être déclaré APRÈS toutes les consts qu'il référence.
 *
 * Sinon : ReferenceError en zone morte temporelle (TDZ) au chargement du module
 * (« Cannot access 'articleX' before initialization ») => la fonction serverless Vercel
 * crashe à CHAQUE invocation (HTTP 500 FUNCTION_INVOCATION_FAILED), tout le site devient
 * non crawlable et l'API tombe. Ni `tsc` ni `build:vercel` (qui ne typecheck pas l'API)
 * ne l'attrapent : d'où ce check dédié. Incident du 2026-07-15.
 *
 * Se lance sans dépendances (pur Node), donc utilisable en CI, en local, et par le cron
 * SEO avant d'ouvrir sa PR.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  'packages/shared/src/articles.ts',
  'apps/api/src/data/articles.ts',
];

let failed = false;

for (const rel of FILES) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');

  // 1. Localise la déclaration de l'array exporté.
  const arrRe = /^export const ARTICLES\s*:\s*Article\[\]\s*=\s*\[([^\]]*)\]/m;
  const m = src.match(arrRe);
  if (!m) { console.error(`::error::${rel} : \`export const ARTICLES: Article[] = [...]\` introuvable.`); failed = true; continue; }
  const arrOffset = m.index;
  const ids = m[1].split(',').map(s => s.trim()).filter(Boolean);

  // 2. Chaque identifiant listé doit être déclaré (const) AVANT l'array.
  const late = [];
  const missing = [];
  for (const id of ids) {
    const declRe = new RegExp(`^(?:export )?const ${id.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'm');
    const dm = src.match(declRe);
    if (!dm) { missing.push(id); continue; }
    if (dm.index > arrOffset) late.push(id);
  }

  if (missing.length) {
    console.error(`::error::${rel} : ${missing.length} identifiant(s) listé(s) dans ARTICLES sans déclaration \`const\` : ${missing.join(', ')}`);
    failed = true;
  }
  if (late.length) {
    console.error(`::error::${rel} : ${late.length} const déclaré(s) APRÈS \`export const ARTICLES\` (TDZ, crash à l'import) : ${late.join(', ')}. Déplace \`export const ARTICLES\` en fin de fichier, après toutes les déclarations.`);
    failed = true;
  }
  if (!missing.length && !late.length) {
    console.log(`✅ ${rel} : ARTICLES (${ids.length} articles) déclaré après toutes ses consts.`);
  }
}

if (failed) process.exit(1);
console.log('✅ Ordre des déclarations d\'articles OK dans les 2 fichiers.');
