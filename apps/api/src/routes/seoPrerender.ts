/**
 * Dynamic Rendering, pré-rendu HTML server-side pour les crawlers/bots.
 *
 * Problème résolu : notre SPA Vite n'a pas de SSR. Le HTML initial est ~2 Ko avec
 * un <div id="root"></div> vide et un <title> générique. Googlebot rend bien le JS
 * mais pour /analyse/:ticker il voit une page de chargement (le temps que l'API
 * /api/analyze tourne 10-30 s) et classe ça en « Soft 404 ».
 *
 * Solution recommandée par Google (cf. dynamic-rendering doc) : détecter les bots
 * via User-Agent et leur renvoyer un HTML pré-rendu riche, statique, avec :
 *   - <title> + meta description spécifiques au ticker
 *   - <h1>, <h2>, paragraphes textuels, le bot a quelque chose à indexer
 *   - URL canonique, og:title, twitter:card spécifiques
 *   - Lien vers l'app SPA pour les humains qui arriveraient ici
 *
 * Les utilisateurs humains ne passent jamais par ici, le rewrite Vercel conditionne
 * la redirection au User-Agent (regex bots). Les humains gardent la SPA interactive.
 *
 * Sécurité : on ne révèle que des données publiques (note de qualité, ticker, secteur).
 * Aucune donnée privée n'est exposée.
 */
import { Router, type Request, type Response } from 'express';
import { prisma } from '../db/client.js';
// ⚠️ Imports de valeur (`getArticleBySlug`, `toArticleLang`) interdits depuis '@lubin/shared'
//, pas de build dist/, crash lambda Vercel. On consomme la copie locale apps/api/src/data/.
// Les types restent OK à puiser depuis '@lubin/shared' (effacés à la compilation).
import { getArticleBySlug, toArticleLang } from '../data/articles.js';
import type { Article, ArticleLang } from '@lubin/shared';

export const seoPrerenderRouter: Router = Router();

const SITE_URL = process.env.SITE_URL || 'https://lubin-investment.com';

// Échappement HTML pour éviter injection via name/sector qui viennent de sources externes.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Note /10 lisible pour humains et bots (5 → "5", 10 → "10/10").
function formatScore(score: number | null, max: number | null): string {
  if (score == null || !max || max <= 0) return ', ';
  return `${score}/10`;
}

// Adjectif qualitatif basé sur la note, utilisé dans la meta description.
function qualityLabel(score: number | null, max: number | null): string {
  if (score == null || !max) return 'à analyser';
  const ratio = score / max;
  if (ratio >= 0.8) return 'élevée';
  if (ratio >= 0.5) return 'moyenne';
  return 'faible';
}

// Réponse 404 pour ticker inexistant, important : un VRAI 404 (pas un soft 404).
function render404(ticker: string): string {
  const safeTicker = escapeHtml(ticker);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${safeTicker} introuvable · Lubin Investment</title>
<meta name="description" content="Le ticker ${safeTicker} n'est pas couvert par Lubin Investment ou n'a pas encore été scoré.">
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${SITE_URL}/screener">
</head>
<body>
<h1>Ticker ${safeTicker} introuvable</h1>
<p>Ce symbole n'est pas couvert par notre veille ou n'a pas encore été scoré.</p>
<p><a href="${SITE_URL}/screener">Explorer le screener</a> · <a href="${SITE_URL}/analyser">Analyser un autre titre</a></p>
</body>
</html>`;
}

// HTML pré-rendu riche pour un ticker scoré. C'est le cœur du fix Soft 404 :
// 3-5 Ko de texte indexable, structure sémantique H1/H2, vraies meta tags.
function renderTickerHtml(t: {
  ticker: string;
  name: string | null;
  sector: string | null;
  scoreChiffres: number | null;
  scoreChiffresMax: number | null;
  pfcfTTM: number | null;
  currency: string | null;
  price: number | null;
  opportunity: boolean;
  region: string;
  exchange: string | null;
}): string {
  const safeTicker = escapeHtml(t.ticker);
  const name = t.name ? escapeHtml(t.name) : safeTicker;
  const sector = t.sector ? escapeHtml(t.sector) : 'secteur non renseigné';
  const score = formatScore(t.scoreChiffres, t.scoreChiffresMax);
  const quality = qualityLabel(t.scoreChiffres, t.scoreChiffresMax);
  const pfcf = t.pfcfTTM != null && isFinite(t.pfcfTTM) ? `${t.pfcfTTM.toFixed(1)}×` : ', ';
  const price = t.price != null && isFinite(t.price) ? `${t.price.toFixed(2)} ${escapeHtml(t.currency || 'USD')}` : ', ';
  const oppBadge = t.opportunity
    ? `<p><strong>⭐ Opportunité du moment :</strong> ${name} est dans son décile bas historique de valorisation (P/FCF ≤ 10ᵉ percentile sur 10 ans, ET ratio &lt; 25×). C'est un point d'entrée potentiellement intéressant pour les investisseurs long terme.</p>`
    : '';

  const canonical = `${SITE_URL}/analyse/${safeTicker}`;
  // Maillage hub-spoke : lien vers le hub de son secteur (réduit la profondeur de crawl).
  const sectorHubHref = t.sector ? `${SITE_URL}/secteur/${slugifySector(t.sector)}` : null;
  const sectorHubLabel = t.sector ? escapeHtml(displaySector(t.sector)) : null;
  const rawName = t.name || t.ticker;

  // Titre ≤ 60 caractères (Google tronque ~61 % des titres plus longs), mot-clé en
  // tête, SANS suffixe de marque (Google ajoute déjà le nom du site). Nom tronqué au besoin.
  const titleTail = score !== ', ' ? ` : analyse, note ${score}` : ' : analyse fondamentale';
  const tickerPart = ` (${t.ticker})`;
  let titleName = rawName;
  const nameBudget = 60 - tickerPart.length - titleTail.length;
  if (titleName.length > nameBudget) {
    let cut = rawName.slice(0, Math.max(6, nameBudget - 1));
    const lastSpace = cut.lastIndexOf(' ');
    if (lastSpace > 8) cut = cut.slice(0, lastSpace); // coupe sur un mot entier
    titleName = cut.trimEnd() + '…';
  }
  const rawTitle = `${titleName}${tickerPart}${titleTail}`;
  const title = escapeHtml(rawTitle);

  const rawDescription = `${rawName} (${t.ticker}) : note de qualité ${score} sur 10 critères financiers objectifs. Qualité ${quality}, P/FCF ${pfcf}, secteur ${t.sector || 'non renseigné'}.`;
  const description = escapeHtml(rawDescription);

  // Fraîcheur, signal fort pour le SEO et les moteurs IA (contenu maintenu).
  const now = new Date();
  const isoDate = now.toISOString();
  const dateFr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  // FAQ, levier GEO majeur (FAQPage = ~3,2× plus de citations dans les AI Overviews).
  const faq: { q: string; a: string }[] = [
    {
      q: `${rawName} (${t.ticker}) est-elle une action de qualité ?`,
      a: `${rawName} obtient une note de qualité de ${score} (qualité ${quality}), calculée sur 10 critères financiers objectifs : rentabilité, croissance du chiffre d'affaires et du free cash flow, rachats d'actions, marges, endettement et rendement du capital.`,
    },
    {
      q: `Comment est calculée la note de ${t.ticker} ?`,
      a: `La note est le total des critères validés (OUI / PARTIEL / NON) selon des seuils issus de la littérature financière (Warren Buffett, Mauboussin, Aswath Damodaran), de façon automatique et sans opinion humaine.`,
    },
    ...(t.pfcfTTM != null && isFinite(t.pfcfTTM)
      ? [{
          q: `Quel est le P/FCF de ${rawName} ?`,
          a: `Le multiple cours / free cash flow (P/FCF) de ${rawName} ressort à ${pfcf}. Chez Lubin Investment, la valorisation est jugée séparément de la qualité.`,
        }]
      : []),
    {
      q: `Où voir l'analyse complète de ${t.ticker} ?`,
      a: `L'analyse interactive complète (détail des 10 critères, historiques, valorisation P/FCF, comparaisons sectorielles) est disponible sur ${canonical}.`,
    },
  ];

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${canonical}">

<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Lubin Investment">
<meta property="og:locale" content="fr_FR">
<meta property="og:image" content="${SITE_URL}/og-default.png">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${SITE_URL}/og-default.png">

<!-- Schema.org JSON-LD : aide Google + moteurs IA à parser le contenu (rich results, citations GEO) -->
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'AnalysisNewsArticle',
  headline: rawTitle,
  description: rawDescription,
  url: canonical,
  inLanguage: 'fr-FR',
  datePublished: isoDate,
  dateModified: isoDate,
  about: {
    '@type': 'Corporation',
    name: rawName,
    tickerSymbol: t.ticker,
    ...(t.exchange ? { tickerExchange: t.exchange } : {}),
  },
  publisher: {
    '@type': 'Organization',
    name: 'Lubin Investment',
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` },
  },
  mainEntityOfPage: canonical,
}, null, 2)}
</script>

<!-- FAQPage : fort signal pour les AI Overviews / réponses génératives -->
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}, null, 2)}
</script>

<!-- Fil d'Ariane -->
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Screener', item: `${SITE_URL}/screener` },
    { '@type': 'ListItem', position: 3, name: `${rawName} (${t.ticker})`, item: canonical },
  ],
}, null, 2)}
</script>
</head>
<body>

<header>
  <p><a href="${SITE_URL}/">Lubin Investment</a> · <a href="${SITE_URL}/screener">Screener</a> · <a href="${SITE_URL}/methodologie">Méthodologie</a> · <a href="${SITE_URL}/pricing">Tarifs</a></p>
</header>

<main>

<nav aria-label="Fil d'Ariane"><a href="${SITE_URL}/">Accueil</a> › <a href="${SITE_URL}/screener">Screener</a> ${sectorHubHref ? `› <a href="${sectorHubHref}">${sectorHubLabel}</a> ` : ''}› ${name} (${safeTicker})</nav>

<h1>Analyse fondamentale ${safeTicker} (${name})</h1>
<p><small>Mis à jour le ${dateFr}</small></p>

<p><strong>Note de qualité : ${score}</strong> sur 10 critères financiers objectifs (qualité ${quality}).
Secteur : ${sector}.
${t.exchange ? `Place de cotation : ${escapeHtml(t.exchange)}. ` : ''}
Cours actuel : ${price}.
${t.pfcfTTM != null ? `Multiple de valorisation (P/FCF) : ${pfcf}.` : ''}</p>

${oppBadge}

<h2>Méthode de notation Lubin</h2>
<p>La note de ${name} (${safeTicker}) est calculée automatiquement à partir de 10 critères financiers objectifs, sans intervention humaine ni opinion. Chaque critère est validé (OUI / PARTIEL / NON) en fonction de seuils issus de la littérature financière (Warren Buffett, Bettin-Mauboussin, Aswath Damodaran). La note finale est le total des validations.</p>

<h2>Les 10 critères chiffrés analysés</h2>
<ol>
<li><strong>Rentable</strong> : marge nette positive</li>
<li><strong>Ventes en croissance</strong> : chiffre d'affaires &gt; 10 %/an sur 5 ans (régression Theil-Sen robuste aux outliers)</li>
<li><strong>Profits par action en croissance</strong> : FCF par action ajusté de la rémunération en actions, &gt; 10 %/an sur 5 ans</li>
<li><strong>Nombre d'actions maîtrisé</strong> : stable ou en baisse (rachats nets = création de valeur pour l'actionnaire)</li>
<li><strong>Profitabilité cash</strong> : marge de free cash flow &gt; 10 % du chiffre d'affaires</li>
<li><strong>Marges en expansion</strong> : la marge opérationnelle s'élargit sur 5 ans (operating leverage)</li>
<li><strong>Rendement du capital investi</strong> : Cash ROCE Bettin-Mauboussin &gt; 15 % par an</li>
<li><strong>Endettement maîtrisé</strong> : dette nette remboursable en moins de 3 ans de free cash flow</li>
<li><strong>Bénéfices transformés en cash</strong> : le free cash flow excède le bénéfice net comptable</li>
<li><strong>Délai d'encaissement net</strong> : cycle de conversion du cash (DSO + DIO − DPO) en baisse ou négatif</li>
</ol>

<h2>Sources de données</h2>
<p>L'analyse de ${safeTicker} s'appuie sur des sources publiques autoritatives :
SEC EDGAR (XBRL des 10-K et 10-Q déposés à la SEC) pour les fondamentaux trimestriels US,
Finnhub pour les compléments et la couverture internationale,
Yahoo Finance pour les données de marché,
stockanalysis.com pour les trimestriels EU et internationaux.</p>

<h2>Questions fréquentes</h2>
${faq.map((f) => `<h3>${escapeHtml(f.q)}</h3>\n<p>${escapeHtml(f.a)}</p>`).join('\n')}

<h2>Aller plus loin</h2>
<p>👉 <a href="${canonical}"><strong>Voir l'analyse complète et interactive de ${safeTicker}</strong></a> : tous les critères détaillés, graphiques d'historique, valorisation, comparaisons sectorielles, et qualitatif business pour les abonnés Pro.</p>

<p>Autres ressources :
<a href="${SITE_URL}/methodologie">Méthodologie détaillée</a> ·
${sectorHubHref ? `<a href="${sectorHubHref}">Toutes les actions du secteur ${sectorHubLabel}</a> ·\n` : ''}<a href="${SITE_URL}/classement/qualite-10-sur-10">Les actions notées 10 sur 10</a> ·
<a href="${SITE_URL}/screener">Top des entreprises de qualité</a> ·
<a href="${SITE_URL}/pricing">Tarifs Lubin Investment</a>.</p>

</main>

<footer>
<p><small>Lubin Investment est un outil d'aide à la décision pour investisseurs particuliers. Ce service ne constitue pas un conseil en investissement personnalisé au sens de l'article L.321-1 du Code monétaire et financier. Les performances passées ne préjugent pas des performances futures.</small></p>
</footer>

</body>
</html>`;
}

// GET /analyse/:ticker, servi UNIQUEMENT aux bots (via rewrite Vercel conditionnel).
// Les humains arrivent ici via la SPA (rewrite catch-all → index.html).
seoPrerenderRouter.get('/analyse/:ticker', async (req: Request, res: Response) => {
  const raw = req.params.ticker;
  const ticker = (typeof raw === 'string' ? raw : '').toUpperCase().slice(0, 32);
  if (!ticker || !/^[A-Z0-9.\-]+$/.test(ticker)) {
    res.status(400).set('Content-Type', 'text/html; charset=utf-8').send(render404(ticker || '?'));
    return;
  }

  try {
    const t = await prisma.screenerTicker.findUnique({
      where: { ticker },
      select: {
        ticker: true,
        name: true,
        sector: true,
        scoreChiffres: true,
        scoreChiffresMax: true,
        pfcfTTM: true,
        currency: true,
        price: true,
        opportunity: true,
        region: true,
        exchange: true,
        status: true,
      },
    });

    if (!t || t.status !== 'scored') {
      // Pas encore scoré (ou ticker inconnu) → vrai 404 indexable
      res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(render404(ticker));
      return;
    }

    // Cache CDN : on peut se permettre 1h, les notes bougent lentement.
    res
      .status(200)
      .set('Content-Type', 'text/html; charset=utf-8')
      .set('Cache-Control', 'public, max-age=3600, s-maxage=3600')
      .send(renderTickerHtml(t));
  } catch (err) {
    // En cas d'erreur DB, on renvoie un 503 plutôt qu'une page vide, Google retentera plus tard.
    console.error('[seoPrerender]', ticker, (err as Error).message);
    res.status(503).set('Content-Type', 'text/html; charset=utf-8').send(render404(ticker));
  }
});

// Auteur (E-E-A-T / YMYL) : Person identifié + bio basée sur l'EXPÉRIENCE et la
// transparence (pas de diplôme inventé). Levier de confiance en finance.
const AUTHOR_NAME = 'Lubin Danilo';
const AUTHOR_JOBTITLE: Record<ArticleLang, string> = {
  fr: 'Fondateur de Lubin Investment',
  en: 'Founder of Lubin Investment',
  es: 'Fundador de Lubin Investment',
};
const AUTHOR_BYLINE: Record<ArticleLang, string> = {
  fr: 'Par Lubin Danilo, fondateur de Lubin Investment',
  en: 'By Lubin Danilo, founder of Lubin Investment',
  es: 'Por Lubin Danilo, fundador de Lubin Investment',
};
const AUTHOR_BIO: Record<ArticleLang, string> = {
  fr: "Écrit par Lubin Danilo, fondateur de Lubin Investment. Investisseur particulier autodidacte, j'analyse les actions par les fondamentaux depuis plusieurs années et j'investis mon propre argent avec cette méthode. Je l'ai codifiée dans un outil qui juge séparément la qualité d'un business et son prix, à partir de critères inspirés de la littérature financière (Warren Buffett, Michael Mauboussin, Aswath Damodaran).",
  en: "Written by Lubin Danilo, founder of Lubin Investment. A self-taught individual investor, I have analyzed stocks through their fundamentals for several years and invest my own money with this method. I codified it into a tool that judges a company's quality and its price separately, using criteria drawn from the financial literature (Warren Buffett, Michael Mauboussin, Aswath Damodaran).",
  es: "Escrito por Lubin Danilo, fundador de Lubin Investment. Inversor particular autodidacta, analizo acciones por sus fundamentales desde hace varios años e invierto mi propio dinero con este método. Lo codifiqué en una herramienta que juzga por separado la calidad de un negocio y su precio, con criterios inspirados en la literatura financiera (Warren Buffett, Michael Mauboussin, Aswath Damodaran).",
};

// ─── Article de blog : pré-rendu riche pour les bots/IA (3 langues via ?lng) ──
function renderArticleHtml(article: Article, lang: ArticleLang): string {
  const c = article.content[lang];
  const base = `${SITE_URL}/blog/${article.slug}`;
  const canonical = lang === 'fr' ? base : `${base}?lng=${lang}`;
  const htmlLang = lang;
  const ogLocale = lang === 'en' ? 'en_US' : lang === 'es' ? 'es_ES' : 'fr_FR';
  const title = escapeHtml(c.title);
  const description = escapeHtml(c.metaDescription);
  const datePublished = `${article.date}T08:00:00Z`;
  const dateModified = `${article.updated}T08:00:00Z`;

  const hreflang = (['fr', 'en', 'es'] as const)
    .map((l) => `<link rel="alternate" hreflang="${l}" href="${l === 'fr' ? base : `${base}?lng=${l}`}">`)
    .join('\n');

  const bodyHtml = c.body
    .map((b) => {
      if (b.type === 'h2') return `<h2>${escapeHtml(b.text)}</h2>`;
      if (b.type === 'ul') return `<ul>${b.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
      return `<p>${escapeHtml(b.text)}</p>`;
    })
    .join('\n');

  const faqHtml = c.faq.map((f) => `<h3>${escapeHtml(f.q)}</h3>\n<p>${escapeHtml(f.a)}</p>`).join('\n');

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.title,
    description: c.metaDescription,
    url: canonical,
    inLanguage: `${lang}`,
    datePublished,
    dateModified,
    author: {
      '@type': 'Person',
      name: AUTHOR_NAME,
      jobTitle: AUTHOR_JOBTITLE[lang],
      description: AUTHOR_BIO[lang],
      worksFor: { '@type': 'Organization', name: 'Lubin Investment', url: SITE_URL },
      url: SITE_URL,
      sameAs: ['https://www.linkedin.com/in/lubin-danilo/'],
    },
    publisher: {
      '@type': 'Organization',
      name: 'Lubin Investment',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` },
    },
    mainEntityOfPage: canonical,
  };
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: c.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: c.title, item: canonical },
    ],
  };

  const ctaHref = article.ticker ? `${SITE_URL}/analyse/${article.ticker}` : `${SITE_URL}/analyser`;

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${canonical}">
${hreflang}
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Lubin Investment">
<meta property="og:locale" content="${ogLocale}">
<meta property="og:image" content="${SITE_URL}/og-default.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${SITE_URL}/og-default.png">
<script type="application/ld+json">${JSON.stringify(articleLd, null, 2)}</script>
<script type="application/ld+json">${JSON.stringify(faqLd, null, 2)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd, null, 2)}</script>
</head>
<body>
<header>
  <p><a href="${SITE_URL}/">Lubin Investment</a> · <a href="${SITE_URL}/blog">Blog</a></p>
</header>
<main>
<nav aria-label="Fil d'Ariane"><a href="${SITE_URL}/">Accueil</a> › <a href="${SITE_URL}/blog">Blog</a></nav>
<h1>${escapeHtml(c.title)}</h1>
<p><small>${escapeHtml(article.date)} · <span rel="author">${escapeHtml(AUTHOR_BYLINE[lang])}</span></small></p>
<p><strong>${escapeHtml(c.answer)}</strong></p>
${bodyHtml}
<h2>FAQ</h2>
${faqHtml}
<p><a href="${ctaHref}"><strong>${article.ticker ? `Voir l'analyse ${escapeHtml(article.ticker)} sur Lubin Investment` : 'Analyser une action sur Lubin Investment'}</strong></a></p>
<h2>${lang === 'en' ? 'About the author' : lang === 'es' ? 'Sobre el autor' : "À propos de l'auteur"}</h2>
<p>${escapeHtml(AUTHOR_BIO[lang])}</p>
<footer><p><small>${escapeHtml(c.disclaimer)}</small></p></footer>
</main>
</body>
</html>`;
}

// GET /blog/:slug, servi UNIQUEMENT aux bots (rewrite Vercel conditionnel). ?lng=en|es.
seoPrerenderRouter.get('/blog/:slug', (req: Request, res: Response) => {
  const slug = String(req.params.slug || '').slice(0, 128);
  const article = getArticleBySlug(slug);
  if (!article) {
    res
      .status(404)
      .set('Content-Type', 'text/html; charset=utf-8')
      .send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Article introuvable · Lubin Investment</title><meta name="robots" content="noindex,follow"><link rel="canonical" href="${SITE_URL}/blog"></head><body><h1>Article introuvable</h1><p><a href="${SITE_URL}/blog">Retour au blog</a></p></body></html>`);
    return;
  }
  const lng = toArticleLang(typeof req.query.lng === 'string' ? req.query.lng : 'fr');
  res
    .status(200)
    .set('Content-Type', 'text/html; charset=utf-8')
    .set('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    .send(renderArticleHtml(article, lng));
});

// ─── Pages-hub (SPEC-001) : maillent les 5000 /analyse, réduisent la profondeur ─────
// de crawl et distribuent le PageRank interne. C'est le levier d'indexation.
export function slugifySector(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' et ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
// Affichage propre du nom de secteur (sans tiret, préférence Lubin).
function displaySector(s: string): string {
  return s.replace(/\s*-\s*/g, ' ').trim();
}

type HubRow = {
  ticker: string; name: string | null;
  scoreChiffres: number | null; scoreChiffresMax: number | null; pfcfTTM: number | null;
};

function renderHubHtml(o: { title: string; h1: string; intro: string; path: string; rows: HubRow[] }): string {
  const canonical = `${SITE_URL}${o.path}`;
  const title = escapeHtml(o.title);
  const description = escapeHtml(o.intro.slice(0, 158));
  const rowsHtml = o.rows.map((r, i) => {
    const name = escapeHtml(r.name || r.ticker);
    const tk = escapeHtml(r.ticker);
    const score = r.scoreChiffres != null && r.scoreChiffresMax ? `${r.scoreChiffres}/${r.scoreChiffresMax}` : 'n.d.';
    const pfcf = r.pfcfTTM != null && isFinite(r.pfcfTTM) ? `${r.pfcfTTM.toFixed(1)}x` : 'n.d.';
    return `<tr><td>${i + 1}</td><td><a href="${SITE_URL}/analyse/${tk}">${name} (${tk})</a></td><td>${score}</td><td>${pfcf}</td></tr>`;
  }).join('\n');
  const itemListLd = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: o.rows.map((r, i) => ({
      '@type': 'ListItem', position: i + 1,
      url: `${SITE_URL}/analyse/${r.ticker}`, name: `${r.name || r.ticker} (${r.ticker})`,
    })),
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Screener', item: `${SITE_URL}/screener` },
      { '@type': 'ListItem', position: 3, name: o.h1, item: canonical },
    ],
  };
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Lubin Investment">
<meta property="og:locale" content="fr_FR">
<script type="application/ld+json">${JSON.stringify(itemListLd, null, 2)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd, null, 2)}</script>
</head>
<body>
<header><p><a href="${SITE_URL}/">Lubin Investment</a> · <a href="${SITE_URL}/screener">Screener</a> · <a href="${SITE_URL}/methodologie">Méthodologie</a></p></header>
<main>
<nav aria-label="Fil d'Ariane"><a href="${SITE_URL}/">Accueil</a> › <a href="${SITE_URL}/screener">Screener</a> › ${escapeHtml(o.h1)}</nav>
<h1>${escapeHtml(o.h1)}</h1>
<p>${escapeHtml(o.intro)}</p>
<table>
<thead><tr><th>#</th><th>Action</th><th>Note qualité</th><th>P/FCF</th></tr></thead>
<tbody>
${rowsHtml}
</tbody>
</table>
<p>Notre note de qualité juge la solidité du business sur 10 critères financiers objectifs (rentabilité, croissance du free cash flow, rachats d'actions, endettement, rendement du capital). Le P/FCF (prix rapporté au free cash flow, le cash réellement généré) mesure si l'action est chère ou bon marché. Méthode complète : <a href="${SITE_URL}/methodologie">notre méthodologie</a>.</p>
<p><a href="${SITE_URL}/screener">Explorer le screener complet</a></p>
</main>
</body>
</html>`;
}

const HUB_SELECT = { ticker: true, name: true, scoreChiffres: true, scoreChiffresMax: true, pfcfTTM: true } as const;

// GET /secteur/:slug : meilleures actions d'un secteur (servi aux bots).
seoPrerenderRouter.get('/secteur/:slug', async (req: Request, res: Response) => {
  const slug = String(req.params.slug || '').toLowerCase().slice(0, 80);
  try {
    const distinct = await prisma.screenerTicker.findMany({
      where: { status: 'scored', sector: { not: null } }, distinct: ['sector'], select: { sector: true },
    });
    const sector = distinct.map((d) => d.sector).find((s): s is string => !!s && slugifySector(s) === slug);
    if (!sector) { res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(render404(slug)); return; }
    const rows = await prisma.screenerTicker.findMany({
      where: { status: 'scored', sector }, orderBy: { scoreRatio: 'desc' }, take: 60, select: HUB_SELECT,
    });
    const disp = displaySector(sector);
    res.status(200).set('Content-Type', 'text/html; charset=utf-8').set('Cache-Control', 'public, max-age=3600, s-maxage=3600').send(renderHubHtml({
      title: `Meilleures actions de qualité : ${disp}`,
      h1: `Meilleures actions de qualité du secteur ${disp}`,
      intro: `Les actions du secteur ${disp} les mieux notées par notre analyse fondamentale, classées de la meilleure qualité à la moins bonne, avec leur valorisation (P/FCF). Clique sur une action pour son analyse détaillée.`,
      path: `/secteur/${slug}`, rows,
    }));
  } catch (err) {
    console.error('[hub secteur]', slug, (err as Error).message);
    res.status(503).set('Content-Type', 'text/html; charset=utf-8').send(render404(slug));
  }
});

// GET /classement/:slug : best-of (qualite-10-sur-10, sous-evaluees).
seoPrerenderRouter.get('/classement/:slug', async (req: Request, res: Response) => {
  const slug = String(req.params.slug || '').toLowerCase().slice(0, 80);
  try {
    let rows: HubRow[]; let title: string; let h1: string; let intro: string;
    if (slug === 'qualite-10-sur-10') {
      const raw = await prisma.screenerTicker.findMany({
        where: { status: 'scored' }, orderBy: { scoreRatio: 'desc' }, take: 200, select: HUB_SELECT,
      });
      rows = raw.filter((r) => r.scoreChiffres != null && r.scoreChiffresMax != null && r.scoreChiffres >= r.scoreChiffresMax).slice(0, 100);
      title = 'Actions notées 10 sur 10 : la qualité maximale';
      h1 = 'Les actions notées 10 sur 10 par notre analyse';
      intro = `Toutes les actions qui obtiennent la note de qualité maximale sur nos 10 critères financiers objectifs (rentabilité, croissance du cash, faible endettement, rachats d'actions). Une note parfaite ne dit rien du prix : regarde aussi le P/FCF.`;
    } else if (slug === 'sous-evaluees') {
      rows = await prisma.screenerTicker.findMany({
        where: { status: 'scored', opportunity: true }, orderBy: { scoreRatio: 'desc' }, take: 100, select: HUB_SELECT,
      });
      title = 'Actions de qualité sous-évaluées en ce moment';
      h1 = 'Actions de qualité actuellement sous-évaluées';
      intro = `Les actions de qualité dont la valorisation (P/FCF, le prix rapporté au cash généré) est dans le bas de sa fourchette historique. Une bonne entreprise à un prix raisonnable, le coeur de notre méthode.`;
    } else {
      res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(render404(slug)); return;
    }
    res.status(200).set('Content-Type', 'text/html; charset=utf-8').set('Cache-Control', 'public, max-age=3600, s-maxage=3600').send(renderHubHtml({
      title, h1, intro, path: `/classement/${slug}`, rows,
    }));
  } catch (err) {
    console.error('[hub classement]', slug, (err as Error).message);
    res.status(503).set('Content-Type', 'text/html; charset=utf-8').send(render404(slug));
  }
});

// ─── Pages statiques (SPA) pré-rendues pour les bots ────────────────────────
// La home et les pages cœur (/screener, /methodologie, /blog, /pricing, /analyser,
// /compare) sont servies aux humains en SPA (coquille sans canonical ni h1). Pour les
// bots, on renvoie un HTML statique avec title/meta/canonical/h1/h2 + maillage interne.
// Humains inchangés (rewrite Vercel conditionné au User-Agent).
type StaticSeo = {
  path: string; title: string; desc: string; h1: string; intro: string;
  sections: { h2: string; p: string }[];
  links: { href: string; label: string }[];
  website?: boolean;
};

function renderStaticHtml(o: StaticSeo): string {
  const canonical = `${SITE_URL}${o.path === '/' ? '/' : o.path}`;
  const title = escapeHtml(o.title);
  const description = escapeHtml(o.desc.slice(0, 158));
  const sectionsHtml = o.sections
    .map((s) => `<h2>${escapeHtml(s.h2)}</h2>\n<p>${escapeHtml(s.p)}</p>`)
    .join('\n');
  const linksHtml = o.links
    .map((l) => `<a href="${SITE_URL}${l.href}">${escapeHtml(l.label)}</a>`)
    .join(' · ');
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE_URL}/` },
      ...(o.path === '/' ? [] : [{ '@type': 'ListItem', position: 2, name: o.h1, item: canonical }]),
    ],
  };
  const websiteLd = o.website
    ? `\n<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org', '@type': 'WebSite', name: 'Lubin Investment',
        url: `${SITE_URL}/`, inLanguage: 'fr',
      })}</script>\n<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Organization', name: 'Lubin Investment',
        url: `${SITE_URL}/`, logo: `${SITE_URL}/icon-512.png`,
      })}</script>`
    : '';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Lubin Investment">
<meta property="og:locale" content="fr_FR">
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>${websiteLd}
</head>
<body>
<header><p><a href="${SITE_URL}/">Lubin Investment</a> · <a href="${SITE_URL}/screener">Screener</a> · <a href="${SITE_URL}/methodologie">Méthodologie</a> · <a href="${SITE_URL}/blog">Blog</a></p></header>
<main>
<nav aria-label="Fil d'Ariane"><a href="${SITE_URL}/">Accueil</a>${o.path === '/' ? '' : ` › ${escapeHtml(o.h1)}`}</nav>
<h1>${escapeHtml(o.h1)}</h1>
<p>${escapeHtml(o.intro)}</p>
${sectionsHtml}
<p>${linksHtml}</p>
</main>
</body>
</html>`;
}

const STATIC_SEO: StaticSeo[] = [
  {
    path: '/',
    title: "Analyse fondamentale d'actions : la qualité et le prix",
    desc: "Tapez un ticker : note de qualité sur 10 critères financiers objectifs et valorisation (P/FCF) jugée à part. Plus de 7000 actions suivies en continu.",
    h1: 'Trouvez les entreprises de qualité, sans le bruit',
    intro: "Lubin Investment note chaque action sur 10 critères financiers objectifs (rentabilité, croissance du cash, rachats d'actions, endettement, rendement du capital) et juge le prix séparément via le P/FCF. Une méthode, pas des opinions.",
    sections: [
      { h2: 'Comment ça marche', p: "Tapez un ticker, lisez la note sur 10 et son détail, puis décidez du prix d'entrée. La qualité du business et le prix de l'action sont jugés séparément : c'est la règle d'or de la méthode." },
      { h2: 'Une méthode transparente', p: 'Les critères s\'appuient sur la littérature financière (Warren Buffett, Michael Mauboussin, Aswath Damodaran). Aucune opinion, aucune boîte noire : la donnée décide.' },
      { h2: 'Aller plus loin', p: 'Explorez le classement des actions notées 10 sur 10, les actions de qualité sous-évaluées, le screener complet, ou la méthodologie détaillée.' },
    ],
    links: [
      { href: '/analyser', label: 'Analyser une action' },
      { href: '/screener', label: 'Screener' },
      { href: '/classement/qualite-10-sur-10', label: 'Actions notées 10 sur 10' },
      { href: '/classement/sous-evaluees', label: 'Actions sous-évaluées' },
      { href: '/methodologie', label: 'Méthodologie' },
      { href: '/blog', label: 'Blog' },
    ],
    website: true,
  },
  {
    path: '/screener',
    title: 'Screener d\'actions : note de qualité et P/FCF',
    desc: 'Le screener Lubin trie des milliers d\'actions par note de qualité (10 critères) et par valorisation (P/FCF). Trouvez les entreprises solides au bon prix.',
    h1: 'Screener : les meilleures actions de qualité',
    intro: 'Filtrez les actions par note de qualité sur 10 critères financiers objectifs et par valorisation (P/FCF, le prix rapporté au cash généré). Le screener met en tête les entreprises les plus solides.',
    sections: [
      { h2: 'Qualité d\'abord, prix ensuite', p: 'Chaque action reçoit une note sur 10 (solidité du business) et un P/FCF (cher ou bon marché). Les deux sont jugés séparément pour éviter de payer trop cher une bonne entreprise.' },
      { h2: 'Classements prêts à l\'emploi', p: 'Consultez directement les actions notées 10 sur 10, ou les actions de qualité actuellement sous-évaluées.' },
    ],
    links: [
      { href: '/classement/qualite-10-sur-10', label: 'Actions notées 10 sur 10' },
      { href: '/classement/sous-evaluees', label: 'Actions sous-évaluées' },
      { href: '/methodologie', label: 'Notre méthodologie' },
    ],
  },
  {
    path: '/methodologie',
    title: 'Méthodologie : 10 critères, sources publiques',
    desc: 'Comment Lubin note une action : 10 critères financiers objectifs, seuils issus de la littérature (Buffett, Mauboussin, Damodaran), zéro opinion, zéro boîte noire.',
    h1: '10 critères, sources publiques, zéro boîte noire',
    intro: 'La note de qualité repose sur 10 critères financiers objectifs, validés selon des seuils tirés de la littérature financière. Le calcul est automatique et sans opinion humaine.',
    sections: [
      { h2: 'Les 10 critères de qualité', p: 'Rentabilité, croissance des ventes et du free cash flow, rachats d\'actions, marges, profitabilité cash, rendement du capital (Cash ROCE), endettement maîtrisé, conversion du bénéfice en cash, cycle de trésorerie.' },
      { h2: 'La valorisation, jugée à part', p: 'Le P/FCF (prix rapporté au free cash flow) mesure si l\'action est chère ou bon marché. Une bonne entreprise à mauvais prix reste un mauvais placement.' },
    ],
    links: [
      { href: '/analyser', label: 'Analyser une action' },
      { href: '/screener', label: 'Screener' },
    ],
  },
  {
    path: '/blog',
    title: 'Blog : analyse fondamentale et méthode',
    desc: 'Analyses d\'actions par les fondamentaux, méthode P/FCF et lecture de l\'actualité par la qualité. Le blog de Lubin Investment, en clair.',
    h1: 'Comprendre les marchés avec méthode',
    intro: 'Des analyses fondamentales d\'actions, la méthode de valorisation par les flux de trésorerie, et une lecture de l\'actualité au prisme de la qualité.',
    sections: [
      { h2: 'Pédagogique et chiffré', p: 'Chaque article explique les termes, montre les chiffres réels, et raconte la thèse au-delà des nombres (moat, management, risques).' },
    ],
    links: [
      { href: '/analyser', label: 'Analyser une action' },
      { href: '/methodologie', label: 'Méthodologie' },
    ],
  },
  {
    path: '/pricing',
    title: 'Tarifs : Lubin Investment, gratuit et Pro',
    desc: 'Analysez gratuitement n\'importe quelle action (note /10 + valorisation). Pro : analyses illimitées, analyse qualitative, comparaisons et données complètes.',
    h1: 'Investir avec méthode, pas avec des opinions',
    intro: 'Le plan gratuit donne la note de qualité et la valorisation de n\'importe quelle action. Le plan Pro débloque l\'analyse qualitative, les comparaisons et les données complètes.',
    sections: [
      { h2: 'Gratuit', p: 'Note de qualité sur 10 critères, valorisation P/FCF, screener et watchlist. De quoi décider sur n\'importe quelle action.' },
      { h2: 'Pro', p: 'Analyses illimitées, analyse qualitative (business et management), opportunités, comparaisons jusqu\'à 5 actions, données Europe et international.' },
    ],
    links: [
      { href: '/analyser', label: 'Analyser une action' },
      { href: '/methodologie', label: 'Méthodologie' },
    ],
  },
  {
    path: '/analyser',
    title: 'Analyser une action : qualité et valorisation',
    desc: 'Tapez un ticker et obtenez en quelques secondes une note de qualité sur 10 critères et une valorisation (P/FCF) jugée séparément.',
    h1: 'Analyser une action',
    intro: 'Entrez un ticker (par exemple AAPL, MSFT ou ASML) pour obtenir sa note de qualité sur 10 critères financiers objectifs et sa valorisation par le free cash flow.',
    sections: [
      { h2: 'Une note, un prix', p: 'La note juge la solidité du business ; le P/FCF juge le prix. Vous repartez avec les deux, séparément.' },
    ],
    links: [
      { href: '/screener', label: 'Screener' },
      { href: '/classement/qualite-10-sur-10', label: 'Actions notées 10 sur 10' },
    ],
  },
  {
    path: '/compare',
    title: 'Comparer des actions : qualité et prix',
    desc: 'Mettez 2 à 5 actions côte à côte : note de qualité, 10 critères et valorisation (P/FCF). La donnée décide, ligne par ligne.',
    h1: 'Comparer des actions',
    intro: 'Placez 2 à 5 actions côte à côte pour comparer leur note de qualité, le détail des 10 critères et leur valorisation (P/FCF). La meilleure de chaque ligne est mise en avant.',
    sections: [
      { h2: 'Comparer ce qui compte', p: 'Au lieu d\'opposer des cours, on compare la qualité du business et le prix payé pour le cash généré.' },
    ],
    links: [
      { href: '/analyser', label: 'Analyser une action' },
      { href: '/screener', label: 'Screener' },
    ],
  },
];

const STATIC_BY_PATH: Record<string, StaticSeo> = Object.fromEntries(STATIC_SEO.map((s) => [s.path, s]));

for (const seo of STATIC_SEO) {
  seoPrerenderRouter.get(seo.path, (_req: Request, res: Response) => {
    res.status(200)
      .set('Content-Type', 'text/html; charset=utf-8')
      .set('Cache-Control', 'public, max-age=3600, s-maxage=86400')
      .send(renderStaticHtml(STATIC_BY_PATH[seo.path]!));
  });
}
