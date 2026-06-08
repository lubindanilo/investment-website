/**
 * Chargement minimal des variables d'environnement (sans dépendance dotenv).
 * On lit la clé Finnhub depuis process.env, sinon depuis le .env racine du monorepo
 * (qui contient les vraies clés, cf. mémoire projet) puis apps/api/.env en secours.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url)); // apps/backtest/src/lib
const REPO_ROOT = resolve(HERE, '../../../..');       // → racine du monorepo

/** Parse naïf d'un fichier .env (KEY=VALUE, guillemets optionnels, # commentaires). */
function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2]!.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]!] = v;
  }
  return out;
}

let cached: Record<string, string> | null = null;
function fileEnv(): Record<string, string> {
  if (cached) return cached;
  cached = {
    ...parseEnvFile(resolve(REPO_ROOT, 'apps/api/.env')),
    ...parseEnvFile(resolve(REPO_ROOT, '.env')), // la racine prime
  };
  return cached;
}

/** Renvoie une variable d'env (process.env prioritaire, puis fichiers .env). */
export function env(key: string): string | undefined {
  return process.env[key] ?? fileEnv()[key];
}

/** Renvoie une variable requise ou throw avec un message clair. */
export function requireEnv(key: string): string {
  const v = env(key);
  if (!v) throw new Error(`Variable d'environnement manquante : ${key} (cherchée dans process.env, ${REPO_ROOT}/.env et apps/api/.env)`);
  return v;
}
