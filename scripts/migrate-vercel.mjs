/**
 * Migration Prisma robuste au cold-start Neon (build Vercel).
 *
 * Problème : le compute Neon (free tier) se met en veille (scale to zero). Au build,
 *   - via le pooler : advisory lock perdu → P1002 ;
 *   - via la connexion directe sur un compute endormi → P1001 (injoignable le temps du réveil).
 *
 * Solution :
 *   1. On RÉVEILLE le compute via le pooler (DATABASE_URL) — wake-on-connect fiable — avec retries.
 *   2. On lance `migrate deploy` via la connexion DIRECTE (DIRECT_URL, advisory lock OK), avec retries.
 *
 * Les URLs ne transitent jamais en argument (lues depuis l'env par Prisma : `url`/`directUrl`),
 * donc aucun secret dans les logs/commandes.
 */
import { execSync } from 'node:child_process';

const PRISMA = 'pnpm --filter @lubin/api exec prisma';
const SCHEMA = '--schema=prisma/schema.prisma';
const sleep = (s) => { try { execSync(`sleep ${s}`); } catch { /* ignore */ } };

// 1. Réveil du compute via le pooler (url = DATABASE_URL). Best-effort.
let awake = false;
for (let i = 1; i <= 6; i++) {
  try {
    execSync(`${PRISMA} db execute ${SCHEMA} --stdin`, { input: 'SELECT 1;', stdio: ['pipe', 'inherit', 'inherit'] });
    console.log('[migrate-vercel] compute Neon réveillé ✔');
    awake = true;
    break;
  } catch {
    console.log(`[migrate-vercel] réveil tentative ${i}/6 — nouvel essai dans 4 s…`);
    sleep(4);
  }
}
if (!awake) console.log('[migrate-vercel] réveil non confirmé — on tente quand même la migration.');

// 2. migrate deploy via la connexion directe (directUrl = DIRECT_URL), avec retries.
let migrated = false;
for (let i = 1; i <= 4; i++) {
  try {
    execSync(`${PRISMA} migrate deploy ${SCHEMA}`, { stdio: 'inherit' });
    migrated = true;
    break;
  } catch {
    console.log(`[migrate-vercel] migrate deploy tentative ${i}/4 échouée — nouvel essai dans 5 s…`);
    sleep(5);
  }
}

if (!migrated) {
  console.error('[migrate-vercel] échec de migrate deploy après plusieurs tentatives.');
  process.exit(1);
}
console.log('[migrate-vercel] migrations appliquées ✔');
