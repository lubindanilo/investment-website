// 🔒 VERROU PRODUIT — Title de la home.
//
// Décision manuelle (Lubin) : le title de la home est VOLONTAIREMENT long (~75-80 car.) avec
// la marque « | Lubin Investment » en suffixe. Ce n'est PAS un bug de longueur : les agents SEO
// (bot second-brain) N'ONT PAS le droit de le raccourcir ni de le modifier.
//
// Ce check tourne dans le job REQUIS `no-dashes` (.github/workflows/content-lint.yml). Toute PR
// qui modifie une des sources du title de la home fait donc échouer un check requis de la
// protection de `main` -> elle ne peut pas être auto-mergée (filet auto-merge-seo.yml inclus).
//
// Le title de la home a 3 sources qui DOIVENT rester identiques (sinon navigateurs et Googlebot
// se contredisent) :
//   1. apps/web/index.html                       : <title> (avec marque) + og:title/twitter:title (sans marque)
//   2. apps/web/src/i18n/locales/{fr,en,es}.json  : seo.home.title (avec marque)
//   3. apps/api/src/routes/seoPrerender.ts        : STATIC_SEO path '/' -> title fr/en/es (avec marque, source vue par Googlebot)
//
// Pour changer LÉGITIMEMENT le title (décision humaine) : modifier les sources ci-dessus ET les
// valeurs attendues ci-dessous, dans le MÊME commit.

import { readFileSync } from 'node:fs';

// Title verrouillé, avec la marque en suffixe (les 3 sources doivent porter cette valeur).
const EXPECTED = {
  fr: 'Surperforme le marché avec des actions de qualité au bon prix | Lubin Investment',
  en: 'Beat the market with quality stocks at the right price | Lubin Investment',
  es: 'Supera al mercado con acciones de calidad al precio justo | Lubin Investment',
};
// og:title / twitter:title dans index.html : même phrase FR, SANS la marque.
const OG_FR = 'Surperforme le marché avec des actions de qualité au bon prix';

const errors = [];
const must = (cond, msg) => { if (!cond) errors.push(msg); };

// 1. apps/web/index.html
const html = readFileSync('apps/web/index.html', 'utf8');
must(html.includes(`<title>${EXPECTED.fr}</title>`),
  `index.html : <title> ne correspond pas au verrou\n     attendu : "${EXPECTED.fr}"`);
must(html.includes(`<meta property="og:title" content="${OG_FR}" />`),
  `index.html : og:title ne correspond pas au verrou\n     attendu : "${OG_FR}"`);
must(html.includes(`<meta name="twitter:title" content="${OG_FR}" />`),
  `index.html : twitter:title ne correspond pas au verrou\n     attendu : "${OG_FR}"`);

// 2. i18n seo.home.title
for (const [lang, expected] of Object.entries(EXPECTED)) {
  const path = `apps/web/src/i18n/locales/${lang}.json`;
  const actual = JSON.parse(readFileSync(path, 'utf8'))?.seo?.home?.title;
  must(actual === expected,
    `${path} : seo.home.title ne correspond pas au verrou\n     attendu : "${expected}"\n     trouvé  : "${actual ?? '(absent)'}"`);
}

// 3. apps/api/src/routes/seoPrerender.ts (STATIC_SEO home, vu par Googlebot)
const prerender = readFileSync('apps/api/src/routes/seoPrerender.ts', 'utf8');
for (const [lang, expected] of Object.entries(EXPECTED)) {
  must(prerender.includes(`title: '${expected}'`),
    `seoPrerender.ts : STATIC_SEO '/' title[${lang}] ne correspond pas au verrou\n     attendu : "${expected}"`);
}

if (errors.length) {
  console.error('❌ VERROU du title de la home enfreint.');
  console.error('   Le title de la home est une décision produit verrouillée : les agents SEO ne doivent pas le modifier.');
  console.error('   Si ce changement est intentionnel (décision humaine), mets à jour les sources ET les valeurs');
  console.error('   attendues dans scripts/check-home-title.mjs dans le même commit.\n');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('✅ Title de la home conforme au verrou (3 sources cohérentes).');
