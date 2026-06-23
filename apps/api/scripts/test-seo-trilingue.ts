// Test offline du refactor trilingue de renderTickerHtml.
// Verifie : html lang, og:locale, hreflang count, canonical, inLanguage, title.
// Lance via : pnpm --filter @lubin/api exec tsx scripts/test-seo-trilingue.ts
import { renderTickerHtml } from '../src/routes/seoPrerender.js';

const mock = {
  ticker: 'AAPL',
  name: 'Apple Inc.',
  sector: 'Technology',
  scoreChiffres: 9,
  scoreChiffresMax: 10,
  pfcfTTM: 28.5,
  currency: 'USD',
  price: 220.5,
  opportunity: true,
  region: 'us',
  exchange: 'NASDAQ',
};

const related = [
  { ticker: 'MSFT', name: 'Microsoft Corp', scoreChiffres: 10, scoreChiffresMax: 10, pfcfTTM: 35.2 },
  { ticker: 'GOOGL', name: 'Alphabet Inc', scoreChiffres: 9, scoreChiffresMax: 10, pfcfTTM: 22.8 },
];

const expected = {
  fr: { lang: 'fr', ogLocale: 'fr_FR', inLang: 'fr-FR', titleStarts: "Faut-il acheter" },
  en: { lang: 'en', ogLocale: 'en_US', inLang: 'en-US', titleStarts: 'Should you buy' },
  es: { lang: 'es', ogLocale: 'es_ES', inLang: 'es-ES', titleStarts: '¿Comprar' },
};

let failed = 0;
for (const lang of ['fr', 'en', 'es'] as const) {
  const html = renderTickerHtml(mock, related, lang);
  const exp = expected[lang];
  const checks: Record<string, { got: string | number | null; want: string | number; ok: boolean }> = {
    htmlLang: { got: html.match(/<html lang="(\w+)">/)?.[1] ?? null, want: exp.lang, ok: false },
    ogLocale: { got: html.match(/og:locale" content="(\w+)"/)?.[1] ?? null, want: exp.ogLocale, ok: false },
    inLanguage: { got: html.match(/"inLanguage":\s*"([^"]+)"/)?.[1] ?? null, want: exp.inLang, ok: false },
    canonical: {
      got: html.match(/canonical" href="([^"]+)"/)?.[1] ?? null,
      want: lang === 'fr' ? 'https://lubin-investment.com/analyse/AAPL' : `https://lubin-investment.com/analyse/AAPL?lng=${lang}`,
      ok: false,
    },
    hreflangCount: { got: (html.match(/rel="alternate" hreflang="/g) || []).length, want: 4, ok: false }, // fr/en/es/x-default
    titlePrefix: {
      got: (html.match(/<title>([^<]{1,40})/)?.[1] ?? '').slice(0, exp.titleStarts.length),
      want: exp.titleStarts,
      ok: false,
    },
  };
  for (const k of Object.keys(checks)) {
    const c = checks[k]!;
    c.ok = String(c.got) === String(c.want);
    if (!c.ok) failed++;
  }
  console.log(`\n=== Lang ${lang} ===`);
  for (const [k, v] of Object.entries(checks)) {
    const mark = v.ok ? 'OK ' : 'KO';
    console.log(`  [${mark}] ${k}: got="${v.got}" want="${v.want}"`);
  }
}

console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} checks failed.`);
process.exit(failed === 0 ? 0 : 1);
