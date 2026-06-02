#!/usr/bin/env node
/**
 * Garde-fou anti-régression — exécuté dans `build:vercel` (bloque le déploiement si violé).
 *
 * Interdit tout import de VALEUR depuis '@lubin/shared' dans apps/api.
 *
 * Pourquoi : @lubin/shared n'a pas de build dist/ — son package.json résout vers
 * `src/index.ts`. En prod (Node, ESM strict) un import de valeur force le chargement de ce
 * `.ts`, que Node ne sait pas exécuter → ERR_MODULE_NOT_FOUND au boot → toute la lambda
 * tombe (FUNCTION_INVOCATION_FAILED : health, login, analyze…). Les `import type { … }`,
 * eux, sont effacés à la compilation → sans risque.
 *
 * Règle : dans apps/api, tout `… from '@lubin/shared'` DOIT être `import type { … }`.
 * Si tu as besoin d'une valeur partagée, redéfinis-la côté API (cf. RATIO_METRIC_KEYS
 * dérivé dans services/derivedTimeseries.ts).
 *
 * Le front (apps/web) n'est PAS concerné : Vite transpile les .ts de shared sans souci.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_SRC = join(ROOT, 'apps/api/src');

/** Liste récursive des .ts (hors .d.ts). */
function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

// Capture chaque déclaration `import … from '@lubin/shared'`. Ancrée en DÉBUT DE LIGNE
// (flag `m` + `^[ \t]*`) pour ne matcher que de vrais imports, pas le mot « import » glissé
// dans un commentaire ou une chaîne. `[^;]*?` traverse les \n → gère les imports multi-lignes.
// m[1] = "type " présent uniquement pour `import type …` (la seule forme autorisée).
const IMPORT_RE = /^[ \t]*import\s+(type\s+)?[^;]*?from\s*['"]@lubin\/shared['"]/gm;

const violations = [];
for (const file of walk(API_SRC)) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(IMPORT_RE)) {
    if (!m[1]) violations.push({ file: relative(ROOT, file), stmt: m[0].replace(/\s+/g, ' ').trim() });
  }
}

if (violations.length > 0) {
  console.error('\n❌ Import de VALEUR depuis @lubin/shared détecté dans apps/api — INTERDIT.');
  console.error('   @lubin/shared résout vers src/index.ts (pas de build) → crash de la lambda en prod.');
  console.error('   ➜ Utilise `import type { … }`, ou redéfinis la valeur côté API.\n');
  for (const v of violations) console.error(`   • ${v.file}\n       ${v.stmt}`);
  console.error('');
  process.exit(1);
}

console.log('✅ apps/api : tous les imports de @lubin/shared sont type-only (aucun risque runtime).');
