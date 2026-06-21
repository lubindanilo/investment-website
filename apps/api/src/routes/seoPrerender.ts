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

// Convertit les liens markdown [libellé](/url) en vrais <a> (texte échappé).
// Les liens internes (/...) sont rendus absolus pour les bots. À utiliser pour tout
// texte d'article susceptible de contenir des liens (paragraphes, listes, FAQ).
function renderInline(text: string): string {
  const MD = /\[([^\]]+)\]\(([^)]+)\)/g;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = MD.exec(text)) !== null) {
    out += escapeHtml(text.slice(last, m.index));
    const raw = m[2] ?? '';
    const href = raw.startsWith('/') ? `${SITE_URL}${raw}` : raw;
    out += `<a href="${escapeHtml(href)}">${escapeHtml(m[1] ?? '')}</a>`;
    last = m.index + m[0].length;
  }
  out += escapeHtml(text.slice(last));
  return out;
}

// Note /10 lisible pour humains et bots (5 → "5", 10 → "10/10").
function formatScore(score: number | null, max: number | null): string {
  if (score == null || !max || max <= 0) return ', ';
  return `${score}/10`;
}

// Nettoie le nom d'une société de ses suffixes juridiques (Inc, Corp, Ltd, Class B…)
// pour garder le nom de marque connu du grand public dans les titles/descs SEO.
// Cas typiques :
//   "Apple Inc" → "Apple" · "Microsoft Corporation" → "Microsoft"
//   "Berkshire Hathaway Inc Class B" → "Berkshire Hathaway"
//   "Procter & Gamble Co" → "Procter & Gamble" · "Sea Limited" → "Sea"
// On garde le nom officiel dans le JSON-LD Corporation (entity-matching Google).
function stripLegalSuffix(name: string): string {
  if (!name) return name;
  const legalRe = /\s+(Incorporated|Inc|Corporation|Corp|Company|Co|Limited|Ltd|PLC|Plc|LLC|LP|N\.?V\.?|S\.?A\.?|AG|SE|AS|AB|S\.?p\.?A\.?)\.?$/i;
  const classRe = /\s+Class\s+[A-Z]$/i;
  // Ponctuation / connecteur trainant après strip (ex. « JPMorgan Chase & Co » → « JPMorgan Chase & »
  // → on enlève le « & » résiduel ; « Sumitomo Mitsui Financial Group, Inc. » → on enlève la virgule).
  const trailingJunkRe = /(\s*[,;]+\s*$)|(\s+(?:and|et|&)\s*$)/i;
  let result = name;
  // Loop pour gérer combos (« Inc Class B », ponctuation après suffixe…).
  for (let i = 0; i < 4; i++) {
    const before = result;
    result = result.replace(classRe, '').replace(legalRe, '').replace(trailingJunkRe, '');
    if (result === before) break;
  }
  return result.trim() || name; // fallback : si on a tout coupé, garde l'original
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
<link rel="icon" type="image/svg+xml" href="${SITE_URL}/favicon.svg">
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
function renderTickerHtml(
  t: {
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
  },
  related: Array<{
    ticker: string;
    name: string | null;
    scoreChiffres: number | null;
    scoreChiffresMax: number | null;
    pfcfTTM: number | null;
  }> = [],
): string {
  const safeTicker = escapeHtml(t.ticker);
  const name = t.name ? escapeHtml(t.name) : safeTicker;
  const sector = t.sector ? escapeHtml(t.sector) : 'secteur non renseigné';
  const score = formatScore(t.scoreChiffres, t.scoreChiffresMax);
  const quality = qualityLabel(t.scoreChiffres, t.scoreChiffresMax);
  const pfcf = t.pfcfTTM != null && isFinite(t.pfcfTTM) ? `${t.pfcfTTM.toFixed(1)}×` : ', ';
  // Clause P/FCF inline, ajoutée à la phrase de verdict UNIQUEMENT si on a la donnée.
  const pfcfClause = t.pfcfTTM != null && isFinite(t.pfcfTTM)
    ? `, et un multiple de valorisation P/FCF de ${pfcf}`
    : '';
  const price = t.price != null && isFinite(t.price) ? `${t.price.toFixed(2)} ${escapeHtml(t.currency || 'USD')}` : ', ';
  const oppBadge = t.opportunity
    ? `<p><strong>⭐ Opportunité du moment :</strong> ${name} est dans son décile bas historique de valorisation (P/FCF ≤ 10ᵉ percentile sur 10 ans, ET ratio &lt; 25×). C'est un point d'entrée potentiellement intéressant pour les investisseurs long terme.</p>`
    : '';

  const canonical = `${SITE_URL}/analyse/${safeTicker}`;
  // Maillage hub-spoke : lien vers le hub de son secteur (réduit la profondeur de crawl).
  const sectorHubHref = t.sector ? `${SITE_URL}/secteur/${slugifySector(t.sector)}` : null;
  const sectorHubLabel = t.sector ? escapeHtml(displaySector(t.sector)) : null;
  const rawName = t.name || t.ticker;
  // Nom de marque (sans suffixe juridique) pour les textes user-facing.
  // Le nom officiel reste utilisé dans le JSON-LD Corporation (entity-matching).
  const displayName = stripLegalSuffix(rawName);
  const displayNameEsc = escapeHtml(displayName);

  // Titre format question + verdict, vraie phrase plutôt qu'assemblage de mots-clés.
  // « l'action » + nom de marque (sans suffixe juridique) pour lire naturel.
  // Nom tronqué si besoin pour viser ≤ 60 car (Google tronque souvent au-delà).
  const titlePrefix = `Faut-il acheter l'action `;
  const titleSuffix = ' ? Notre analyse complète.';
  let titleName = displayName;
  const nameBudget = 60 - titlePrefix.length - titleSuffix.length;
  if (titleName.length > nameBudget) {
    let cut = displayName.slice(0, Math.max(6, nameBudget - 1));
    const lastSpace = cut.lastIndexOf(' ');
    if (lastSpace > 8) cut = cut.slice(0, lastSpace); // coupe sur un mot entier
    titleName = cut.trimEnd() + '…';
  }
  const rawTitle = `${titlePrefix}${titleName}${titleSuffix}`;
  const title = escapeHtml(rawTitle);

  const rawDescription = `On a analysé les fondamentaux et la valorisation de l'action ${displayName} : voici nos conclusions.`;
  const description = escapeHtml(rawDescription);

  // Fraîcheur, signal fort pour le SEO et les moteurs IA (contenu maintenu).
  const now = new Date();
  const isoDate = now.toISOString();
  const dateFr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  // FAQ, levier GEO majeur (FAQPage = ~3,2× plus de citations dans les AI Overviews).
  const faq: { q: string; a: string }[] = [
    {
      q: `L'action ${displayName} est-elle de qualité ?`,
      a: `L'action ${displayName} obtient une note de qualité de ${score} (qualité ${quality}), calculée sur les 10 critères de Lubin Investment : rentabilité, croissance du chiffre d'affaires et du free cash flow, rachats d'actions, marges, endettement et rendement du capital.`,
    },
    {
      q: `Comment est calculée la note de ${displayName} ?`,
      a: `La note est le total des critères validés (OUI / PARTIEL / NON) selon des seuils issus de la littérature financière (Warren Buffett, Mauboussin, Aswath Damodaran), de façon automatique et sans opinion humaine.`,
    },
    ...(t.pfcfTTM != null && isFinite(t.pfcfTTM)
      ? [{
          q: `Quel est le P/FCF de ${displayName} ?`,
          a: `Le multiple cours / free cash flow (P/FCF) de l'action ${displayName} ressort à ${pfcf}. Chez Lubin Investment, la valorisation est jugée séparément de la qualité.`,
        }]
      : []),
    {
      q: `Où voir l'analyse complète de ${displayName} ?`,
      a: `L'analyse interactive complète (détail des 10 critères, historiques, valorisation P/FCF, comparaisons sectorielles) est disponible sur ${canonical}.`,
    },
  ];

  // Maillage interne : 3-5 tickers comparables (même secteur), liens cliquables avec score + P/FCF
  // en anchor text pour donner du contexte à Google. Construit un graphe que Googlebot crawle facilement.
  const sectorLabel = t.sector ? escapeHtml(displaySector(t.sector)) : null;
  const relatedHeading = sectorLabel ? `Autres actions du secteur ${sectorLabel}` : 'Autres actions à explorer';
  const relatedSection = related.length > 0 ? `

<h2>${relatedHeading}</h2>
<ul>
${related.map((r) => {
  const rTicker = escapeHtml(r.ticker);
  const rRawName = r.name || r.ticker;
  const rDisplayName = escapeHtml(stripLegalSuffix(rRawName));
  const rScore = r.scoreChiffres != null && r.scoreChiffresMax
    ? `${r.scoreChiffres}/${r.scoreChiffresMax}`
    : 'non noté';
  const rPfcf = r.pfcfTTM != null && isFinite(r.pfcfTTM)
    ? `${r.pfcfTTM.toFixed(1)}×`
    : null;
  return `<li><a href="${SITE_URL}/analyse/${rTicker}">${rDisplayName} (${rTicker})</a> — note ${rScore}${rPfcf ? `, P/FCF ${rPfcf}` : ''}</li>`;
}).join('\n')}
</ul>` : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${canonical}">
<link rel="icon" type="image/svg+xml" href="${SITE_URL}/favicon.svg">

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

<p>On a analysé l'action ${displayNameEsc} sur les 10 critères de qualité de Lubin Investment. L'entreprise obtient une note de <strong>${score}</strong> synonyme de qualité ${quality}${pfcfClause}.</p>

<p>Secteur : ${sector}.${t.exchange ? ` Place de cotation : ${escapeHtml(t.exchange)}.` : ''} Cours actuel : ${price}.</p>

${oppBadge}

<h2>Méthode de notation Lubin</h2>
<p>La note de ${name} (${safeTicker}) est calculée automatiquement à partir de 10 critères financiers objectifs, sans intervention humaine ni opinion. Chaque critère est validé (OUI / PARTIEL / NON) en fonction de seuils issus de la littérature financière (Warren Buffett, Bettin-Mauboussin, Aswath Damodaran). La note finale est le total des validations.</p>

<h2>Les 10 critères chiffrés analysés</h2>
<ol>
<li><strong>Rentable</strong> : marge nette positive</li>
<li><strong>Ventes en croissance</strong> : chiffre d'affaires &gt; 10 %/an sur 5 ans</li>
<li><strong>Profits par action en croissance</strong> : FCF par action ajusté de la rémunération en actions, &gt; 10 %/an sur 5 ans</li>
<li><strong>Nombre d'actions maîtrisé</strong> : stable ou en baisse (rachats nets = création de valeur pour l'actionnaire)</li>
<li><strong>Profitabilité cash</strong> : marge de free cash flow &gt; 10 % du chiffre d'affaires</li>
<li><strong>Marges en expansion</strong> : la marge opérationnelle s'élargit sur 5 ans (operating leverage)</li>
<li><strong>Rendement du capital investi</strong> : Cash ROCE Bettin-Mauboussin &gt; 15 % par an</li>
<li><strong>Endettement maîtrisé</strong> : dette nette remboursable en moins de 3 ans de free cash flow</li>
<li><strong>Bénéfices transformés en cash</strong> : le free cash flow excède le bénéfice net comptable</li>
<li><strong>Délai d'encaissement net</strong> : cycle de trésorerie court ou négatif</li>
</ol>

<h2>Questions fréquentes</h2>
${faq.map((f) => `<h3>${escapeHtml(f.q)}</h3>\n<p>${escapeHtml(f.a)}</p>`).join('\n')}
${relatedSection}

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

    // Maillage interne : 5 tickers du même secteur les mieux notés, exclus le courant.
    // Construit un graphe que Googlebot crawle facilement + signal de pertinence sectorielle.
    const related = t.sector
      ? await prisma.screenerTicker.findMany({
          where: { status: 'scored', sector: t.sector, NOT: { ticker: t.ticker } },
          orderBy: { scoreRatio: 'desc' },
          take: 5,
          select: { ticker: true, name: true, scoreChiffres: true, scoreChiffresMax: true, pfcfTTM: true },
        })
      : [];

    // Cache CDN : on peut se permettre 1h, les notes bougent lentement.
    res
      .status(200)
      .set('Content-Type', 'text/html; charset=utf-8')
      .set('Cache-Control', 'public, max-age=3600, s-maxage=3600')
      .send(renderTickerHtml(t, related));
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
      if (b.type === 'ul') return `<ul>${b.items.map((i) => `<li>${renderInline(i)}</li>`).join('')}</ul>`;
      if (b.type === 'table') {
        const thead = `<thead><tr>${b.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
        const tbody = `<tbody>${b.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`;
        return `<table style="border-collapse:collapse;width:100%">${thead}${tbody}</table>`;
      }
      return `<p>${renderInline(b.text)}</p>`;
    })
    .join('\n');

  const faqHtml = c.faq.map((f) => `<h3>${escapeHtml(f.q)}</h3>\n<p>${renderInline(f.a)}</p>`).join('\n');

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
<link rel="icon" type="image/svg+xml" href="${SITE_URL}/favicon.svg">
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
<p><strong>${renderInline(c.answer)}</strong></p>
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

// Chrome multilingue des hubs (fr/en/es). Le tableau (tickers/notes/P/FCF) est neutre ;
// seuls les libellés et le texte changent. Permet hreflang propre (SEO multilingue).
const HUB_T = {
  fr: {
    ogLocale: 'fr_FR', bcHome: 'Accueil', thAction: 'Action', thScore: 'Note qualité',
    methodo: "Notre note de qualité juge la solidité du business sur 10 critères financiers objectifs (rentabilité, croissance du free cash flow, rachats d'actions, endettement, rendement du capital). Le P/FCF (prix rapporté au free cash flow) mesure si l'action est chère ou bon marché. Méthode complète :",
    methodoLink: 'notre méthodologie', explore: 'Explorer le screener complet',
  },
  en: {
    ogLocale: 'en_US', bcHome: 'Home', thAction: 'Stock', thScore: 'Quality score',
    methodo: 'Our quality score judges how solid a business is across 10 objective financial criteria (profitability, free cash flow growth, share buybacks, debt, return on capital). The P/FCF (price to free cash flow) shows whether the stock is cheap or expensive. Full method:',
    methodoLink: 'our methodology', explore: 'Explore the full screener',
  },
  es: {
    ogLocale: 'es_ES', bcHome: 'Inicio', thAction: 'Acción', thScore: 'Nota de calidad',
    methodo: 'Nuestra nota de calidad juzga la solidez del negocio con 10 criterios financieros objetivos (rentabilidad, crecimiento del flujo de caja libre, recompras, deuda, rendimiento del capital). El P/FCF (precio respecto al flujo de caja libre) indica si la acción está cara o barata. Método completo:',
    methodoLink: 'nuestra metodología', explore: 'Explorar el screener completo',
  },
} as const;

function renderHubHtml(o: { title: string; h1: string; intro: string; path: string; rows: HubRow[]; lang: ArticleLang }): string {
  const tr = HUB_T[o.lang];
  const base = `${SITE_URL}${o.path}`;
  const canonical = o.lang === 'fr' ? base : `${base}?lng=${o.lang}`;
  const title = escapeHtml(o.title);
  const description = escapeHtml(o.intro.slice(0, 158));
  const hreflang = (['fr', 'en', 'es'] as const)
    .map((l) => `<link rel="alternate" hreflang="${l}" href="${l === 'fr' ? base : `${base}?lng=${l}`}">`)
    .join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${base}">`;
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
      { '@type': 'ListItem', position: 1, name: tr.bcHome, item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Screener', item: `${SITE_URL}/screener` },
      { '@type': 'ListItem', position: 3, name: o.h1, item: canonical },
    ],
  };
  return `<!DOCTYPE html>
<html lang="${o.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${canonical}">
<link rel="icon" type="image/svg+xml" href="${SITE_URL}/favicon.svg">
${hreflang}
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Lubin Investment">
<meta property="og:locale" content="${tr.ogLocale}">
<script type="application/ld+json">${JSON.stringify(itemListLd, null, 2)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd, null, 2)}</script>
</head>
<body>
<header><p><a href="${SITE_URL}/">Lubin Investment</a> · <a href="${SITE_URL}/screener">Screener</a> · <a href="${SITE_URL}/methodologie">Méthodologie</a></p></header>
<main>
<nav aria-label="Fil d'Ariane"><a href="${SITE_URL}/">${tr.bcHome}</a> › <a href="${SITE_URL}/screener">Screener</a> › ${escapeHtml(o.h1)}</nav>
<h1>${escapeHtml(o.h1)}</h1>
<p>${escapeHtml(o.intro)}</p>
<table>
<thead><tr><th>#</th><th>${tr.thAction}</th><th>${tr.thScore}</th><th>P/FCF</th></tr></thead>
<tbody>
${rowsHtml}
</tbody>
</table>
<p>${tr.methodo} <a href="${SITE_URL}/methodologie">${tr.methodoLink}</a>.</p>
<p><a href="${SITE_URL}/screener">${tr.explore}</a></p>
</main>
</body>
</html>`;
}

// Titres/intros des hubs par langue. La valeur secteur (disp) est passée telle quelle.
const HUB_COPY = {
  secteur: {
    fr: (d: string) => ({ title: `Meilleures actions de qualité : ${d}`, h1: `Meilleures actions de qualité du secteur ${d}`, intro: `Les actions du secteur ${d} les mieux notées par notre analyse fondamentale, classées de la meilleure qualité à la moins bonne, avec leur valorisation (P/FCF). Clique sur une action pour son analyse détaillée.` }),
    en: (d: string) => ({ title: `Best quality stocks: ${d}`, h1: `Best ${d} stocks by quality`, intro: `The ${d} stocks with the highest scores from our fundamental analysis, ranked from best to worst quality, with their valuation (P/FCF). Click a stock for its full analysis.` }),
    es: (d: string) => ({ title: `Mejores acciones de calidad: ${d}`, h1: `Mejores acciones de calidad del sector ${d}`, intro: `Las acciones del sector ${d} mejor puntuadas por nuestro análisis fundamental, ordenadas de mayor a menor calidad, con su valoración (P/FCF). Haz clic en una acción para su análisis completo.` }),
  },
  q10: {
    fr: { title: 'Actions notées 10 sur 10 : la qualité maximale', h1: 'Les actions notées 10 sur 10 par notre analyse', intro: `Toutes les actions qui obtiennent la note de qualité maximale sur nos 10 critères financiers objectifs (rentabilité, croissance du cash, faible endettement, rachats d'actions). Une note parfaite ne dit rien du prix : regarde aussi le P/FCF.` },
    en: { title: 'Stocks rated 10 out of 10: top quality', h1: 'Stocks rated 10 out of 10 by our analysis', intro: `All the stocks that score the maximum quality grade on our 10 objective financial criteria (profitability, cash growth, low debt, buybacks). A perfect score says nothing about price: check the P/FCF too.` },
    es: { title: 'Acciones con nota 10 sobre 10: calidad máxima', h1: 'Las acciones con nota 10 sobre 10 según nuestro análisis', intro: `Todas las acciones que obtienen la nota de calidad máxima en nuestros 10 criterios financieros objetivos (rentabilidad, crecimiento de caja, baja deuda, recompras). Una nota perfecta no dice nada del precio: mira también el P/FCF.` },
  },
  sousval: {
    fr: { title: 'Actions de qualité sous-évaluées en ce moment', h1: 'Actions de qualité actuellement sous-évaluées', intro: `Les actions de qualité dont la valorisation (P/FCF, le prix rapporté au cash généré) est dans le bas de sa fourchette historique. Une bonne entreprise à un prix raisonnable, le coeur de notre méthode.` },
    en: { title: 'Undervalued quality stocks right now', h1: 'Quality stocks currently undervalued', intro: `Quality stocks whose valuation (P/FCF, the price relative to the cash generated) is in the low end of its historical range. A good company at a reasonable price, the heart of our method.` },
    es: { title: 'Acciones de calidad infravaloradas ahora', h1: 'Acciones de calidad actualmente infravaloradas', intro: `Acciones de calidad cuya valoración (P/FCF, el precio respecto a la caja generada) está en la parte baja de su rango histórico. Una buena empresa a un precio razonable, el corazón de nuestro método.` },
  },
} as const;

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
    const lang = toArticleLang(typeof req.query.lng === 'string' ? req.query.lng : 'fr');
    // Titre ≤ 60 car : on borne le nom de secteur à 26 (sinon Google tronque les noms
    // longs comme "Drug Manufacturers...") ; laisse la place au préfixe traduit.
    const dispTitle = disp.length > 26 ? disp.slice(0, 25).trimEnd() + '…' : disp;
    const copy = HUB_COPY.secteur[lang](disp);
    res.status(200).set('Content-Type', 'text/html; charset=utf-8').set('Cache-Control', 'public, max-age=3600, s-maxage=3600').send(renderHubHtml({
      title: HUB_COPY.secteur[lang](dispTitle).title,
      h1: copy.h1, intro: copy.intro, path: `/secteur/${slug}`, rows, lang,
    }));
  } catch (err) {
    console.error('[hub secteur]', slug, (err as Error).message);
    res.status(503).set('Content-Type', 'text/html; charset=utf-8').send(render404(slug));
  }
});

// GET /classement/:slug : best-of (qualite-10-sur-10, sous-evaluees).
seoPrerenderRouter.get('/classement/:slug', async (req: Request, res: Response) => {
  const slug = String(req.params.slug || '').toLowerCase().slice(0, 80);
  const lang = toArticleLang(typeof req.query.lng === 'string' ? req.query.lng : 'fr');
  try {
    let rows: HubRow[]; let copy: { title: string; h1: string; intro: string };
    if (slug === 'qualite-10-sur-10') {
      const raw = await prisma.screenerTicker.findMany({
        where: { status: 'scored' }, orderBy: { scoreRatio: 'desc' }, take: 200, select: HUB_SELECT,
      });
      rows = raw.filter((r) => r.scoreChiffres != null && r.scoreChiffresMax != null && r.scoreChiffres >= r.scoreChiffresMax).slice(0, 100);
      copy = HUB_COPY.q10[lang];
    } else if (slug === 'sous-evaluees') {
      rows = await prisma.screenerTicker.findMany({
        where: { status: 'scored', opportunity: true }, orderBy: { scoreRatio: 'desc' }, take: 100, select: HUB_SELECT,
      });
      copy = HUB_COPY.sousval[lang];
    } else {
      res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(render404(slug)); return;
    }
    res.status(200).set('Content-Type', 'text/html; charset=utf-8').set('Cache-Control', 'public, max-age=3600, s-maxage=3600').send(renderHubHtml({
      title: copy.title, h1: copy.h1, intro: copy.intro, path: `/classement/${slug}`, rows, lang,
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
/** Contenu d'une page statique pour UNE langue. */
type StaticSeoContent = {
  title: string; desc: string; h1: string; intro: string;
  sections: { h2: string; p: string }[];
  links: { href: string; label: string }[];
  /** Détail des critères (page Méthodologie) : rendu en HTML lisible par les bots GEO
   *  qui n'exécutent PAS le JS (GPTBot, PerplexityBot, ClaudeBot) + ItemList JSON-LD. */
  criteria?: { n: number; name: string; formula: string; threshold: string; why: string }[];
};
type StaticSeo = {
  path: string;
  website?: boolean;
  /** Contenu trilingue. Le bot reçoit la langue demandée via ?lng= (défaut fr). */
  content: Record<ArticleLang, StaticSeoContent>;
};

/** Libellés d'interface du pré-rendu statique, par langue. */
const STATIC_TR: Record<ArticleLang, {
  home: string; criteriaH2: string; criteriaLdName: string; formula: string; threshold: string; ogLocale: string; nav: string;
}> = {
  fr: { home: 'Accueil', criteriaH2: 'Les 10 critères en détail', criteriaLdName: 'Les 10 critères de qualité de Lubin Investment', formula: 'Formule', threshold: 'Seuil', ogLocale: 'fr_FR', nav: 'Méthodologie' },
  en: { home: 'Home', criteriaH2: 'The 10 criteria in detail', criteriaLdName: "Lubin Investment's 10 quality criteria", formula: 'Formula', threshold: 'Threshold', ogLocale: 'en_US', nav: 'Methodology' },
  es: { home: 'Inicio', criteriaH2: 'Los 10 criterios en detalle', criteriaLdName: 'Los 10 criterios de calidad de Lubin Investment', formula: 'Fórmula', threshold: 'Umbral', ogLocale: 'es_ES', nav: 'Metodología' },
};

function renderStaticHtml(o: StaticSeo, lang: ArticleLang): string {
  const tr = STATIC_TR[lang];
  const c = o.content[lang];
  const base = `${SITE_URL}${o.path === '/' ? '/' : o.path}`;
  // Suffixe de langue pour les liens internes (fr = URL nue, en/es = ?lng=) + URL d'accueil localisée.
  const lq = lang === 'fr' ? '' : `?lng=${lang}`;
  const homeUrl = `${SITE_URL}/${lq}`;
  // Canonique propre à la langue (fr = URL nue, en/es = ?lng=) — cohérent avec le sitemap.
  const canonical = lang === 'fr' ? base : `${base}${base.includes('?') ? '&' : '?'}lng=${lang}`;
  const hreflang = (['fr', 'en', 'es'] as const)
    .map((l) => `<link rel="alternate" hreflang="${l}" href="${l === 'fr' ? base : `${base}?lng=${l}`}">`)
    .join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${base}">`;
  const title = escapeHtml(c.title);
  const description = escapeHtml(c.desc.slice(0, 158));
  const sectionsHtml = c.sections
    .map((s) => `<h2>${escapeHtml(s.h2)}</h2>\n<p>${escapeHtml(s.p)}</p>`)
    .join('\n');
  const linksHtml = c.links
    .map((l) => `<a href="${SITE_URL}${l.href}${lq}">${escapeHtml(l.label)}</a>`)
    .join(' · ');
  // Détail des critères (Méthodologie) : HTML sémantique servi aux bots (les crawlers GEO
  // ne rendent pas le JS, donc le contenu client-side leur est invisible sans ça).
  const criteriaHtml = c.criteria?.length
    ? `<h2>${escapeHtml(tr.criteriaH2)}</h2>\n<ol>\n${c.criteria
        .map((cr) => `  <li>\n    <h3>${escapeHtml(cr.name)}</h3>\n    <p><strong>${escapeHtml(tr.formula)} :</strong> ${escapeHtml(cr.formula)}</p>\n    <p><strong>${escapeHtml(tr.threshold)} :</strong> ${escapeHtml(cr.threshold)}</p>\n    <p>${escapeHtml(cr.why)}</p>\n  </li>`)
        .join('\n')}\n</ol>`
    : '';
  const criteriaLd = c.criteria?.length
    ? `\n<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: tr.criteriaLdName,
        itemListElement: c.criteria.map((cr) => ({
          '@type': 'ListItem', position: cr.n,
          name: cr.name, description: `${cr.why} (${tr.formula} : ${cr.formula} · ${tr.threshold} : ${cr.threshold})`,
        })),
      })}</script>`
    : '';
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: tr.home, item: homeUrl },
      ...(o.path === '/' ? [] : [{ '@type': 'ListItem', position: 2, name: c.h1, item: canonical }]),
    ],
  };
  const websiteLd = o.website
    ? `\n<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org', '@type': 'WebSite', name: 'Lubin Investment',
        url: `${SITE_URL}/`, inLanguage: lang,
      })}</script>\n<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Organization', name: 'Lubin Investment',
        url: `${SITE_URL}/`, logo: `${SITE_URL}/icon-512.png`,
      })}</script>`
    : '';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${canonical}">
<link rel="icon" type="image/svg+xml" href="${SITE_URL}/favicon.svg">
${hreflang}
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Lubin Investment">
<meta property="og:locale" content="${tr.ogLocale}">
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>${websiteLd}${criteriaLd}
</head>
<body>
<header><p><a href="${homeUrl}">Lubin Investment</a> · <a href="${SITE_URL}/screener${lq}">Screener</a> · <a href="${SITE_URL}/methodologie${lq}">${escapeHtml(tr.nav)}</a> · <a href="${SITE_URL}/blog${lq}">Blog</a></p></header>
<main>
<nav aria-label="Breadcrumb"><a href="${homeUrl}">${escapeHtml(tr.home)}</a>${o.path === '/' ? '' : ` › ${escapeHtml(c.h1)}`}</nav>
<h1>${escapeHtml(c.h1)}</h1>
<p>${escapeHtml(c.intro)}</p>
${sectionsHtml}
${criteriaHtml}
<p>${linksHtml}</p>
</main>
</body>
</html>`;
}

const STATIC_SEO: StaticSeo[] = [
  {
    path: '/',
    website: true,
    content: {
      fr: {
        title: 'Surperforme le marché avec des actions de qualité au bon prix',
        desc: "Repère en un clin d'œil les meilleures opportunités d'investissement parmi des milliers d'entreprises analysées en continu.",
        h1: "Trouve les actions à acheter aujourd'hui, en un coup d'œil",
        intro: "Achète des actions de qualité au bon prix : la stratégie qui surperforme l'indice sur le long terme. 7000+ actions analysées.",
        sections: [
          { h2: 'Comment ça marche', p: "Tapez un ticker, lisez la note sur 10 et son détail, puis décidez du prix d'entrée. La qualité du business et le prix de l'action sont jugés séparément : c'est la règle d'or de la méthode." },
          { h2: 'Une méthode transparente', p: "Les critères s'appuient sur la littérature financière (Warren Buffett, Michael Mauboussin, Aswath Damodaran). Aucune opinion, aucune boîte noire : la donnée décide." },
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
      },
      en: {
        title: 'Beat the market with quality stocks at the right price',
        desc: 'Spot the best investment opportunities at a glance, among thousands of companies analyzed continuously.',
        h1: 'Find the stocks to buy today, at a glance',
        intro: 'Buying quality stocks at the right price: the strategy that beats the index over the long term. 7,000+ stocks analyzed.',
        sections: [
          { h2: 'How it works', p: "Type a ticker, read the score out of 10 and its breakdown, then decide on your entry price. Business quality and share price are judged separately: that's the golden rule of the method." },
          { h2: 'A transparent method', p: 'The criteria draw on financial literature (Warren Buffett, Michael Mauboussin, Aswath Damodaran). No opinions, no black box: the data decides.' },
          { h2: 'Go further', p: 'Explore the ranking of stocks rated 10 out of 10, undervalued quality stocks, the full screener, or the detailed methodology.' },
        ],
        links: [
          { href: '/analyser', label: 'Analyze a stock' },
          { href: '/screener', label: 'Screener' },
          { href: '/classement/qualite-10-sur-10', label: 'Stocks rated 10 out of 10' },
          { href: '/classement/sous-evaluees', label: 'Undervalued stocks' },
          { href: '/methodologie', label: 'Methodology' },
          { href: '/blog', label: 'Blog' },
        ],
      },
      es: {
        title: 'Supera al mercado con acciones de calidad al precio justo',
        desc: 'Detecta de un vistazo las mejores oportunidades de inversión entre miles de empresas analizadas en continuo.',
        h1: 'Encuentra las acciones para comprar hoy, de un vistazo',
        intro: 'Comprar acciones de calidad al precio justo: la estrategia que supera al índice a largo plazo. Más de 7000 acciones analizadas.',
        sections: [
          { h2: 'Cómo funciona', p: 'Escribe un ticker, lee la nota sobre 10 y su detalle, y luego decide el precio de entrada. La calidad del negocio y el precio de la acción se juzgan por separado: es la regla de oro del método.' },
          { h2: 'Un método transparente', p: 'Los criterios se apoyan en la literatura financiera (Warren Buffett, Michael Mauboussin, Aswath Damodaran). Sin opiniones, sin caja negra: decide el dato.' },
          { h2: 'Ir más lejos', p: 'Explora el ranking de acciones con nota 10 sobre 10, las acciones de calidad infravaloradas, el screener completo o la metodología detallada.' },
        ],
        links: [
          { href: '/analyser', label: 'Analizar una acción' },
          { href: '/screener', label: 'Screener' },
          { href: '/classement/qualite-10-sur-10', label: 'Acciones con nota 10 sobre 10' },
          { href: '/classement/sous-evaluees', label: 'Acciones infravaloradas' },
          { href: '/methodologie', label: 'Metodología' },
          { href: '/blog', label: 'Blog' },
        ],
      },
    },
  },
  {
    path: '/screener',
    content: {
      fr: {
        title: "Screener d'actions : note de qualité et P/FCF",
        desc: "Le screener Lubin trie des milliers d'actions par note de qualité (10 critères) et par valorisation (P/FCF). Trouvez les entreprises solides au bon prix.",
        h1: 'Screener : les meilleures actions de qualité',
        intro: 'Filtrez les actions par note de qualité sur 10 critères financiers objectifs et par valorisation (P/FCF, le prix rapporté au cash généré). Le screener met en tête les entreprises les plus solides.',
        sections: [
          { h2: "Qualité d'abord, prix ensuite", p: 'Chaque action reçoit une note sur 10 (solidité du business) et un P/FCF (cher ou bon marché). Les deux sont jugés séparément pour éviter de payer trop cher une bonne entreprise.' },
          { h2: "Classements prêts à l'emploi", p: 'Consultez directement les actions notées 10 sur 10, ou les actions de qualité actuellement sous-évaluées.' },
        ],
        links: [
          { href: '/classement/qualite-10-sur-10', label: 'Actions notées 10 sur 10' },
          { href: '/classement/sous-evaluees', label: 'Actions sous-évaluées' },
          { href: '/methodologie', label: 'Notre méthodologie' },
        ],
      },
      en: {
        title: 'Stock screener: quality score and P/FCF',
        desc: 'The Lubin screener sorts thousands of stocks by quality score (10 criteria) and valuation (P/FCF). Find solid companies at the right price.',
        h1: 'Screener: the best quality stocks',
        intro: 'Filter stocks by quality score on 10 objective financial criteria and by valuation (P/FCF, price relative to the cash generated). The screener puts the most solid companies at the top.',
        sections: [
          { h2: 'Quality first, price second', p: 'Each stock gets a score out of 10 (business strength) and a P/FCF (expensive or cheap). The two are judged separately to avoid overpaying for a good company.' },
          { h2: 'Ready-made rankings', p: 'Browse stocks rated 10 out of 10 directly, or quality stocks currently undervalued.' },
        ],
        links: [
          { href: '/classement/qualite-10-sur-10', label: 'Stocks rated 10 out of 10' },
          { href: '/classement/sous-evaluees', label: 'Undervalued stocks' },
          { href: '/methodologie', label: 'Our methodology' },
        ],
      },
      es: {
        title: 'Screener de acciones: nota de calidad y P/FCF',
        desc: 'El screener de Lubin ordena miles de acciones por nota de calidad (10 criterios) y por valoración (P/FCF). Encuentra empresas sólidas al precio justo.',
        h1: 'Screener: las mejores acciones de calidad',
        intro: 'Filtra las acciones por nota de calidad sobre 10 criterios financieros objetivos y por valoración (P/FCF, el precio en relación con el cash generado). El screener pone en cabeza las empresas más sólidas.',
        sections: [
          { h2: 'Primero la calidad, luego el precio', p: 'Cada acción recibe una nota sobre 10 (solidez del negocio) y un P/FCF (cara o barata). Ambos se juzgan por separado para no pagar de más por una buena empresa.' },
          { h2: 'Rankings listos para usar', p: 'Consulta directamente las acciones con nota 10 sobre 10, o las acciones de calidad actualmente infravaloradas.' },
        ],
        links: [
          { href: '/classement/qualite-10-sur-10', label: 'Acciones con nota 10 sobre 10' },
          { href: '/classement/sous-evaluees', label: 'Acciones infravaloradas' },
          { href: '/methodologie', label: 'Nuestra metodología' },
        ],
      },
    },
  },
  {
    path: '/methodologie',
    content: {
      fr: {
        title: 'Méthodologie : 10 critères, sources publiques',
        desc: 'Comment Lubin note une action : 10 critères financiers objectifs, seuils issus de la littérature (Buffett, Mauboussin, Damodaran), zéro opinion, zéro boîte noire.',
        h1: '10 critères, sources publiques, zéro boîte noire',
        intro: 'La note de qualité repose sur 10 critères financiers objectifs, validés selon des seuils tirés de la littérature financière. Le calcul est automatique et sans opinion humaine.',
        sections: [
          { h2: 'Les 10 critères de qualité', p: "Rentabilité, croissance des ventes et du free cash flow, rachats d'actions, marges, profitabilité cash, rendement du capital (Cash ROCE), endettement maîtrisé, conversion du bénéfice en cash, cycle de trésorerie." },
          { h2: 'La valorisation, jugée à part', p: "Le P/FCF (prix rapporté au free cash flow) mesure si l'action est chère ou bon marché. Une bonne entreprise à mauvais prix reste un mauvais placement." },
        ],
        links: [
          { href: '/analyser', label: 'Analyser une action' },
          { href: '/screener', label: 'Screener' },
        ],
        // Détail des 10 critères servi aux bots GEO (copie statique, source : web i18n
        // methodology.criteres ; à resynchroniser si la grille évolue, comme data/articles.ts).
        criteria: [
          { n: 1, name: '1. Rentable', formula: "Marge nette = Résultat net / Chiffre d'affaires", threshold: '> 0 %', why: "Une entreprise qui ne gagne pas d'argent n'est pas une affaire d'investissement. Ce premier filtre élimine les sociétés structurellement déficitaires." },
          { n: 2, name: '2. Ventes en croissance', formula: "Croissance du chiffre d'affaires sur 5 ans", threshold: '> 10 % par an', why: "La croissance des ventes reste le meilleur moteur de création de valeur sur le long terme. On mesure la tendance sur 5 ans pour gommer les années exceptionnelles." },
          { n: 3, name: '3. Profits par action en croissance', formula: 'Croissance du cash par action sur 5 ans', threshold: '> 10 % par an', why: "Ce qui compte vraiment pour toi, actionnaire, c'est le cash généré par action. On retire au passage les actions distribuées aux salariés, qui réduisent ta part." },
          { n: 4, name: "4. Nombre d'actions maîtrisé", formula: "Variation annuelle du nombre d'actions dilué sur 5 ans", threshold: 'Stable ou en baisse', why: "La dilution, c'est quand l'entreprise crée de nouvelles actions : ta part du gâteau rétrécit. Les meilleures font l'inverse, elles rachètent leurs actions au lieu d'en émettre." },
          { n: 5, name: '5. Profitabilité cash', formula: "Marge de cash = cash disponible (free cash flow) / chiffre d'affaires", threshold: '> 10 %', why: "Le free cash flow, c'est l'argent qui reste vraiment en caisse une fois tout payé, bien plus fiable que le bénéfice comptable. Une marge élevée veut dire que chaque euro de vente génère du vrai cash." },
          { n: 6, name: '6. Marges en expansion', formula: 'Évolution de la marge opérationnelle sur 5 ans', threshold: 'En hausse', why: "Des marges qui montent au fil des années révèlent un vrai avantage : l'entreprise peut imposer ses prix ou produire moins cher. Un signe de qualité durable." },
          { n: 7, name: '7. Rendement du capital investi', formula: "Cash généré pour 100 € investis dans l'activité (Cash ROCE)", threshold: '> 15 %', why: "Combien de cash l'entreprise génère pour chaque euro réellement investi dans son activité. Au-dessus de 15 %, elle fait travailler son argent très efficacement." },
          { n: 8, name: '8. Endettement maîtrisé', formula: 'Dette nette / cash disponible (free cash flow)', threshold: '< 3 ans', why: "Combien d'années de cash il faudrait pour rembourser toute la dette. Au-delà de 3 ans, le risque devient sérieux en cas de coup dur." },
          { n: 9, name: '9. Bénéfices transformés en cash', formula: 'Cash disponible / bénéfice net', threshold: '> 1', why: "Vérifie que les profits annoncés deviennent du vrai argent, pas juste une écriture comptable. Un ratio durablement sous 1 est un signal d'alerte." },
          { n: 10, name: "10. Délai d'encaissement net", formula: "Jours pendant lesquels l'argent reste bloqué dans le cycle (clients, stocks, fournisseurs)", threshold: 'Faible ou négatif', why: "Le temps, en jours, pendant lequel l'argent est immobilisé entre le moment où l'entreprise paie ses fournisseurs et celui où ses clients la paient. Court ou négatif, c'est excellent : ses fournisseurs financent sa croissance (Apple, Amazon)." },
        ],
      },
      en: {
        title: 'Methodology: 10 criteria, public sources',
        desc: 'How Lubin scores a stock: 10 objective financial criteria, thresholds drawn from the literature (Buffett, Mauboussin, Damodaran), no opinions, no black box.',
        h1: '10 criteria, public sources, no black box',
        intro: 'The quality score rests on 10 objective financial criteria, validated against thresholds drawn from financial literature. The calculation is automatic, with no human opinion.',
        sections: [
          { h2: 'The 10 quality criteria', p: 'Profitability, growth in sales and free cash flow, share buybacks, margins, cash profitability, return on capital (Cash ROCE), controlled debt, conversion of earnings into cash, cash cycle.' },
          { h2: 'Valuation, judged separately', p: 'P/FCF (price relative to free cash flow) measures whether the stock is expensive or cheap. A good company at a bad price is still a bad investment.' },
        ],
        links: [
          { href: '/analyser', label: 'Analyze a stock' },
          { href: '/screener', label: 'Screener' },
        ],
        criteria: [
          { n: 1, name: '1. Profitable', formula: 'Net margin = Net income / Revenue', threshold: '> 0%', why: "A company that doesn't make money isn't an investment case. This first filter removes structurally loss-making companies." },
          { n: 2, name: '2. Growing sales', formula: 'Revenue growth over 5 years', threshold: '> 10% per year', why: 'Sales growth remains the best driver of long-term value creation. We measure the 5-year trend to smooth out exceptional years.' },
          { n: 3, name: '3. Growing earnings per share', formula: 'Cash-per-share growth over 5 years', threshold: '> 10% per year', why: 'What really matters to you as a shareholder is the cash generated per share. We also strip out shares granted to employees, which dilute your stake.' },
          { n: 4, name: '4. Share count under control', formula: 'Annual change in diluted share count over 5 years', threshold: 'Stable or declining', why: 'Dilution is when the company issues new shares: your slice of the pie shrinks. The best ones do the opposite — they buy back shares instead of issuing them.' },
          { n: 5, name: '5. Cash profitability', formula: 'Cash margin = free cash flow / revenue', threshold: '> 10%', why: 'Free cash flow is the money that truly stays in the bank once everything is paid, far more reliable than accounting profit. A high margin means each dollar of sales generates real cash.' },
          { n: 6, name: '6. Expanding margins', formula: 'Change in operating margin over 5 years', threshold: 'Rising', why: 'Margins rising over the years reveal a real edge: the company can set its prices or produce more cheaply. A sign of durable quality.' },
          { n: 7, name: '7. Return on invested capital', formula: 'Cash generated per €100 invested in the business (Cash ROCE)', threshold: '> 15%', why: 'How much cash the company generates for each euro actually invested in its business. Above 15%, it puts its money to work very efficiently.' },
          { n: 8, name: '8. Controlled debt', formula: 'Net debt / free cash flow', threshold: '< 3 years', why: 'How many years of cash it would take to repay all the debt. Beyond 3 years, the risk becomes serious in a downturn.' },
          { n: 9, name: '9. Earnings turned into cash', formula: 'Free cash flow / net income', threshold: '> 1', why: 'Checks that reported profits become real money, not just an accounting entry. A ratio durably below 1 is a warning sign.' },
          { n: 10, name: '10. Net collection period', formula: 'Days that cash stays locked in the cycle (receivables, inventory, payables)', threshold: 'Low or negative', why: 'The time, in days, that money is tied up between when the company pays its suppliers and when its customers pay it. Short or negative is excellent: its suppliers finance its growth (Apple, Amazon).' },
        ],
      },
      es: {
        title: 'Metodología: 10 criterios, fuentes públicas',
        desc: 'Cómo Lubin puntúa una acción: 10 criterios financieros objetivos, umbrales extraídos de la literatura (Buffett, Mauboussin, Damodaran), sin opiniones, sin caja negra.',
        h1: '10 criterios, fuentes públicas, sin caja negra',
        intro: 'La nota de calidad se basa en 10 criterios financieros objetivos, validados según umbrales extraídos de la literatura financiera. El cálculo es automático y sin opinión humana.',
        sections: [
          { h2: 'Los 10 criterios de calidad', p: 'Rentabilidad, crecimiento de las ventas y del free cash flow, recompras de acciones, márgenes, rentabilidad en efectivo, rendimiento del capital (Cash ROCE), endeudamiento controlado, conversión del beneficio en efectivo, ciclo de tesorería.' },
          { h2: 'La valoración, juzgada aparte', p: 'El P/FCF (precio en relación con el free cash flow) mide si la acción está cara o barata. Una buena empresa a mal precio sigue siendo una mala inversión.' },
        ],
        links: [
          { href: '/analyser', label: 'Analizar una acción' },
          { href: '/screener', label: 'Screener' },
        ],
        criteria: [
          { n: 1, name: '1. Rentable', formula: 'Margen neto = Beneficio neto / Ingresos', threshold: '> 0 %', why: 'Una empresa que no gana dinero no es un caso de inversión. Este primer filtro elimina las empresas estructuralmente deficitarias.' },
          { n: 2, name: '2. Ventas en crecimiento', formula: 'Crecimiento de los ingresos en 5 años', threshold: '> 10 % al año', why: 'El crecimiento de las ventas sigue siendo el mejor motor de creación de valor a largo plazo. Medimos la tendencia a 5 años para suavizar los años excepcionales.' },
          { n: 3, name: '3. Beneficios por acción en crecimiento', formula: 'Crecimiento del cash por acción en 5 años', threshold: '> 10 % al año', why: 'Lo que de verdad te importa como accionista es el cash generado por acción. De paso descontamos las acciones entregadas a los empleados, que reducen tu parte.' },
          { n: 4, name: '4. Número de acciones controlado', formula: 'Variación anual del número de acciones diluidas en 5 años', threshold: 'Estable o a la baja', why: 'La dilución es cuando la empresa crea nuevas acciones: tu porción del pastel se reduce. Las mejores hacen lo contrario, recompran sus acciones en lugar de emitirlas.' },
          { n: 5, name: '5. Rentabilidad en efectivo', formula: 'Margen de cash = free cash flow / ingresos', threshold: '> 10 %', why: 'El free cash flow es el dinero que realmente queda en caja una vez pagado todo, mucho más fiable que el beneficio contable. Un margen alto significa que cada euro de ventas genera cash real.' },
          { n: 6, name: '6. Márgenes en expansión', formula: 'Evolución del margen operativo en 5 años', threshold: 'Al alza', why: 'Unos márgenes que suben con los años revelan una ventaja real: la empresa puede imponer sus precios o producir más barato. Una señal de calidad duradera.' },
          { n: 7, name: '7. Rendimiento del capital invertido', formula: 'Cash generado por cada 100 € invertidos en la actividad (Cash ROCE)', threshold: '> 15 %', why: 'Cuánto cash genera la empresa por cada euro realmente invertido en su actividad. Por encima del 15 %, hace trabajar su dinero con mucha eficiencia.' },
          { n: 8, name: '8. Endeudamiento controlado', formula: 'Deuda neta / free cash flow', threshold: '< 3 años', why: 'Cuántos años de cash harían falta para devolver toda la deuda. Más allá de 3 años, el riesgo se vuelve serio ante un imprevisto.' },
          { n: 9, name: '9. Beneficios convertidos en efectivo', formula: 'Free cash flow / beneficio neto', threshold: '> 1', why: 'Verifica que los beneficios anunciados se convierten en dinero real, no solo en un apunte contable. Un ratio sostenidamente por debajo de 1 es una señal de alerta.' },
          { n: 10, name: '10. Plazo de cobro neto', formula: 'Días en que el dinero queda bloqueado en el ciclo (clientes, existencias, proveedores)', threshold: 'Bajo o negativo', why: 'El tiempo, en días, que el dinero está inmovilizado entre que la empresa paga a sus proveedores y que sus clientes le pagan. Corto o negativo es excelente: sus proveedores financian su crecimiento (Apple, Amazon).' },
        ],
      },
    },
  },
  {
    path: '/blog',
    content: {
      fr: {
        title: 'Blog : analyse fondamentale et méthode',
        desc: "Analyses d'actions par les fondamentaux, méthode P/FCF et lecture de l'actualité par la qualité. Le blog de Lubin Investment, en clair.",
        h1: 'Comprendre les marchés avec méthode',
        intro: "Des analyses fondamentales d'actions, la méthode de valorisation par les flux de trésorerie, et une lecture de l'actualité au prisme de la qualité.",
        sections: [
          { h2: 'Pédagogique et chiffré', p: 'Chaque article explique les termes, montre les chiffres réels, et raconte la thèse au-delà des nombres (moat, management, risques).' },
        ],
        links: [
          { href: '/analyser', label: 'Analyser une action' },
          { href: '/methodologie', label: 'Méthodologie' },
        ],
      },
      en: {
        title: 'Blog: fundamental analysis and method',
        desc: "Fundamental stock analysis, the P/FCF method, and a reading of the news through the lens of quality. Lubin Investment's blog, in plain terms.",
        h1: 'Understanding markets with method',
        intro: 'Fundamental stock analysis, the cash-flow valuation method, and a reading of the news through the prism of quality.',
        sections: [
          { h2: 'Educational and data-driven', p: 'Each article explains the terms, shows the real numbers, and tells the thesis beyond the figures (moat, management, risks).' },
        ],
        links: [
          { href: '/analyser', label: 'Analyze a stock' },
          { href: '/methodologie', label: 'Methodology' },
        ],
      },
      es: {
        title: 'Blog: análisis fundamental y método',
        desc: 'Análisis fundamental de acciones, método P/FCF y una lectura de la actualidad a través de la calidad. El blog de Lubin Investment, en claro.',
        h1: 'Entender los mercados con método',
        intro: 'Análisis fundamentales de acciones, el método de valoración por flujos de caja y una lectura de la actualidad bajo el prisma de la calidad.',
        sections: [
          { h2: 'Pedagógico y con cifras', p: 'Cada artículo explica los términos, muestra las cifras reales y cuenta la tesis más allá de los números (moat, dirección, riesgos).' },
        ],
        links: [
          { href: '/analyser', label: 'Analizar una acción' },
          { href: '/methodologie', label: 'Metodología' },
        ],
      },
    },
  },
  {
    path: '/pricing',
    content: {
      fr: {
        title: 'Tarifs : Lubin Investment, gratuit et Pro',
        desc: "Analysez gratuitement n'importe quelle action (note /10 + valorisation). Pro : analyses illimitées, analyse qualitative, comparaisons et données complètes.",
        h1: 'Investir avec méthode, pas avec des opinions',
        intro: "Le plan gratuit donne la note de qualité et la valorisation de n'importe quelle action. Le plan Pro débloque l'analyse qualitative, les comparaisons et les données complètes.",
        sections: [
          { h2: 'Gratuit', p: "Note de qualité sur 10 critères, valorisation P/FCF, screener et watchlist. De quoi décider sur n'importe quelle action." },
          { h2: 'Pro', p: "Analyses illimitées, analyse qualitative (business et management), opportunités, comparaisons jusqu'à 5 actions, données Europe et international." },
        ],
        links: [
          { href: '/analyser', label: 'Analyser une action' },
          { href: '/methodologie', label: 'Méthodologie' },
        ],
      },
      en: {
        title: 'Pricing: Lubin Investment, free and Pro',
        desc: 'Analyze any stock for free (score /10 + valuation). Pro: unlimited analyses, qualitative analysis, comparisons and full data.',
        h1: 'Invest with method, not with opinions',
        intro: 'The free plan gives the quality score and valuation of any stock. The Pro plan unlocks qualitative analysis, comparisons and full data.',
        sections: [
          { h2: 'Free', p: 'Quality score on 10 criteria, P/FCF valuation, screener and watchlist. Enough to decide on any stock.' },
          { h2: 'Pro', p: 'Unlimited analyses, qualitative analysis (business and management), opportunities, comparisons of up to 5 stocks, European and international data.' },
        ],
        links: [
          { href: '/analyser', label: 'Analyze a stock' },
          { href: '/methodologie', label: 'Methodology' },
        ],
      },
      es: {
        title: 'Precios: Lubin Investment, gratis y Pro',
        desc: 'Analiza cualquier acción gratis (nota /10 + valoración). Pro: análisis ilimitados, análisis cualitativo, comparaciones y datos completos.',
        h1: 'Invierte con método, no con opiniones',
        intro: 'El plan gratuito da la nota de calidad y la valoración de cualquier acción. El plan Pro desbloquea el análisis cualitativo, las comparaciones y los datos completos.',
        sections: [
          { h2: 'Gratis', p: 'Nota de calidad sobre 10 criterios, valoración P/FCF, screener y watchlist. Suficiente para decidir sobre cualquier acción.' },
          { h2: 'Pro', p: 'Análisis ilimitados, análisis cualitativo (negocio y dirección), oportunidades, comparaciones de hasta 5 acciones, datos de Europa e internacionales.' },
        ],
        links: [
          { href: '/analyser', label: 'Analizar una acción' },
          { href: '/methodologie', label: 'Metodología' },
        ],
      },
    },
  },
  {
    path: '/analyser',
    content: {
      fr: {
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
      en: {
        title: 'Analyze a stock: quality and valuation',
        desc: 'Type a ticker and get, in seconds, a quality score on 10 criteria and a valuation (P/FCF) judged separately.',
        h1: 'Analyze a stock',
        intro: 'Enter a ticker (for example AAPL, MSFT or ASML) to get its quality score on 10 objective financial criteria and its free-cash-flow valuation.',
        sections: [
          { h2: 'One score, one price', p: 'The score judges business strength; the P/FCF judges the price. You leave with both, separately.' },
        ],
        links: [
          { href: '/screener', label: 'Screener' },
          { href: '/classement/qualite-10-sur-10', label: 'Stocks rated 10 out of 10' },
        ],
      },
      es: {
        title: 'Analizar una acción: calidad y valoración',
        desc: 'Escribe un ticker y obtén, en segundos, una nota de calidad sobre 10 criterios y una valoración (P/FCF) juzgada por separado.',
        h1: 'Analizar una acción',
        intro: 'Introduce un ticker (por ejemplo AAPL, MSFT o ASML) para obtener su nota de calidad sobre 10 criterios financieros objetivos y su valoración por el free cash flow.',
        sections: [
          { h2: 'Una nota, un precio', p: 'La nota juzga la solidez del negocio; el P/FCF juzga el precio. Te llevas ambos, por separado.' },
        ],
        links: [
          { href: '/screener', label: 'Screener' },
          { href: '/classement/qualite-10-sur-10', label: 'Acciones con nota 10 sobre 10' },
        ],
      },
    },
  },
  {
    path: '/compare',
    content: {
      fr: {
        title: 'Comparer des actions : qualité et prix',
        desc: 'Mettez 2 à 5 actions côte à côte : note de qualité, 10 critères et valorisation (P/FCF). La donnée décide, ligne par ligne.',
        h1: 'Comparer des actions',
        intro: 'Placez 2 à 5 actions côte à côte pour comparer leur note de qualité, le détail des 10 critères et leur valorisation (P/FCF). La meilleure de chaque ligne est mise en avant.',
        sections: [
          { h2: 'Comparer ce qui compte', p: "Au lieu d'opposer des cours, on compare la qualité du business et le prix payé pour le cash généré." },
        ],
        links: [
          { href: '/analyser', label: 'Analyser une action' },
          { href: '/screener', label: 'Screener' },
        ],
      },
      en: {
        title: 'Compare stocks: quality and price',
        desc: 'Put 2 to 5 stocks side by side: quality score, 10 criteria and valuation (P/FCF). The data decides, line by line.',
        h1: 'Compare stocks',
        intro: 'Place 2 to 5 stocks side by side to compare their quality score, the detail of the 10 criteria and their valuation (P/FCF). The best of each line is highlighted.',
        sections: [
          { h2: 'Compare what matters', p: 'Instead of pitting share prices against each other, we compare business quality and the price paid for the cash generated.' },
        ],
        links: [
          { href: '/analyser', label: 'Analyze a stock' },
          { href: '/screener', label: 'Screener' },
        ],
      },
      es: {
        title: 'Comparar acciones: calidad y precio',
        desc: 'Pon de 2 a 5 acciones una al lado de otra: nota de calidad, 10 criterios y valoración (P/FCF). El dato decide, línea por línea.',
        h1: 'Comparar acciones',
        intro: 'Coloca de 2 a 5 acciones una al lado de otra para comparar su nota de calidad, el detalle de los 10 criterios y su valoración (P/FCF). La mejor de cada línea se destaca.',
        sections: [
          { h2: 'Comparar lo que importa', p: 'En lugar de enfrentar cotizaciones, comparamos la calidad del negocio y el precio pagado por el cash generado.' },
        ],
        links: [
          { href: '/analyser', label: 'Analizar una acción' },
          { href: '/screener', label: 'Screener' },
        ],
      },
    },
  },
  {
    path: '/mentions-legales',
    content: {
      fr: {
        title: 'Mentions légales · Lubin Investment',
        desc: 'Éditeur, responsable de publication, hébergeur et coordonnées légales du service Lubin Investment.',
        h1: 'Mentions légales',
        intro: "Informations légales du service Lubin Investment : éditeur, responsable de la publication, hébergeur et coordonnées. Le texte complet est disponible sur la page.",
        sections: [
          { h2: 'Éditeur et hébergeur', p: "Lubin Investment est édité par un micro-entrepreneur (exonération de TVA, art. 293 B du CGI). Les coordonnées complètes de l'éditeur, du responsable de publication et de l'hébergeur figurent sur cette page." },
        ],
        links: [
          { href: '/cgu', label: "Conditions d'utilisation" },
          { href: '/confidentialite', label: 'Confidentialité' },
        ],
      },
      en: {
        title: 'Legal notice · Lubin Investment',
        desc: 'Publisher, publication manager, host and legal contact details for the Lubin Investment service.',
        h1: 'Legal notice',
        intro: 'Legal information for the Lubin Investment service: publisher, publication manager, host and contact details. The full text is available on the page.',
        sections: [
          { h2: 'Publisher and host', p: 'Lubin Investment is published by a sole trader (VAT exempt, art. 293 B of the French CGI). Full details of the publisher, publication manager and host are listed on this page.' },
        ],
        links: [
          { href: '/cgu', label: 'Terms of use' },
          { href: '/confidentialite', label: 'Privacy' },
        ],
      },
      es: {
        title: 'Aviso legal · Lubin Investment',
        desc: 'Editor, responsable de publicación, alojamiento y datos de contacto legales del servicio Lubin Investment.',
        h1: 'Aviso legal',
        intro: 'Información legal del servicio Lubin Investment: editor, responsable de la publicación, alojamiento y datos de contacto. El texto completo está disponible en la página.',
        sections: [
          { h2: 'Editor y alojamiento', p: 'Lubin Investment está editado por un autónomo (exento de IVA, art. 293 B del CGI francés). Los datos completos del editor, del responsable de publicación y del alojamiento figuran en esta página.' },
        ],
        links: [
          { href: '/cgu', label: 'Condiciones de uso' },
          { href: '/confidentialite', label: 'Privacidad' },
        ],
      },
    },
  },
  {
    path: '/cgu',
    content: {
      fr: {
        title: "Conditions générales d'utilisation · Lubin Investment",
        desc: "Conditions générales d'utilisation de Lubin Investment : objet, accès, propriété intellectuelle, responsabilités. Outil d'aide à la décision, non un conseil en investissement.",
        h1: "Conditions générales d'utilisation",
        intro: "Les conditions générales d'utilisation encadrent l'accès et l'usage du service Lubin Investment. Le texte intégral est disponible sur la page.",
        sections: [
          { h2: 'Objet et responsabilités', p: "Lubin Investment est un outil d'aide à la décision fondé sur des données publiques. Il ne constitue pas un conseil en investissement personnalisé ; les décisions restent celles de l'utilisateur." },
        ],
        links: [
          { href: '/cgv', label: 'CGV' },
          { href: '/confidentialite', label: 'Confidentialité' },
        ],
      },
      en: {
        title: 'Terms of use · Lubin Investment',
        desc: 'Lubin Investment terms of use: purpose, access, intellectual property, liability. A decision-support tool, not personalized investment advice.',
        h1: 'Terms of use',
        intro: 'The terms of use govern access to and use of the Lubin Investment service. The full text is available on the page.',
        sections: [
          { h2: 'Purpose and liability', p: 'Lubin Investment is a decision-support tool based on public data. It is not personalized investment advice; decisions remain those of the user.' },
        ],
        links: [
          { href: '/cgv', label: 'Terms of sale' },
          { href: '/confidentialite', label: 'Privacy' },
        ],
      },
      es: {
        title: 'Condiciones de uso · Lubin Investment',
        desc: 'Condiciones de uso de Lubin Investment: objeto, acceso, propiedad intelectual, responsabilidades. Herramienta de ayuda a la decisión, no asesoramiento de inversión.',
        h1: 'Condiciones de uso',
        intro: 'Las condiciones de uso regulan el acceso y el uso del servicio Lubin Investment. El texto íntegro está disponible en la página.',
        sections: [
          { h2: 'Objeto y responsabilidades', p: 'Lubin Investment es una herramienta de ayuda a la decisión basada en datos públicos. No constituye asesoramiento de inversión personalizado; las decisiones siguen siendo del usuario.' },
        ],
        links: [
          { href: '/cgv', label: 'Condiciones de venta' },
          { href: '/confidentialite', label: 'Privacidad' },
        ],
      },
    },
  },
  {
    path: '/cgv',
    content: {
      fr: {
        title: 'Conditions générales de vente · Lubin Investment',
        desc: "Conditions générales de vente de l'abonnement Pro Lubin Investment : prix, paiement, reconduction, droit de rétractation et résiliation.",
        h1: 'Conditions générales de vente',
        intro: "Les conditions générales de vente encadrent l'abonnement Pro de Lubin Investment. Le texte intégral est disponible sur la page.",
        sections: [
          { h2: 'Abonnement et paiement', p: "L'abonnement Pro est facturé via un prestataire de paiement sécurisé, reconductible et résiliable à tout moment. Les modalités complètes (prix, rétractation, résiliation) figurent sur cette page." },
        ],
        links: [
          { href: '/pricing', label: 'Tarifs' },
          { href: '/cgu', label: "Conditions d'utilisation" },
        ],
      },
      en: {
        title: 'Terms of sale · Lubin Investment',
        desc: 'Terms of sale for the Lubin Investment Pro subscription: pricing, payment, renewal, right of withdrawal and cancellation.',
        h1: 'Terms of sale',
        intro: 'The terms of sale govern the Lubin Investment Pro subscription. The full text is available on the page.',
        sections: [
          { h2: 'Subscription and payment', p: 'The Pro subscription is billed via a secure payment provider, renewable and cancellable at any time. The full terms (pricing, withdrawal, cancellation) are listed on this page.' },
        ],
        links: [
          { href: '/pricing', label: 'Pricing' },
          { href: '/cgu', label: 'Terms of use' },
        ],
      },
      es: {
        title: 'Condiciones de venta · Lubin Investment',
        desc: 'Condiciones de venta de la suscripción Pro de Lubin Investment: precio, pago, renovación, derecho de desistimiento y cancelación.',
        h1: 'Condiciones de venta',
        intro: 'Las condiciones de venta regulan la suscripción Pro de Lubin Investment. El texto íntegro está disponible en la página.',
        sections: [
          { h2: 'Suscripción y pago', p: 'La suscripción Pro se factura a través de un proveedor de pago seguro, renovable y cancelable en cualquier momento. Las condiciones completas (precio, desistimiento, cancelación) figuran en esta página.' },
        ],
        links: [
          { href: '/pricing', label: 'Precios' },
          { href: '/cgu', label: 'Condiciones de uso' },
        ],
      },
    },
  },
  {
    path: '/confidentialite',
    content: {
      fr: {
        title: 'Politique de confidentialité · Lubin Investment',
        desc: 'Quelles données Lubin Investment collecte, pourquoi, combien de temps, et vos droits (accès, rectification, suppression) au titre du RGPD.',
        h1: 'Politique de confidentialité',
        intro: 'Cette politique explique quelles données sont collectées, pour quelles finalités, et les droits dont vous disposez. Le texte complet est disponible sur la page.',
        sections: [
          { h2: 'Données et droits', p: "Les données (email, watchlist, abonnement) servent uniquement à fournir le service. Conformément au RGPD, vous disposez de droits d'accès, de rectification et de suppression, détaillés sur cette page." },
        ],
        links: [
          { href: '/mentions-legales', label: 'Mentions légales' },
          { href: '/cgu', label: "Conditions d'utilisation" },
        ],
      },
      en: {
        title: 'Privacy policy · Lubin Investment',
        desc: 'What data Lubin Investment collects, why, for how long, and your rights (access, rectification, erasure) under the GDPR.',
        h1: 'Privacy policy',
        intro: 'This policy explains what data is collected, for what purposes, and the rights you have. The full text is available on the page.',
        sections: [
          { h2: 'Data and rights', p: 'Data (email, watchlist, subscription) is used solely to provide the service. Under the GDPR, you have rights of access, rectification and erasure, detailed on this page.' },
        ],
        links: [
          { href: '/mentions-legales', label: 'Legal notice' },
          { href: '/cgu', label: 'Terms of use' },
        ],
      },
      es: {
        title: 'Política de privacidad · Lubin Investment',
        desc: 'Qué datos recopila Lubin Investment, por qué, durante cuánto tiempo, y tus derechos (acceso, rectificación, supresión) según el RGPD.',
        h1: 'Política de privacidad',
        intro: 'Esta política explica qué datos se recopilan, con qué fines, y los derechos de los que dispones. El texto completo está disponible en la página.',
        sections: [
          { h2: 'Datos y derechos', p: 'Los datos (correo, watchlist, suscripción) se usan únicamente para prestar el servicio. Conforme al RGPD, dispones de derechos de acceso, rectificación y supresión, detallados en esta página.' },
        ],
        links: [
          { href: '/mentions-legales', label: 'Aviso legal' },
          { href: '/cgu', label: 'Condiciones de uso' },
        ],
      },
    },
  },
];

const STATIC_BY_PATH: Record<string, StaticSeo> = Object.fromEntries(STATIC_SEO.map((s) => [s.path, s]));

for (const seo of STATIC_SEO) {
  seoPrerenderRouter.get(seo.path, (req: Request, res: Response) => {
    // Langue demandée par le bot via ?lng= (les alternates hreflang du sitemap pointent
    // vers ?lng=en / ?lng=es). Défaut fr. Le cache CDN distingue les langues car ?lng=
    // fait partie de l'URL.
    const lang = toArticleLang(typeof req.query.lng === 'string' ? req.query.lng : 'fr');
    res.status(200)
      .set('Content-Type', 'text/html; charset=utf-8')
      .set('Cache-Control', 'public, max-age=3600, s-maxage=86400')
      .send(renderStaticHtml(STATIC_BY_PATH[seo.path]!, lang));
  });
}
