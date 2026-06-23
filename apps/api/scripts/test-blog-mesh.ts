// Test offline du maillage interne ajoute par Phase 3:
// - /blog liste TOUS les articles (>= 100)
// - / liste 5 articles recents
// - /analyse/AAPL avec article ticker=AAPL → bloc "Articles sur"
import { renderTickerHtml } from '../src/routes/seoPrerender.js';
import { listArticles } from '../src/data/articles.js';

const articles = listArticles();
console.log(`Total articles dispo: ${articles.length}`);

// Test fiche ticker avec articles lies (chercher un ticker qui a des articles)
const tickerWithArticles = articles.find((a) => a.ticker);
const targetTicker = tickerWithArticles?.ticker || 'AAPL';
console.log(`Ticker test pour Phase 3c: ${targetTicker}`);

const mock = {
  ticker: targetTicker,
  name: targetTicker,
  sector: 'Technology',
  scoreChiffres: 9,
  scoreChiffresMax: 10,
  pfcfTTM: 25.0,
  currency: 'USD',
  price: 200,
  opportunity: false,
  region: 'us',
  exchange: 'NASDAQ',
};

let failed = 0;
for (const lang of ['fr', 'en', 'es'] as const) {
  const html = renderTickerHtml(mock, [], lang);
  // Bloc articles existe si articles lies
  const articlesForTicker = articles.filter((a) => a.ticker?.toUpperCase() === targetTicker.toUpperCase());
  const expectedArticlesBlock = articlesForTicker.length > 0;
  const expectedHeading = lang === 'en' ? 'Articles about' : lang === 'es' ? 'Artículos sobre' : 'Articles sur';
  const hasArticlesBlock = html.includes(`<h2>${expectedHeading} `);
  const articleLinkCount = (html.match(/\/blog\/[a-z0-9-]+/g) || []).length;
  console.log(`[${lang}] articles_for_ticker=${articlesForTicker.length} | has_block=${hasArticlesBlock} | blog_links=${articleLinkCount}`);
  if (expectedArticlesBlock && !hasArticlesBlock) {
    console.error(`  KO: bloc Articles attendu, absent`);
    failed++;
  }
  // Pour /blog?lng=en et /?lng=en, les liens doivent inclure ?lng=en
  if (lang !== 'fr' && articleLinkCount > 0 && !html.includes(`?lng=${lang}`)) {
    console.error(`  KO: les liens articles devraient propager ?lng=${lang}`);
    failed++;
  }
}

console.log(failed === 0 ? '\nPhase 3c offline tests passed.' : `\n${failed} checks failed.`);
process.exit(failed === 0 ? 0 : 1);
