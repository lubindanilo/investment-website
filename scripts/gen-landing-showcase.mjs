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
 * Les valeurs figées sont donc rendues DÈS le premier paint, sans squelette, et la landing
 * n'appelle plus l'API du tout (cf. useLandingData) : ce fichier EST ce que voit le visiteur.
 *
 * LES CRITÈRES SONT FIGÉS DANS LES TROIS LANGUES
 * Le nom d'un critère et sa valeur sont du contenu généré, donc localisés côté API (« Marge
 * nette » / « Net margin » / « Margen neto », « 0.57 ans » / « 0.57 years »). Comme plus rien
 * n'est demandé au serveur au chargement, on interroge la vitrine UNE FOIS PAR LANGUE et on
 * fige les trois réponses ; le front choisit au rendu. Ne figer que le français afficherait
 * une fiche française aux visiteurs anglophones et hispanophones (régression corrigée le
 * 2026-08-04). Le script refuse d'écrire si l'API n'a pas réellement traduit.
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

/** Les langues du site (mêmes codes que SUPPORTED_LANGS côté web et API_LANGS côté API). */
const LANGS = ['fr', 'en', 'es'];

async function get(url, lang = 'fr') {
  const r = await fetch(`${API}${url}`, { headers: { 'Accept-Language': lang } });
  if (!r.ok) throw new Error(`${url} [${lang}] → HTTP ${r.status}`);
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

/**
 * Un emplacement de vitrine à partir des TROIS réponses du même titre (une par langue).
 *
 * La clé du critère (`netMargin`, `ccc`…) et son statut ne dépendent pas de la langue : ils sont
 * pris sur la réponse française et servent à vérifier que les trois listes parlent bien des mêmes
 * critères, dans le même ordre. Seuls le libellé et la valeur sont conservés par langue.
 */
function toSlot(byLang) {
  const ref = byLang.fr;
  const criteria = (ref.criteria ?? []).map((c, i) => {
    if (!c.key) throw new Error(`${ref.ticker} : critère sans clé (« ${c.name} ») — API trop ancienne ?`);
    const name = {};
    const value = {};
    for (const lang of LANGS) {
      const same = byLang[lang].criteria?.[i];
      if (!same || same.key !== c.key) {
        throw new Error(`${ref.ticker} : critères désalignés entre fr (${c.key}) et ${lang} (${same?.key ?? '—'})`);
      }
      name[lang] = same.name;
      value[lang] = same.value;
    }
    return { key: c.key, status: c.status, name, value };
  });
  // Sans snapshot en cache, l'API renvoie une liste vide : la fiche s'afficherait sans ses dix
  // critères, c'est-à-dire sans ce qu'elle est censée démontrer. Mieux vaut ne rien écrire.
  if (!criteria.length) throw new Error(`${ref.ticker} : aucun critère renvoyé (snapshot absent) — la fiche serait vide`);
  return {
    stock: toStock(ref),
    criteria,
    resilience: ref.resilience ?? null,
    pfcfPercentile: ref.pfcfPercentile ?? null,
  };
}

/**
 * Filet anti-régression : si l'API a servi du français aux trois requêtes (en-tête ignoré, cache
 * partagé entre langues, catalogue incomplet…), les dix libellés sont identiques d'une langue à
 * l'autre. On préfère alors ne rien écrire plutôt que de renvoyer la landing en français pour
 * les anglophones — c'est exactement le bug corrigé le 2026-08-04.
 */
function assertLocalized(slots) {
  for (const s of slots) {
    for (const lang of LANGS.filter(l => l !== 'fr')) {
      const names = s.criteria.map(c => c.name[lang]).join('|');
      if (names === s.criteria.map(c => c.name.fr).join('|')) {
        throw new Error(`${s.stock.ticker} : libellés identiques en fr et en ${lang} — l'API n'a pas traduit`);
      }
    }
  }
}

async function main() {
  console.log(`Source : ${API}`);
  // Les lignes de veille et PEA ne contiennent aucun texte généré (ticker, nom, secteur, chiffres) :
  // une seule requête suffit. La vitrine, elle, en contient dix par titre → une requête par langue.
  const [monitor, pea] = await Promise.all([get(ENDPOINTS.monitor), get(ENDPOINTS.pea)]);
  const byLang = {};
  for (const lang of LANGS) {
    // Séquentiel : le cache de /showcase ne garde qu'une langue à la fois côté serveur.
    byLang[lang] = await get(ENDPOINTS.showcase, lang).then(r => (Array.isArray(r) ? r : [r]));
    console.log(`   vitrine ${lang} : ${byLang[lang].map(s => s.ticker).join(', ')}`);
  }

  // La vitrine est choisie par le serveur : si la base bouge entre deux requêtes, les trois
  // réponses ne parlent plus des mêmes sociétés et le mélange donnerait une fiche incohérente.
  const tickers = byLang.fr.map(s => s.ticker).join(',');
  for (const lang of LANGS) {
    const got = byLang[lang].map(s => s.ticker).join(',');
    if (got !== tickers) throw new Error(`la vitrine a changé entre deux requêtes (fr : ${tickers} / ${lang} : ${got}) — relance le script`);
  }

  const slots = byLang.fr.map((_, i) => toSlot(Object.fromEntries(LANGS.map(l => [l, byLang[l][i]]))));
  if (!slots.length) throw new Error('vitrine vide : rien à figer');
  assertLocalized(slots);
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
 * en production) : la landing ne fait AUCUN appel réseau, ce fichier est ce que voit le visiteur.
 *
 * Les valeurs vieillissent donc entre deux exécutions du script : le cours et les multiples
 * surtout, les notes et la résilience beaucoup plus lentement.
 *
 * Chaque critère porte son libellé et sa valeur dans les TROIS langues du site : le nom comme
 * les unités sont du contenu localisé côté API, et le front n'a plus personne à qui les demander.
 */
import type { FrozenCriterion, FrozenShowcase, LandingStock } from '../components/landing/useLandingData.js';

/** Date du relevé, pour savoir d'un coup d'œil si le fichier a vieilli. */
export const SHOWCASE_AS_OF = '${stamp}';

export const FROZEN_SLOTS: FrozenShowcase[] = ${JSON.stringify(slots, null, 2)};

export const FROZEN_ROWS: LandingStock[] = ${JSON.stringify(rows, null, 2)};

export const FROZEN_PEA_ROWS: LandingStock[] = ${JSON.stringify(peaRows, null, 2)};

/** Référencé pour que le type reste importé même si l'inférence suffit. */
export type { FrozenCriterion };
`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, body);

  console.log(`\n✅ ${path.relative(ROOT, OUT)} (relevé du ${stamp})`);
  for (const [i, s] of slots.entries()) {
    const label = ['hero', 'mécanisme', 'connecteur'][i] ?? `slot ${i}`;
    console.log(`   ${label.padEnd(11)} ${s.stock.ticker.padEnd(8)} ${s.stock.note10}/10 · résilience ${s.resilience?.grade ?? '—'} · ${s.criteria.length} critères`);
  }
  // Preuve visible que les trois langues sont bien figées, sur le premier critère du hero.
  const proof = slots[0].criteria[0];
  console.log(`   langues     ${LANGS.map(l => `${l} « ${proof.name[l]} : ${proof.value[l]} »`).join(' · ')}`);
  console.log(`   veille      ${rows.map(r => r.ticker).join(', ')}`);
  console.log(`   PEA         ${peaRows.map(r => r.ticker).join(', ')}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
