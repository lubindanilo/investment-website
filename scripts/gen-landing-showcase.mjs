/**
 * gen-landing-showcase.mjs — FIGE les données de la landing dans un module TypeScript.
 *
 * POURQUOI
 * La fiche du hero attendait `/api/screener/showcase`. Mesuré en local, cache RAM vide :
 * 1,25 s. En production s'y ajoutent le démarrage à froid de la fonction et le réveil de Neon
 * Free, qui suspend son compute après ~5 min d'inactivité ; et comme le cache est en RAM (donc
 * par instance), la plupart des visiteurs tombent sur un cache vide. Un hero ne peut pas attendre
 * une base de données.
 *
 * Les valeurs figées sont donc rendues DÈS le premier paint, sans squelette. Le front rafraîchit
 * ensuite en arrière-plan et corrige les chiffres si la base a bougé (cf. useLandingData).
 *
 * Usage :  node scripts/gen-landing-showcase.mjs                 (API locale sur :3001)
 *          node scripts/gen-landing-showcase.mjs --api=https://lubin-investment.com
 *
 * À relancer quand on veut rafraîchir la vitrine ou changer les sociétés mises en avant.
 * La liste éditoriale elle-même vit côté serveur (SHOWCASE_TICKERS dans routes/screener.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'apps/web/src/data/landingShowcase.ts');

const args = process.argv.slice(2);
const API = args.find(a => a.startsWith('--api='))?.slice('--api='.length) ?? 'http://localhost:3001';

/** Mêmes requêtes que useLandingData : la source de vérité des filtres reste le front. */
const ENDPOINTS = {
  showcase: '/api/screener/showcase',
  monitor: '/api/screener/top?opportunities=true&minMax=8&caps=large&limit=24',
  pea: '/api/screener/top?zones=pea&minMax=8&maxPfcf=15&caps=large&limit=4',
};

async function get(url) {
  const r = await fetch(`${API}${url}`, { headers: { 'Accept-Language': 'fr' } });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

/** Ne garde que les champs réellement affichés : le fichier reste lisible et léger. */
function toStock(r) {
  const max = r.scoreChiffresMax ?? 0;
  return {
    ticker: r.ticker,
    name: r.name ?? r.ticker,
    sector: r.sector ?? null,
    note10: r.scoreChiffres != null && max > 0 ? Math.round((r.scoreChiffres / max) * 10) : null,
    pfcfTTM: r.pfcfTTM ?? null,
    price: r.price ?? null,
    currency: r.currency ?? null,
    opportunity: !!r.opportunity,
    marketCap: r.marketCap ?? null,
    dayChangePct: r.dayChangePct ?? null,
    spark: Array.isArray(r.spark) && r.spark.length >= 2 ? r.spark.map(v => Math.round(v * 100) / 100) : null,
  };
}

function toSlot(s) {
  return {
    stock: toStock(s),
    criteria: (s.criteria ?? []).map(c => ({ name: c.name, value: c.value, status: c.status })),
    resilience: s.resilience ?? null,
    pfcfPercentile: s.pfcfPercentile ?? null,
  };
}

async function main() {
  console.log(`Source : ${API}`);
  const [showcase, monitor, pea] = await Promise.all([
    get(ENDPOINTS.showcase), get(ENDPOINTS.monitor), get(ENDPOINTS.pea),
  ]);

  const slots = (Array.isArray(showcase) ? showcase : [showcase]).map(toSlot);
  if (!slots.length) throw new Error('vitrine vide : rien à figer');
  // Les lignes de veille sont triées par capitalisation côté front : on fige le résultat final.
  const rows = monitor.map(toStock).filter(s => s.note10 != null)
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)).slice(0, 5);
  const peaRows = pea.map(toStock).filter(s => s.note10 != null);

  const stamp = new Date().toISOString().slice(0, 10);
  const body = `/**
 * Données de la landing FIGÉES — GÉNÉRÉ, ne pas éditer à la main.
 * Régénérer :  node scripts/gen-landing-showcase.mjs
 *
 * Relevé le ${stamp}. Ces valeurs sont rendues dès le premier paint pour que la fiche du hero
 * n'attende NI une fonction serverless NI le réveil de Neon (mesuré à 1,25 s en local, davantage
 * en production). useLandingData rafraîchit ensuite en arrière-plan et corrige les chiffres.
 *
 * Elles vieillissent donc entre deux exécutions du script : le cours et les multiples surtout.
 * C'est assumé, l'affichage se corrige en une seconde côté client.
 */
import type { LandingCriterion, LandingShowcase, LandingStock } from '../components/landing/useLandingData.js';

/** Date du relevé, pour savoir d'un coup d'œil si le fichier a vieilli. */
export const SHOWCASE_AS_OF = '${stamp}';

export const FROZEN_SLOTS: LandingShowcase[] = ${JSON.stringify(slots, null, 2)};

export const FROZEN_ROWS: LandingStock[] = ${JSON.stringify(rows, null, 2)};

export const FROZEN_PEA_ROWS: LandingStock[] = ${JSON.stringify(peaRows, null, 2)};

/** Référencé pour que le type reste importé même si l'inférence suffit. */
export type { LandingCriterion };
`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, body);

  console.log(`\n✅ ${path.relative(ROOT, OUT)} (relevé du ${stamp})`);
  for (const [i, s] of slots.entries()) {
    const label = ['hero', 'mécanisme', 'connecteur'][i] ?? `slot ${i}`;
    console.log(`   ${label.padEnd(11)} ${s.stock.ticker.padEnd(8)} ${s.stock.note10}/10 · résilience ${s.resilience?.grade ?? '—'} · ${s.criteria.length} critères`);
  }
  console.log(`   veille      ${rows.map(r => r.ticker).join(', ')}`);
  console.log(`   PEA         ${peaRows.map(r => r.ticker).join(', ')}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
