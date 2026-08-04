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
import { getArticleBySlug, listArticles, toArticleLang } from '../data/articles.js';
import { companyDisplayName } from '../data/companyNames.js';
import type { Article, ArticleLang } from '@lubin/shared';

export const seoPrerenderRouter: Router = Router();

const SITE_URL = process.env.SITE_URL || 'https://lubin-investment.com';

// ─── Profils sociaux officiels ────────────────────────────────────────────────
// Dupliqués depuis apps/web/src/lib/socialProfiles.ts, à dessein : le garde-fou
// scripts/check-api-shared-imports.mjs interdit tout import de VALEUR depuis
// '@lubin/shared' dans apps/api (ça casse la lambda au boot), donc pas de constante
// partagée possible. Toute modification doit toucher les DEUX fichiers dans le même
// commit. Déclaré tout en haut plutôt qu'à côté des AUTHOR_* pour éviter la classe de
// bug TDZ déjà rencontrée dans apps/api (const utilisée avant son initialisation).
const X_HANDLE = 'lubin_danilo';
const X_URL = `https://x.com/${X_HANDLE}`;
const LINKEDIN_URL = 'https://www.linkedin.com/in/lubin-danilo/';
/** Déclaration d'identité réutilisée dans tous les `sameAs` du JSON-LD. */
const SAME_AS: readonly string[] = [LINKEDIN_URL, X_URL];

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

// Dictionnaire trilingue (fr/en/es) pour le HTML pré-rendu d'une fiche ticker.
// Le rendering UI passe par ces clés ; tout ajout de texte user-facing doit avoir ses 3 variantes.
type TickerTr = {
  ogLocale: string;
  inLanguage: string;
  titlePrefix: string;
  titleSuffix: string;
  metaDescription: (name: string) => string;
  sectorUnknown: string;
  oppLabel: string;
  oppBody: (name: string) => string;
  updatedOn: string;
  introVerdict: (name: string, score: string, quality: string, pfcfClause: string) => string;
  sectorPriceLine: (sector: string, exchange: string, price: string) => string;
  methodH2: string;
  methodBody: (name: string, ticker: string) => string;
  criteriaH2: string;
  criteria: string[]; // 10 items HTML-ready (avec <strong>)
  faqH2: string;
  faqQuality: (name: string) => string;
  faqQualityA: (name: string, score: string, quality: string) => string;
  faqHowScored: (name: string) => string;
  faqHowScoredA: string;
  faqPfcf: (name: string) => string;
  faqPfcfA: (name: string, pfcf: string) => string;
  faqWhereFull: (name: string) => string;
  faqWhereFullA: (canonical: string) => string;
  qualityHigh: string;
  qualityMid: string;
  qualityLow: string;
  qualityPending: string;
  relatedHeadingWithSector: (sector: string) => string;
  relatedHeadingFallback: string;
  scoreNoted: string;
  scoreSuffix: string; // " / " or " out of " etc.
  goFurtherH2: string;
  goFurtherCta: (ticker: string) => string;
  otherResources: string;
  resMethod: string;
  resSectorHub: (sector: string) => string;
  resQuality10: string;
  resTopQuality: string;
  resPricing: string;
  headerNav: { home: string; screener: string; method: string; pricing: string };
  breadcrumbHome: string;
  breadcrumbScreener: string;
  disclaimer: string;
  h1Analysis: string; // "Analyse fondamentale" / "Fundamental analysis" / ...
  pfcfClauseTpl: (pfcf: string) => string;

  // ─── Ajouts audit masterclass SEO (2026-08-04) ───────────────────────────────
  /** Titre long multi-intention (~150-250 car.). Le corpus mesure +10 à 40 % de trafic
   *  vs un titre court, l'essentiel devant rester dans les 12 premiers mots. Testé sur
   *  la moitié des fiches seulement (cf. useLongTitle), pour pouvoir comparer en GSC. */
  titleLong: (name: string, ticker: string, score: string, pfcfPart: string, year: number) => string;
  /** Fragment de titre long dédié au P/FCF (omis si la donnée manque). */
  titleLongPfcf: (pfcf: string) => string;
  /** Lien sortant « littérature » inséré DANS la section méthode (1 lien par section :
   *  c'est le geste on-page le mieux prouvé du corpus, 4 tests indépendants). */
  sourcesLiterature: string;
  /** Lien sortant « documents officiels » (EDGAR), inséré dans la section méthode. US only. */
  sourcesFilings: (name: string, href: string) => string;
  /** Section « prix face aux comparables » : texte dérivé de la DB, donc unique par fiche
   *  (contre-mesure au motif de gabarit répété, ch. 2/9/12). */
  peerH2: string;
  peerBody: (name: string, pfcf: string, median: string, n: number, sector: string, cheaper: boolean) => string;
  /** Lecture croisée qualité × prix : 4 variantes selon (qualité haute ?, prix bas ?). */
  crossVerdict: (name: string, goodQuality: boolean, cheap: boolean) => string;
  /** Signature auteur visible (E-E-A-T ; la réputation d'auteur est stockée par Google,
   *  et la finance est en régime YMYL renforcé). */
  authorByline: (href: string) => string;
  /** Libellé du hub « actions sous-évaluées » (remplace un lien dupliqué du header). */
  resUndervalued: string;
  /** Libellé du lien vers la page de comparaison « X vs Y », quand elle existe. */
  resCompare: (other: string) => string;
};

const TICKER_TR: Record<ArticleLang, TickerTr> = {
  fr: {
    ogLocale: 'fr_FR',
    inLanguage: 'fr-FR',
    titlePrefix: "Faut-il acheter l'action ",
    titleSuffix: ' ? Notre analyse complète.',
    metaDescription: (n) => `On a analysé les fondamentaux et la valorisation de l'action ${n} : voici nos conclusions.`,
    sectorUnknown: 'secteur non renseigné',
    oppLabel: '⭐ Opportunité du moment',
    oppBody: (n) => `${n} est dans son décile bas historique de valorisation (P/FCF ≤ 10ᵉ percentile sur 10 ans, ET ratio &lt; 25×). C'est un point d'entrée potentiellement intéressant pour les investisseurs long terme.`,
    updatedOn: 'Mis à jour le',
    introVerdict: (n, score, quality, pfcfClause) => `On a analysé l'action ${n} sur les 10 critères de qualité de Lubin Investment. L'entreprise obtient une note de <strong>${score}</strong> synonyme de qualité ${quality}${pfcfClause}.`,
    sectorPriceLine: (sector, exchange, price) => `Secteur : ${sector}.${exchange ? ` Place de cotation : ${exchange}.` : ''}${price ? ` Cours actuel : ${price}.` : ''}`,
    methodH2: 'Méthode de notation Lubin',
    methodBody: (n, ticker) => `La note ${deFr(n)} (${ticker}) est calculée automatiquement à partir de 10 critères financiers objectifs, sans intervention humaine ni opinion. Chaque critère est validé (OUI / PARTIEL / NON) en fonction de seuils issus de la littérature financière (Warren Buffett, Bettin-Mauboussin, Aswath Damodaran). La note finale est le total des validations.`,
    criteriaH2: 'Les 10 critères chiffrés analysés',
    criteria: [
      "<strong>Rentable</strong> : marge nette positive",
      "<strong>Ventes en croissance</strong> : chiffre d'affaires &gt; 10 %/an sur 5 ans",
      "<strong>Profits par action en croissance</strong> : FCF par action ajusté de la rémunération en actions, &gt; 10 %/an sur 5 ans",
      "<strong>Nombre d'actions maîtrisé</strong> : stable ou en baisse (rachats nets = création de valeur pour l'actionnaire)",
      "<strong>Profitabilité cash</strong> : marge de free cash flow &gt; 10 % du chiffre d'affaires",
      "<strong>Marges en expansion</strong> : la marge opérationnelle s'élargit sur 5 ans (operating leverage)",
      "<strong>Rendement du capital investi</strong> : Cash ROCE Bettin-Mauboussin &gt; 15 % par an",
      "<strong>Endettement maîtrisé</strong> : dette nette remboursable en moins de 3 ans de free cash flow",
      "<strong>Bénéfices transformés en cash</strong> : le free cash flow excède le bénéfice net comptable",
      "<strong>Délai d'encaissement net</strong> : cycle de trésorerie court ou négatif",
    ],
    faqH2: 'Questions fréquentes',
    faqQuality: (n) => `L'action ${n} est-elle de qualité ?`,
    faqQualityA: (n, score, q) => `L'action ${n} obtient une note de qualité de ${score} (qualité ${q}), calculée sur les 10 critères de Lubin Investment : rentabilité, croissance du chiffre d'affaires et du free cash flow, rachats d'actions, marges, endettement et rendement du capital.`,
    faqHowScored: (n) => `Comment est calculée la note de ${n} ?`,
    faqHowScoredA: 'La note est le total des critères validés (OUI / PARTIEL / NON) selon des seuils issus de la littérature financière (Warren Buffett, Mauboussin, Aswath Damodaran), de façon automatique et sans opinion humaine.',
    faqPfcf: (n) => `Quel est le P/FCF de ${n} ?`,
    faqPfcfA: (n, p) => `Le multiple cours / free cash flow (P/FCF) de l'action ${n} ressort à ${p}. Chez Lubin Investment, la valorisation est jugée séparément de la qualité.`,
    faqWhereFull: (n) => `Où voir l'analyse complète de ${n} ?`,
    faqWhereFullA: (c) => `L'analyse interactive complète (détail des 10 critères, historiques, valorisation P/FCF, comparaisons sectorielles) est disponible sur ${c}.`,
    qualityHigh: 'élevée',
    qualityMid: 'moyenne',
    qualityLow: 'faible',
    qualityPending: 'à analyser',
    relatedHeadingWithSector: (s) => `Autres actions du secteur ${s}`,
    relatedHeadingFallback: 'Autres actions à explorer',
    scoreNoted: 'note',
    scoreSuffix: ' / ',
    goFurtherH2: 'Aller plus loin',
    goFurtherCta: (ticker) => `Voir l'analyse complète et interactive de ${ticker}`,
    otherResources: 'Autres ressources',
    resMethod: 'Méthodologie détaillée',
    resSectorHub: (s) => `Toutes les actions du secteur ${s}`,
    resQuality10: 'Les actions notées 10 sur 10',
    resTopQuality: 'Top des entreprises de qualité',
    resPricing: 'Tarifs Lubin Investment',
    headerNav: { home: 'Lubin Investment', screener: 'Screener', method: 'Méthodologie', pricing: 'Tarifs' },
    breadcrumbHome: 'Accueil',
    breadcrumbScreener: 'Screener',
    disclaimer: "Lubin Investment est un outil d'aide à la décision pour investisseurs particuliers. Ce service ne constitue pas un conseil en investissement personnalisé au sens de l'article L.321-1 du Code monétaire et financier. Les performances passées ne préjugent pas des performances futures.",
    h1Analysis: 'Analyse fondamentale',
    pfcfClauseTpl: (p) => `, et un multiple de valorisation P/FCF de ${p}`,
    titleLong: (n, ticker, quality, pfcfPart, year) =>
      `Faut-il acheter l'action ${n} (${ticker}) ? Avis et analyse fondamentale gratuite : qualité ${quality} sur 10 critères${pfcfPart}, sous-évaluée ou pas, prix d'achat conseillé. Notre verdict ${year}.`,
    titleLongPfcf: (p) => `, valorisation face à son historique`,
    sourcesLiterature:
      `Les seuils viennent de la littérature financière, pas de nos préférences : voir les travaux de valorisation d'<a href="https://pages.stern.nyu.edu/~adamodar/" target="_blank" rel="noopener nofollow">Aswath Damodaran (NYU Stern)</a> et les <a href="https://www.investor.gov/" target="_blank" rel="noopener nofollow">ressources pédagogiques de la SEC (investor.gov)</a>.`,
    sourcesFilings: (n, href) =>
      `Les comptes ${deFr(n)} sont publics : tu peux vérifier chaque chiffre dans ses <a href="${href}" target="_blank" rel="noopener nofollow">dépôts officiels 10-K auprès de la SEC (EDGAR)</a>.`,
    peerH2: 'Son prix face à ses comparables',
    peerBody: (n, pfcf, median, count, sector, cheaper) =>
      `Face aux ${count} autres valeurs du secteur ${sector} que nous avons notées, ${n} se paie ${pfcf} son free cash flow, contre une médiane de ${median} pour ce panier. Sur ce seul critère de prix, ${n} est donc ${cheaper ? 'moins chère' : 'plus chère'} que ses comparables. Cela ne dit rien de sa qualité : chez Lubin Investment, la qualité et le prix sont jugés séparément, et un multiple bas n'est une bonne affaire que si la qualité tient.`,
    crossVerdict: (n, goodQuality, cheap) =>
      goodQuality && cheap
        ? `Le cas de figure que nous cherchons : ${n} valide une large majorité de nos critères de qualité tout en se payant un multiple de free cash flow bas. C'est exactement le profil « entreprise de qualité au bon prix », celui qui mérite d'être regardé de près.`
        : goodQuality && !cheap
        ? `${n} est une entreprise de qualité selon nos critères, mais son prix ne suit pas : le multiple de free cash flow reste élevé. Une bonne entreprise payée trop cher reste un mauvais placement, donc c'est typiquement un titre à surveiller en attendant un meilleur point d'entrée.`
        : !goodQuality && cheap
        ? `${n} se paie un multiple de free cash flow bas, mais échoue sur une partie de nos critères de qualité. Attention au piège : un prix bas n'est pas une décote si le business se dégrade. Le multiple faible peut simplement refléter un problème réel.`
        : `${n} échoue sur une partie de nos critères de qualité sans que le prix compense. Ni la qualité ni la valorisation ne plaident en sa faveur aujourd'hui, selon nos 10 critères chiffrés.`,
    authorByline: (href) =>
      `Méthode et analyse par <a href="${href}">Lubin Danilo, fondateur de Lubin Investment</a>. Note calculée automatiquement, sans opinion humaine.`,
    resUndervalued: 'Les actions de qualité sous-évaluées',
    resCompare: (o) => `Comparer avec ${o}`,
  },
  en: {
    ogLocale: 'en_US',
    inLanguage: 'en-US',
    titlePrefix: 'Should you buy ',
    titleSuffix: ' stock? Our full analysis.',
    metaDescription: (n) => `We analyzed the fundamentals and valuation of ${n} stock: here are our conclusions.`,
    sectorUnknown: 'sector not specified',
    oppLabel: '⭐ Current opportunity',
    oppBody: (n) => `${n} is in its historical low decile of valuation (P/FCF ≤ 10th percentile over 10 years, AND ratio &lt; 25×). This is a potentially interesting entry point for long-term investors.`,
    updatedOn: 'Updated on',
    introVerdict: (n, score, quality, pfcfClause) => `We analyzed ${n} stock against the 10 quality criteria of Lubin Investment. The company gets a quality score of <strong>${score}</strong>, meaning ${quality} quality${pfcfClause}.`,
    sectorPriceLine: (sector, exchange, price) => `Sector: ${sector}.${exchange ? ` Listing: ${exchange}.` : ''}${price ? ` Current price: ${price}.` : ''}`,
    methodH2: 'Lubin scoring methodology',
    methodBody: (n, ticker) => `${n} (${ticker})'s score is calculated automatically from 10 objective financial criteria, with no human intervention or opinion. Each criterion is validated (YES / PARTIAL / NO) based on thresholds drawn from the financial literature (Warren Buffett, Bettin-Mauboussin, Aswath Damodaran). The final score is the sum of validations.`,
    criteriaH2: 'The 10 quantitative criteria analyzed',
    criteria: [
      "<strong>Profitable</strong>: positive net margin",
      "<strong>Growing revenue</strong>: revenue growing &gt; 10%/year over 5 years",
      "<strong>Growing earnings per share</strong>: FCF per share adjusted for stock-based compensation, &gt; 10%/year over 5 years",
      "<strong>Share count under control</strong>: stable or declining (net buybacks = value creation for shareholders)",
      "<strong>Cash profitability</strong>: free cash flow margin &gt; 10% of revenue",
      "<strong>Expanding margins</strong>: operating margin widens over 5 years (operating leverage)",
      "<strong>Return on invested capital</strong>: Bettin-Mauboussin Cash ROCE &gt; 15% per year",
      "<strong>Debt under control</strong>: net debt repayable in less than 3 years of free cash flow",
      "<strong>Earnings converted to cash</strong>: free cash flow exceeds accounting net income",
      "<strong>Net collection period</strong>: short or negative cash conversion cycle",
    ],
    faqH2: 'Frequently asked questions',
    faqQuality: (n) => `Is ${n} a quality stock?`,
    faqQualityA: (n, score, q) => `${n} gets a quality score of ${score} (${q} quality), calculated over the 10 Lubin Investment criteria: profitability, revenue and free cash flow growth, share buybacks, margins, debt and return on capital.`,
    faqHowScored: (n) => `How is ${n}'s score calculated?`,
    faqHowScoredA: 'The score is the total of validated criteria (YES / PARTIAL / NO) using thresholds drawn from the financial literature (Warren Buffett, Mauboussin, Aswath Damodaran), automatically and with no human opinion.',
    faqPfcf: (n) => `What is ${n}'s P/FCF?`,
    faqPfcfA: (n, p) => `The price-to-free-cash-flow (P/FCF) multiple of ${n} stock is ${p}. At Lubin Investment, valuation is judged separately from quality.`,
    faqWhereFull: (n) => `Where to see ${n}'s full analysis?`,
    faqWhereFullA: (c) => `The full interactive analysis (10-criteria detail, history, P/FCF valuation, sector comparisons) is available at ${c}.`,
    qualityHigh: 'high',
    qualityMid: 'medium',
    qualityLow: 'low',
    qualityPending: 'pending analysis',
    relatedHeadingWithSector: (s) => `Other stocks in the ${s} sector`,
    relatedHeadingFallback: 'Other stocks to explore',
    scoreNoted: 'score',
    scoreSuffix: ' / ',
    goFurtherH2: 'Go further',
    goFurtherCta: (ticker) => `See the full interactive analysis of ${ticker}`,
    otherResources: 'Other resources',
    resMethod: 'Detailed methodology',
    resSectorHub: (s) => `All stocks in the ${s} sector`,
    resQuality10: 'Stocks rated 10 out of 10',
    resTopQuality: 'Top quality companies',
    resPricing: 'Lubin Investment pricing',
    headerNav: { home: 'Lubin Investment', screener: 'Screener', method: 'Methodology', pricing: 'Pricing' },
    breadcrumbHome: 'Home',
    breadcrumbScreener: 'Screener',
    disclaimer: 'Lubin Investment is a decision-support tool for individual investors. This service does not constitute personalized investment advice within the meaning of Article L.321-1 of the French Monetary and Financial Code. Past performance is no guarantee of future results.',
    h1Analysis: 'Fundamental analysis',
    pfcfClauseTpl: (p) => `, and a P/FCF valuation multiple of ${p}`,
    titleLong: (n, ticker, quality, pfcfPart, year) =>
      `Should you buy ${n} (${ticker}) stock? Free review and fundamental analysis: ${quality} quality on 10 criteria${pfcfPart}, undervalued or not, target buy price. Our ${year} verdict.`,
    titleLongPfcf: (p) => `, valuation against its own history`,
    sourcesLiterature:
      `The thresholds come from the financial literature, not from our preferences: see the valuation work of <a href="https://pages.stern.nyu.edu/~adamodar/" target="_blank" rel="noopener nofollow">Aswath Damodaran (NYU Stern)</a> and the <a href="https://www.investor.gov/" target="_blank" rel="noopener nofollow">SEC investor education resources (investor.gov)</a>.`,
    sourcesFilings: (n, href) =>
      `${n}'s accounts are public: you can check every figure in its <a href="${href}" target="_blank" rel="noopener nofollow">official 10-K filings with the SEC (EDGAR)</a>.`,
    peerH2: 'Its price against peers',
    peerBody: (n, pfcf, median, count, sector, cheaper) =>
      `Against the ${count} other ${sector} stocks we have scored, ${n} trades at ${pfcf} its free cash flow, versus a median of ${median} for that basket. On price alone, ${n} is therefore ${cheaper ? 'cheaper' : 'more expensive'} than its peers. That says nothing about its quality: at Lubin Investment, quality and price are judged separately, and a low multiple is only a bargain if the quality holds up.`,
    crossVerdict: (n, goodQuality, cheap) =>
      goodQuality && cheap
        ? `This is the setup we look for: ${n} passes a large majority of our quality criteria while trading at a low free cash flow multiple. That is exactly the "quality company at the right price" profile, the one worth a closer look.`
        : goodQuality && !cheap
        ? `${n} is a quality company by our criteria, but the price does not follow: the free cash flow multiple stays high. A great company bought too expensively is still a poor investment, so this is typically one to watch while waiting for a better entry point.`
        : !goodQuality && cheap
        ? `${n} trades at a low free cash flow multiple but fails part of our quality criteria. Mind the trap: a low price is not a discount if the business is deteriorating. The low multiple may simply reflect a real problem.`
        : `${n} fails part of our quality criteria without the price making up for it. Neither quality nor valuation argues in its favour today, according to our 10 hard criteria.`,
    authorByline: (href) =>
      `Method and analysis by <a href="${href}">Lubin Danilo, founder of Lubin Investment</a>. Score computed automatically, with no human opinion.`,
    resUndervalued: 'Undervalued quality stocks',
    resCompare: (o) => `Compare with ${o}`,
  },
  es: {
    ogLocale: 'es_ES',
    inLanguage: 'es-ES',
    titlePrefix: '¿Comprar la acción ',
    titleSuffix: '? Nuestro análisis completo.',
    metaDescription: (n) => `Analizamos los fundamentales y la valoración de la acción ${n}: aquí están nuestras conclusiones.`,
    sectorUnknown: 'sector no especificado',
    oppLabel: '⭐ Oportunidad del momento',
    oppBody: (n) => `${n} está en su decil bajo histórico de valoración (P/FCF ≤ percentil 10 a 10 años, Y ratio &lt; 25×). Es un punto de entrada potencialmente interesante para inversores a largo plazo.`,
    updatedOn: 'Actualizado el',
    introVerdict: (n, score, quality, pfcfClause) => `Analizamos la acción ${n} con los 10 criterios de calidad de Lubin Investment. La empresa obtiene una nota de calidad de <strong>${score}</strong>, lo que significa calidad ${quality}${pfcfClause}.`,
    sectorPriceLine: (sector, exchange, price) => `Sector: ${sector}.${exchange ? ` Bolsa de cotización: ${exchange}.` : ''}${price ? ` Precio actual: ${price}.` : ''}`,
    methodH2: 'Metodología de puntuación Lubin',
    methodBody: (n, ticker) => `La nota de ${n} (${ticker}) se calcula automáticamente a partir de 10 criterios financieros objetivos, sin intervención humana ni opinión. Cada criterio se valida (SÍ / PARCIAL / NO) según umbrales sacados de la literatura financiera (Warren Buffett, Bettin-Mauboussin, Aswath Damodaran). La nota final es el total de las validaciones.`,
    criteriaH2: 'Los 10 criterios cuantitativos analizados',
    criteria: [
      "<strong>Rentable</strong>: margen neto positivo",
      "<strong>Ventas en crecimiento</strong>: ingresos &gt; 10%/año en 5 años",
      "<strong>Beneficio por acción en crecimiento</strong>: FCF por acción ajustado de la remuneración en acciones, &gt; 10%/año en 5 años",
      "<strong>Número de acciones controlado</strong>: estable o en bajada (recompras netas = creación de valor para el accionista)",
      "<strong>Rentabilidad cash</strong>: margen de free cash flow &gt; 10% de los ingresos",
      "<strong>Márgenes en expansión</strong>: el margen operativo se amplía en 5 años (operating leverage)",
      "<strong>Rentabilidad del capital invertido</strong>: Cash ROCE Bettin-Mauboussin &gt; 15% al año",
      "<strong>Deuda controlada</strong>: deuda neta amortizable en menos de 3 años de free cash flow",
      "<strong>Beneficios transformados en cash</strong>: el free cash flow supera el beneficio neto contable",
      "<strong>Plazo de cobro neto</strong>: ciclo de tesorería corto o negativo",
    ],
    faqH2: 'Preguntas frecuentes',
    faqQuality: (n) => `¿Es ${n} una acción de calidad?`,
    faqQualityA: (n, score, q) => `${n} obtiene una nota de calidad de ${score} (calidad ${q}), calculada con los 10 criterios de Lubin Investment: rentabilidad, crecimiento de los ingresos y del free cash flow, recompras de acciones, márgenes, deuda y rentabilidad del capital.`,
    faqHowScored: (n) => `¿Cómo se calcula la nota de ${n}?`,
    faqHowScoredA: 'La nota es el total de los criterios validados (SÍ / PARCIAL / NO) según umbrales sacados de la literatura financiera (Warren Buffett, Mauboussin, Aswath Damodaran), de forma automática y sin opinión humana.',
    faqPfcf: (n) => `¿Cuál es el P/FCF de ${n}?`,
    faqPfcfA: (n, p) => `El múltiplo precio / free cash flow (P/FCF) de la acción ${n} es ${p}. En Lubin Investment, la valoración se juzga por separado de la calidad.`,
    faqWhereFull: (n) => `¿Dónde ver el análisis completo de ${n}?`,
    faqWhereFullA: (c) => `El análisis interactivo completo (detalle de los 10 criterios, históricos, valoración P/FCF, comparaciones sectoriales) está disponible en ${c}.`,
    qualityHigh: 'alta',
    qualityMid: 'media',
    qualityLow: 'baja',
    qualityPending: 'por analizar',
    relatedHeadingWithSector: (s) => `Otras acciones del sector ${s}`,
    relatedHeadingFallback: 'Otras acciones para explorar',
    scoreNoted: 'nota',
    scoreSuffix: ' / ',
    goFurtherH2: 'Saber más',
    goFurtherCta: (ticker) => `Ver el análisis completo e interactivo de ${ticker}`,
    otherResources: 'Otros recursos',
    resMethod: 'Metodología detallada',
    resSectorHub: (s) => `Todas las acciones del sector ${s}`,
    resQuality10: 'Las acciones con nota 10 sobre 10',
    resTopQuality: 'Top empresas de calidad',
    resPricing: 'Tarifas Lubin Investment',
    headerNav: { home: 'Lubin Investment', screener: 'Screener', method: 'Metodología', pricing: 'Tarifas' },
    breadcrumbHome: 'Inicio',
    breadcrumbScreener: 'Screener',
    disclaimer: 'Lubin Investment es una herramienta de ayuda a la decisión para inversores particulares. Este servicio no constituye un consejo de inversión personalizado en el sentido del artículo L.321-1 del Código Monetario y Financiero francés. Las rentabilidades pasadas no garantizan rentabilidades futuras.',
    h1Analysis: 'Análisis fundamental',
    pfcfClauseTpl: (p) => `, y un múltiplo de valoración P/FCF de ${p}`,
    titleLong: (n, ticker, quality, pfcfPart, year) =>
      `¿Comprar la acción ${n} (${ticker})? Opinión y análisis fundamental gratis: calidad ${quality} en 10 criterios${pfcfPart}, infravalorada o no, precio de compra aconsejado. Nuestro veredicto ${year}.`,
    titleLongPfcf: (p) => `, valoración frente a su historial`,
    sourcesLiterature:
      `Los umbrales vienen de la literatura financiera, no de nuestras preferencias: ver los trabajos de valoración de <a href="https://pages.stern.nyu.edu/~adamodar/" target="_blank" rel="noopener nofollow">Aswath Damodaran (NYU Stern)</a> y los <a href="https://www.investor.gov/" target="_blank" rel="noopener nofollow">recursos educativos de la SEC (investor.gov)</a>.`,
    sourcesFilings: (n, href) =>
      `Las cuentas de ${n} son públicas: puedes verificar cada cifra en sus <a href="${href}" target="_blank" rel="noopener nofollow">informes oficiales 10-K ante la SEC (EDGAR)</a>.`,
    peerH2: 'Su precio frente a sus comparables',
    peerBody: (n, pfcf, median, count, sector, cheaper) =>
      `Frente a las ${count} otras acciones del sector ${sector} que hemos puntuado, ${n} cotiza a ${pfcf} su free cash flow, frente a una mediana de ${median} para esa cesta. Solo por precio, ${n} es por tanto ${cheaper ? 'más barata' : 'más cara'} que sus comparables. Eso no dice nada de su calidad: en Lubin Investment, la calidad y el precio se juzgan por separado, y un múltiplo bajo solo es una oportunidad si la calidad se sostiene.`,
    crossVerdict: (n, goodQuality, cheap) =>
      goodQuality && cheap
        ? `Este es el caso que buscamos: ${n} valida una amplia mayoría de nuestros criterios de calidad y además cotiza a un múltiplo de free cash flow bajo. Es exactamente el perfil de «empresa de calidad al precio correcto», el que merece una mirada atenta.`
        : goodQuality && !cheap
        ? `${n} es una empresa de calidad según nuestros criterios, pero el precio no acompaña: el múltiplo de free cash flow sigue alto. Una buena empresa pagada demasiado cara sigue siendo una mala inversión, así que es un valor para vigilar esperando un mejor punto de entrada.`
        : !goodQuality && cheap
        ? `${n} cotiza a un múltiplo de free cash flow bajo pero falla en parte de nuestros criterios de calidad. Cuidado con la trampa: un precio bajo no es un descuento si el negocio se deteriora. El múltiplo bajo puede reflejar simplemente un problema real.`
        : `${n} falla en parte de nuestros criterios de calidad sin que el precio lo compense. Hoy ni la calidad ni la valoración están a su favor, según nuestros 10 criterios.`,
    authorByline: (href) =>
      `Método y análisis por <a href="${href}">Lubin Danilo, fundador de Lubin Investment</a>. Nota calculada automáticamente, sin opinión humana.`,
    resUndervalued: 'Las acciones de calidad infravaloradas',
    resCompare: (o) => `Comparar con ${o}`,
  },
};

function qualityLabelI18n(tr: TickerTr, score: number | null, max: number | null): string {
  if (score == null || !max) return tr.qualityPending;
  const ratio = score / max;
  if (ratio >= 0.8) return tr.qualityHigh;
  if (ratio >= 0.5) return tr.qualityMid;
  return tr.qualityLow;
}

/**
 * Bucket A/B DÉTERMINISTE (≈50 % des tickers) pour le titre long multi-intention.
 *
 * Le corpus mesure +10 à 40 % de trafic avec des titres de 150-250 caractères couvrant
 * 3-4 intentions, contre un titre court « propre » ≤ 60 car. Mais ce chiffre vient
 * exclusivement de sites anglophones, et notre titre court actuel est un choix délibéré.
 * On n'inverse donc pas 30 000 fiches sur une preuve non répliquée en français : la moitié
 * des tickers reçoit le titre long, l'autre garde l'ancien, et la Search Console tranche
 * (le corpus insiste : ne tester qu'une variable à la fois).
 *
 * Déterministe et stable dans le temps : un ticker ne doit JAMAIS changer de bucket entre
 * deux crawls, sinon le test est inexploitable et Google voit un titre instable.
 */
export function useLongTitle(ticker: string): boolean {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) % 1_000_003;
  return h % 2 === 0;
}

/** Élision française devant voyelle ou h muet : « de Apple » → « d'Apple ». Les noms de
 *  sociétés étant injectés dans des phrases générées, sans ça le texte FR sonne faux. */
function deFr(name: string): string {
  return /^[aeiouàâäéèêëîïôöuùûüyh]/i.test(name.trim()) ? `d'${name}` : `de ${name}`;
}

/** Dépôts 10-K sur EDGAR. US uniquement : la SEC ne couvre pas les autres places de cotation. */
function edgarFilingsUrl(ticker: string): string {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&ticker=${encodeURIComponent(
    ticker,
  )}&type=10-K&dateb=&owner=include&count=40`;
}

/** Les seuls champs qui décident de l'indexation d'une fiche. */
export type TickerIndexInput = {
  scoreRatio: number | null;
  pfcfTTM: number | null;
  price: number | null;
  region: string | null;
  marketCap: number | null;
  opportunity: boolean;
  /** Un article du blog pointe vers ce ticker. */
  hasArticle: boolean;
};

/**
 * SOURCE UNIQUE de la règle d'indexation des fiches /analyse/TICKER.
 *
 * Elle décide de deux choses qui doivent rester d'accord : la balise robots servie par
 * `renderTickerHtml` et le contenu des sitemaps de fiches. Quand les deux divergent, on
 * advertise dans le sitemap des URL en `noindex`, ce qui est un signal contradictoire envoyé
 * à Google sur des milliers de pages. Ce fichier était jusqu'ici la référence et `sitemap.ts`
 * en tenait une copie manuelle en clause Prisma, avec un avertissement en commentaire ; le
 * test `sitemap.indexRule.test.ts` verrouille désormais l'équivalence sur une matrice
 * exhaustive.
 *
 * La règle, dans l'ordre :
 *   1. Opportunité du moment ou ticker traité par un article : toujours indexée. Ce sont les
 *      pages sur lesquelles on a activement quelque chose à dire.
 *   2. Sinon, un multiple de valorisation est OBLIGATOIRE (palier 1, 2026-08-04). Sans lui la
 *      fiche ne peut répondre ni « sous-évaluée ou pas », ni « à quel prix acheter », c'est-à-dire
 *      ni à son propre titre ni à la moitié de la proposition de valeur du site.
 *   3. Et, si la note est sous 5/10, on écarte en plus les penny stocks et les micro
 *      capitalisations américaines (règle de l'audit du 19 juillet 2026).
 */
export function shouldIndexTicker(t: TickerIndexInput): boolean {
  if (t.opportunity || t.hasArticle) return true;
  if (t.pfcfTTM == null) return false;
  const lowScore = t.scoreRatio != null && t.scoreRatio < 0.5;
  if (!lowScore) return true;
  const isPenny = t.price != null && t.price < 1;
  const verySmallCapUS = t.region === 'US' && t.marketCap != null && t.marketCap < 500_000_000;
  return !isPenny && !verySmallCapUS;
}

/** Médiane d'une série (sert à situer le P/FCF d'une fiche face à ses comparables sectoriels). */
function medianOf(values: Array<number | null | undefined>): number | null {
  const xs = values
    .filter((v): v is number => v != null && isFinite(v))
    .sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  if (xs.length % 2 === 0) return ((xs[mid - 1] as number) + (xs[mid] as number)) / 2;
  return xs[mid] as number;
}

// HTML pré-rendu riche pour un ticker scoré. C'est le cœur du fix Soft 404 :
// 3-5 Ko de texte indexable, structure sémantique H1/H2, vraies meta tags.
// Exporté pour permettre les tests offline (cf. scripts/test-seo-trilingue.ts).
export function renderTickerHtml(
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
    marketCap?: number | null;
    scoreRatio?: number | null;
    lastScoredAt: Date | null;
  },
  related: Array<{
    ticker: string;
    name: string | null;
    scoreChiffres: number | null;
    scoreChiffresMax: number | null;
    pfcfTTM: number | null;
  }> = [],
  lang: ArticleLang = 'fr',
): string {
  const tr = TICKER_TR[lang];
  // Suffixe de langue pour les liens internes (fr = URL nue ; en/es = ?lng=).
  const lq = lang === 'fr' ? '' : `?lng=${lang}`;
  const lqAmp = lang === 'fr' ? '' : `&lng=${lang}`;
  const safeTicker = escapeHtml(t.ticker);
  const name = t.name ? escapeHtml(t.name) : safeTicker;
  const sector = t.sector ? escapeHtml(t.sector) : tr.sectorUnknown;
  const score = formatScore(t.scoreChiffres, t.scoreChiffresMax);
  const quality = qualityLabelI18n(tr, t.scoreChiffres, t.scoreChiffresMax);
  const pfcf = t.pfcfTTM != null && isFinite(t.pfcfTTM) ? `${t.pfcfTTM.toFixed(1)}×` : ', ';
  // Clause P/FCF inline, ajoutée à la phrase de verdict UNIQUEMENT si on a la donnée.
  const pfcfClause = t.pfcfTTM != null && isFinite(t.pfcfTTM)
    ? tr.pfcfClauseTpl(pfcf)
    : '';
  const price = t.price != null && isFinite(t.price) ? `${t.price.toFixed(2)} ${escapeHtml(t.currency || 'USD')}` : '';
  // Règle d'indexation (audit SEO 2026-07-19) : on ne garde en index que les fiches à valeur.
  // noindex,follow sur le « bas » — note < 5/10 ET (very small cap US < 500 M$ OU pas de P/FCF
  // OU penny < 1 $) — SAUF opportunité du moment ou ticker rattaché à un article. Concentre le
  // budget de crawl et remonte le signal qualité du domaine (des milliers de fiches quasi
  // dupliquées étaient « explorées, non indexées » par Google). ⚠️ Doit rester STRICTEMENT
  // cohérent avec le filtre de sitemap.ts, sinon on advertise dans le sitemap des pages noindex.
  const ratio = t.scoreChiffres != null && t.scoreChiffresMax ? t.scoreChiffres / t.scoreChiffresMax : null;
  const hasArticle = listArticles().some(
    (a) => !!a.ticker && a.ticker.toUpperCase() === t.ticker.toUpperCase(),
  );
  const verySmallCapUS = t.region === 'US' && t.marketCap != null && t.marketCap < 500_000_000;
  const lowScore = ratio != null && ratio < 0.5;
  //
  // PALIER 1 de la réduction du catalogue (Q10 du plan SEO, 2026-08-04).
  //
  // Une fiche sans AUCUN multiple de valorisation ne peut pas répondre à la question que son
  // propre titre pose. Elle n'a ni « sous-évaluée ou pas », ni prix d'achat conseillé, ni
  // comparaison sectorielle : la moitié de la proposition de valeur du site manque, quelle que
  // soit la note de qualité. Ce sont massivement des biotechs sans free cash flow (596 fiches
  // dans ce secteur) et des sociétés coquilles (238 fiches). Le corpus est direct : une page
  // doit exister parce qu'on a quelque chose à dire, pas parce qu'on veut classer un mot-clé.
  //
  // Mesuré sur le catalogue au 4 août 2026 : 6 818 fiches scorées, 2 004 sans multiple, dont
  // 1 253 qui n'étaient pas déjà exclues par la règle de juillet. L'index passe de 5 590 à
  // 4 337 fiches. Trois faits appuient la direction : Google dépense 30 à 40 % de son budget
  // d'exploration sur des pages sans trafic, supprimer la moitié des pages à faible autorité
  // d'un domaine a multiplié son trafic par 5, et environ la moitié des URL du site n'était pas
  // indexée.
  //
  // `noindex, follow` et non 404 : la page reste lisible pour un humain qui la demande, elle
  // transmet toujours ses liens, et le geste est réversible en un commit. Consolider vaut mieux
  // que supprimer.
  //
  // Le palier 2 (seuil de capitalisation, environ 700 fiches de plus) attend le diagnostic de
  // l'effondrement des impressions : deux variables à la fois rendraient la mesure illisible.
  const noindex = !shouldIndexTicker({
    scoreRatio: ratio, pfcfTTM: t.pfcfTTM ?? null, price: t.price ?? null,
    region: t.region ?? null, marketCap: t.marketCap ?? null,
    opportunity: t.opportunity, hasArticle,
  });
  const robots = noindex ? 'noindex,follow' : 'index,follow';
  const oppBadge = t.opportunity
    ? `<p><strong>${tr.oppLabel} :</strong> ${tr.oppBody(name)}</p>`
    : '';

  const baseCanonical = `${SITE_URL}/analyse/${safeTicker}`;
  const canonical = lang === 'fr' ? baseCanonical : `${baseCanonical}?lng=${lang}`;
  // hreflang : pointe vers toutes les variantes linguistiques + x-default sur la version FR.
  const hreflang = (['fr', 'en', 'es'] as const)
    .map((l) => `<link rel="alternate" hreflang="${l}" href="${l === 'fr' ? baseCanonical : `${baseCanonical}?lng=${l}`}">`)
    .join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${baseCanonical}">`;
  // Maillage hub-spoke : lien vers le hub de son secteur (réduit la profondeur de crawl).
  const sectorHubHref = t.sector ? `${SITE_URL}/secteur/${slugifySector(t.sector)}${lq}` : null;
  const sectorHubLabel = t.sector ? escapeHtml(displaySector(t.sector, lang)) : null;
  const rawName = t.name || t.ticker;
  // Nom de marque (sans suffixe juridique) pour les textes user-facing.
  // Le nom officiel reste utilisé dans le JSON-LD Corporation (entity-matching).
  const displayName = stripLegalSuffix(rawName);
  const displayNameEsc = escapeHtml(displayName);

  // Titre format question + verdict, vraie phrase plutôt qu'assemblage de mots-clés.
  // Nom tronqué si besoin pour viser ≤ 60 car (Google tronque souvent au-delà).
  let titleName = displayName;
  const nameBudget = 60 - tr.titlePrefix.length - tr.titleSuffix.length;
  if (titleName.length > nameBudget) {
    let cut = displayName.slice(0, Math.max(6, nameBudget - 1));
    const lastSpace = cut.lastIndexOf(' ');
    if (lastSpace > 8) cut = cut.slice(0, lastSpace); // coupe sur un mot entier
    titleName = cut.trimEnd() + '…';
  }
  const shortTitle = `${tr.titlePrefix}${titleName}${tr.titleSuffix}`;
  // Variante longue multi-intention (avis / faut-il acheter / note / valorisation /
  // sous-évaluée), servie à la moitié des tickers pour mesurer l'écart en GSC.
  // Le vocabulaire est choisi pour recouper les sous-requêtes que les moteurs IA génèrent
  // au moment du « fan-out » (le corpus mesure que c'est ce vocabulaire, et non la question
  // complète de l'utilisateur, qui décide de la récupération).
  //
  // ⚠️ 2026-08-04 (Q7 du plan SEO) : le titre long ne porte plus de JARGON. Il disait
  // « note de qualité 8/10, valorisation P/FCF 51.1× » ; il dit maintenant « qualité élevée
  // sur 10 critères, valorisation face à son historique ». Trois raisons.
  //   1. C'est une règle produit explicite : jamais de « X/10 » ni de « P/FCF » avant le clic.
  //      Le garde-fou CI `title-lint` l'applique depuis des mois aux 348 articles, il ne
  //      voyait pas les 5000 fiches. La règle protégeait 6 % des pages du site.
  //   2. Un ratio brut avant le clic ne se comprend pas dans une page de résultats. Le
  //      chiffre reste partout dans le corps de la page, là où il est expliqué.
  //   3. Le mot « gratuite » est ajouté : le corpus mesure un passage de la position 7 à 2,5
  //      sur un mot-clé à plusieurs millions de recherches par ce seul ajout, et l'analyse
  //      est réellement gratuite ici.
  // Le titre garde sa longueur et ses 4 intentions (faut-il acheter / avis / sous-évaluée /
  // prix d'achat), et l'essentiel reste dans les 12 premiers mots.
  //
  // ⚠️ CONSÉQUENCE SUR L'A/B EN COURS : le bras « long » a changé le 2026-08-04. Les données
  // GSC d'avant et d'après ne forment PAS une seule série, ne les additionnez pas. Le test
  // était de toute façon illisible (220 impressions sur 28 jours au 3 août, 5 requêtes).
  const verdictYear = (t.lastScoredAt ?? new Date()).getFullYear();
  const longTitle = tr.titleLong(
    displayName,
    t.ticker,
    quality,
    t.pfcfTTM != null && isFinite(t.pfcfTTM) ? tr.titleLongPfcf(pfcf) : '',
    verdictYear,
  );
  const rawTitle = useLongTitle(t.ticker) ? longTitle : shortTitle;
  const title = escapeHtml(rawTitle);

  // ⚠️ Description : elle n'alimente PLUS de <meta name="description"> (cf. plus bas).
  // Elle reste utilisée pour Open Graph / Twitter, où le texte est réellement repris tel
  // quel par les réseaux sociaux (usage différent du snippet Google).
  const rawDescription = tr.metaDescription(displayName);
  const description = escapeHtml(rawDescription);

  // Fraîcheur = date RÉELLE du dernier scoring (lastScoredAt), pas la date du rendu.
  // Un dateModified qui change à chaque crawl est un signal de contenu auto-généré de
  // faible valeur (contribue au « Explorée, actuellement non indexée »). lastScoredAt ne
  // bouge qu'au re-scoring (≈ aux earnings) → signal de fraîcheur honnête et stable.
  const scoredAt = t.lastScoredAt ?? new Date();
  const isoDate = scoredAt.toISOString();
  const dateLoc = (() => {
    const dd = String(scoredAt.getDate()).padStart(2, '0');
    const mm = String(scoredAt.getMonth() + 1).padStart(2, '0');
    const yyyy = scoredAt.getFullYear();
    // Format dd/mm/yyyy pour fr/es, mm/dd/yyyy pour en (convention locale).
    return lang === 'en' ? `${mm}/${dd}/${yyyy}` : `${dd}/${mm}/${yyyy}`;
  })();

  // FAQ, levier GEO majeur (FAQPage = ~3,2× plus de citations dans les AI Overviews).
  const faq: { q: string; a: string }[] = [
    { q: tr.faqQuality(displayName), a: tr.faqQualityA(displayName, score, quality) },
    { q: tr.faqHowScored(displayName), a: tr.faqHowScoredA },
    ...(t.pfcfTTM != null && isFinite(t.pfcfTTM)
      ? [{ q: tr.faqPfcf(displayName), a: tr.faqPfcfA(displayName, pfcf) }]
      : []),
    { q: tr.faqWhereFull(displayName), a: tr.faqWhereFullA(canonical) },
  ];

  // Maillage interne sur les ARTICLES qui mentionnent ce ticker (article.ticker).
  // Renforce le crawl Googlebot fiche → articles (les articles seuls étaient orphelins).
  const articlesForTicker = listArticles()
    .filter((a) => a.ticker && a.ticker.toUpperCase() === t.ticker.toUpperCase())
    .slice(0, 5);
  const articlesHeading = lang === 'en' ? `Articles about ${displayName}` : lang === 'es' ? `Artículos sobre ${displayName}` : `Articles sur ${displayName}`;
  const articlesSection = articlesForTicker.length > 0
    ? `\n\n<h2>${articlesHeading}</h2>\n<ul>\n${articlesForTicker.map((a) => {
        const c = a.content[lang] || a.content.fr;
        const title = c?.title ? escapeHtml(c.title) : escapeHtml(a.slug);
        return `<li><a href="${SITE_URL}/blog/${encodeURIComponent(a.slug)}${lq}">${title}</a> <small>(${escapeHtml(a.date)})</small></li>`;
      }).join('\n')}\n</ul>`
    : '';
  // Maillage interne : 3-5 tickers comparables (même secteur), liens cliquables avec score + P/FCF
  // en anchor text. La langue se propage dans les liens (?lng=) pour rester cohérent côté nav bot.
  const sectorLabel = t.sector ? escapeHtml(displaySector(t.sector, lang)) : null;
  const relatedHeading = sectorLabel ? tr.relatedHeadingWithSector(sectorLabel) : tr.relatedHeadingFallback;
  const relatedSection = related.length > 0 ? `

<h2>${relatedHeading}</h2>
<ul>
${related.slice(0, 4).map((r) => {
  const rTicker = escapeHtml(r.ticker);
  const rRawName = r.name || r.ticker;
  const rDisplayName = escapeHtml(stripLegalSuffix(rRawName));
  const rScore = r.scoreChiffres != null && r.scoreChiffresMax
    ? `${r.scoreChiffres}/${r.scoreChiffresMax}`
    : (lang === 'en' ? 'not scored' : lang === 'es' ? 'sin nota' : 'non noté');
  const rPfcf = r.pfcfTTM != null && isFinite(r.pfcfTTM)
    ? `${r.pfcfTTM.toFixed(1)}×`
    : null;
  return `<li><a href="${SITE_URL}/analyse/${rTicker}${lq}">${rDisplayName} (${rTicker})</a>, ${tr.scoreNoted} ${rScore}${rPfcf ? `, P/FCF ${rPfcf}` : ''}</li>`;
}).join('\n')}
</ul>` : '';

  // ─── Texte dérivé de la DB, donc UNIQUE par fiche ────────────────────────────
  // Contre-mesure au risque n°1 de ce site : ~30 000 pages dans un même dossier dont les
  // slugs ne varient que par le ticker, c'est le motif que Google traite comme des pages
  // satellites « même si le contenu est correct ». La défense documentée n'est pas de
  // supprimer les pages, c'est que chaque page porte de la donnée propriétaire réelle.
  // Ici : médiane de P/FCF du panier sectoriel + lecture croisée qualité × prix.
  const peerMedian = medianOf(related.map((r) => r.pfcfTTM));
  const hasPfcf = t.pfcfTTM != null && isFinite(t.pfcfTTM);
  const peerSection =
    hasPfcf && peerMedian != null && sectorLabel && related.length >= 2
      ? `\n\n<h2>${tr.peerH2}</h2>\n<p>${tr.peerBody(
          displayNameEsc,
          pfcf,
          `${peerMedian.toFixed(1)}×`,
          related.length,
          sectorLabel,
          (t.pfcfTTM as number) < peerMedian,
        )}</p>`
      : '';

  // « Cher / pas cher » : relatif aux comparables quand on a une médiane sectorielle,
  // sinon repli sur un seuil absolu aligné sur la règle « opportunité » du screener.
  const cheap =
    hasPfcf && peerMedian != null
      ? (t.pfcfTTM as number) < peerMedian
      : hasPfcf && (t.pfcfTTM as number) < 20;
  const goodQuality = ratio != null && ratio >= 0.7;
  // Rendu seulement si la fiche est réellement notée ET valorisée : sinon la phrase
  // affirmerait quelque chose que la donnée ne soutient pas.
  const crossSection =
    ratio != null && hasPfcf
      ? `\n<p>${tr.crossVerdict(displayNameEsc, goodQuality, cheap)}</p>`
      : '';

  // Liens sortants vers sources autoritaires, placés DANS la section concernée (et non
  // regroupés en fin de page) : c'est le geste on-page le mieux prouvé du corpus, et un
  // signal de confiance en régime YMYL. `nofollow` par prudence sur des liens templatisés
  // à l'échelle de 30 000 pages, le bénéfice mesuré portant sur le fait de citer ses sources.
  const filingsLine =
    t.region === 'US'
      ? `\n<p>${tr.sourcesFilings(displayNameEsc, edgarFilingsUrl(t.ticker))}</p>`
      : '';
  const literatureLine = `\n<p>${tr.sourcesLiterature}</p>`;

  // Signature auteur (E-E-A-T). On met la BYLINE seule, pas la bio complète : dupliquer
  // 1 500 caractères de biographie sur 30 000 fiches serait précisément le boilerplate
  // que la politique « contenu à l'échelle » cible. La bio complète reste sur les articles.
  const bylineLine = `<p><small>${tr.authorByline(`${SITE_URL}/methodologie${lq}`)}</small></p>`;

  // Lien vers la page de comparaison « X vs Y » quand ce ticker fait partie d'une paire
  // curée. Indispensable : une page de comparaison qui vient d'être créée n'a AUCUN lien
  // entrant, et une page orpheline est ignorée ou déprioritisée par Google. La fiche est
  // justement une page déjà crawlée, donc c'est le bon émetteur de ce lien.
  const comparePair = COMPARE_PAIRS.find(([x, y]) => x === t.ticker || y === t.ticker);
  const compareLink = comparePair
    ? (() => {
        const other = comparePair[0] === t.ticker ? comparePair[1] : comparePair[0];
        const href = `${SITE_URL}/comparer/${comparePairSlug(comparePair[0], comparePair[1])}${lq}`;
        return `\n<a href="${href}">${escapeHtml(tr.resCompare(other))}</a> ·`;
      })()
    : '';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<!-- AUCUNE balise meta de description ici, VOLONTAIREMENT (audit masterclass SEO 2026-08-04).
     Mesures du corpus : Google ignore la description fournie 63 % du temps, les siennes
     obtiennent +3 % de clics vs une description écrite, et surtout les descriptions
     GÉNÉRÉES PAR GABARIT font moins bien que PAS de description du tout. Nos 30 000 fiches
     étaient exactement ce cas (une seule phrase templatisée par langue). On laisse donc
     Google composer le snippet depuis le texte de la page. Les descriptions écrites à la
     main sont conservées sur les pages clés (articles, pages statiques).
     La variable "description" reste utilisée pour Open Graph / Twitter juste en dessous :
     là, le texte est repris tel quel par les réseaux, ce n'est pas un snippet de SERP. -->
<meta name="robots" content="${robots}">
<link rel="canonical" href="${canonical}">
${hreflang}
<link rel="icon" type="image/svg+xml" href="${SITE_URL}/favicon.svg">

<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Lubin Investment">
<meta property="og:locale" content="${tr.ogLocale}">
<meta property="og:image" content="${SITE_URL}/og-default.png">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@${X_HANDLE}">
<meta name="twitter:creator" content="@${X_HANDLE}">
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
  inLanguage: tr.inLanguage,
  datePublished: isoDate,
  dateModified: isoDate,
  about: {
    '@type': 'Corporation',
    name: rawName,
    tickerSymbol: t.ticker,
    ...(t.exchange ? { tickerExchange: t.exchange } : {}),
  },
  // Auteur identifié : la finance est en régime YMYL renforcé, et la réputation d'auteur
  // est un signal conservé par Google. Les fiches n'en portaient aucun (seuls les articles
  // en avaient). Bio volontairement absente ici, cf. bylineLine.
  author: {
    '@type': 'Person',
    name: AUTHOR_NAME,
    jobTitle: AUTHOR_JOBTITLE[lang],
    url: `${SITE_URL}/methodologie${lq}`,
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
    { '@type': 'ListItem', position: 1, name: tr.breadcrumbHome, item: `${SITE_URL}/${lq}` },
    { '@type': 'ListItem', position: 2, name: tr.breadcrumbScreener, item: `${SITE_URL}/screener${lq}` },
    { '@type': 'ListItem', position: 3, name: `${rawName} (${t.ticker})`, item: canonical },
  ],
}, null, 2)}
</script>
</head>
<body>

<header>
  <p><span data-nosnippet><a href="${SITE_URL}/${lq}">${tr.headerNav.home}</a> · <a href="${SITE_URL}/screener${lq}">${tr.headerNav.screener}</a> · <a href="${SITE_URL}/methodologie${lq}">${tr.headerNav.method}</a> · <a href="${SITE_URL}/pricing${lq}">${tr.headerNav.pricing}</a></span></p>
</header>

<main>

<nav aria-label="${tr.breadcrumbHome}"><span data-nosnippet><a href="${SITE_URL}/${lq}">${tr.breadcrumbHome}</a> › <a href="${SITE_URL}/screener${lq}">${tr.breadcrumbScreener}</a> ${sectorHubHref ? `› <a href="${sectorHubHref}">${sectorHubLabel}</a> ` : ''}› ${name} (${safeTicker})</span></nav>

<h1>${tr.h1Analysis} ${safeTicker} (${name})</h1>
<p><small>${tr.updatedOn} ${dateLoc}</small></p>
${bylineLine}

<p>${tr.introVerdict(displayNameEsc, score, quality, pfcfClause)}</p>
${crossSection}

<p>${tr.sectorPriceLine(sector, t.exchange ? escapeHtml(t.exchange) : '', price)}</p>

${oppBadge}

<h2>${tr.methodH2}</h2>
<p>${tr.methodBody(name, safeTicker)}</p>${literatureLine}${filingsLine}

<h2>${tr.criteriaH2}</h2>
<ol>
${tr.criteria.map((c) => `<li>${c}</li>`).join('\n')}
</ol>
${peerSection}

<h2>${tr.faqH2}</h2>
${faq.map((f) => `<h3>${escapeHtml(f.q)}</h3>\n<p>${escapeHtml(f.a)}</p>`).join('\n')}
${articlesSection}
${relatedSection}

<h2>${tr.goFurtherH2}</h2>
<p>👉 <a href="${canonical}"><strong>${tr.goFurtherCta(safeTicker)}</strong></a></p>

<!-- Ressources : on ne relie ICI que des cibles ABSENTES du header (hubs secteur + classements).
     Raison mesurée : Google ne compte que le PREMIER lien d'une page vers une URL donnée. Le
     header pointe déjà vers /screener, /methodologie et /pricing avec une ancre générique, donc
     les rappeler ici avec une belle ancre descriptive ne transmettait rien, ça ne faisait que
     gonfler le nombre de liens (le corpus recommande ~5 liens utiles dans le corps, pas 50). -->
<p>${tr.otherResources} :${compareLink}
${sectorHubHref ? `<a href="${sectorHubHref}">${tr.resSectorHub(sectorHubLabel || '')}</a> ·\n` : ''}<a href="${SITE_URL}/classement/qualite-10-sur-10${lq}">${tr.resQuality10}</a> ·
<a href="${SITE_URL}/classement/sous-evaluees${lq}">${tr.resUndervalued}</a>.</p>

</main>

<footer>
${renderFooterNav(lang, lq, ['/screener', '/methodologie', '/pricing', '/classement/qualite-10-sur-10', '/classement/sous-evaluees'])}
<p><small><span data-nosnippet>${tr.disclaimer}</span></small></p>
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
        marketCap: true,
        scoreRatio: true,
        exchange: true,
        status: true,
        lastScoredAt: true,
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

    // Langue demandée par le bot via ?lng= (les alternates hreflang du sitemap pointent
    // vers ?lng=en / ?lng=es). Défaut fr. Le cache CDN distingue les langues car ?lng=
    // fait partie de l'URL canonique.
    const lang = toArticleLang(typeof req.query.lng === 'string' ? req.query.lng : 'fr');
    // Cache CDN : on peut se permettre 1h, les notes bougent lentement.
    res
      .status(200)
      .set('Content-Type', 'text/html; charset=utf-8')
      .set('Cache-Control', 'public, max-age=3600, s-maxage=3600')
      .send(renderTickerHtml(t, related, lang));
  } catch (err) {
    // En cas d'erreur DB, on renvoie un 503 plutôt qu'une page vide, Google retentera plus tard.
    console.error('[seoPrerender]', ticker, (err as Error).message);
    res.status(503).set('Content-Type', 'text/html; charset=utf-8').send(render404(ticker));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Pages de comparaison « X vs Y » (/comparer/aapl-vs-msft)
//
// Pourquoi ce format précisément : c'est le SEUL motif programmatique du corpus validé
// par une expérience contrôlée (15 à 20 pages de comparaison concurrent classées en
// première page en 3 semaines), et « X vs Y » est l'un des patrons de sous-requêtes que
// les moteurs génératifs produisent au fan-out. Le site avait un comparateur interactif
// (/compare) mais AUCUNE page indexable dédiée : rien ne pouvait donc se classer dessus.
//
// Garde-fous appliqués :
//   - liste CURÉE et courte (pas de génération combinatoire sur 30 000 tickers, qui
//     produirait des millions d'URLs quasi vides, exactement le motif sanctionné) ;
//   - tout le texte est DÉRIVÉ des deux fiches réelles (notes, P/FCF, capi), donc le
//     contenu dépend des variables et diffère d'une paire à l'autre ;
//   - parité éditoriale stricte : le verdict suit la donnée, aucune des deux valeurs
//     n'est favorisée. Le corpus mesure que c'est LA variable de survie en YMYL
//     (ClickUp -97,6 % en s'auto-favorisant, Zapier -53 % à traitement égal).
// ─────────────────────────────────────────────────────────────────────────────

/** Paires curées : même secteur, deux sociétés que les investisseurs comparent vraiment.
 *  Ajouter une paire = ajouter une page. Rester dans cet ordre de grandeur (~20). */
export const COMPARE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['MSFT', 'GOOGL'], ['ADBE', 'CRM'], ['NVDA', 'AMD'], ['TSM', 'INTC'],
  ['V', 'MA'], ['COST', 'WMT'], ['HD', 'LOW'], ['KO', 'PEP'],
  ['NFLX', 'DIS'], ['LLY', 'MRK'], ['JNJ', 'PFE'], ['JPM', 'BAC'],
  ['PGR', 'ALL'], ['LMT', 'RTX'], ['NKE', 'LULU'], ['MCD', 'SBUX'],
  ['UPS', 'FDX'], ['SPGI', 'MSCI'], ['ASML', 'AMAT'],
];

/** Slug canonique d'une paire (minuscules, « -vs- »). Contient le token « vs », qui est
 *  le patron de sous-requête visé, et reste stable dans le temps (les tickers ne bougent
 *  pas, contrairement aux raisons sociales). */
export function comparePairSlug(a: string, b: string): string {
  return `${a.toLowerCase()}-vs-${b.toLowerCase()}`;
}

/** Parse « aapl-vs-msft » → ['AAPL','MSFT']. Null si la forme n'est pas reconnue. */
function parseComparePair(slug: string): [string, string] | null {
  const m = /^([a-z0-9.\-]{1,12})-vs-([a-z0-9.\-]{1,12})$/i.exec(slug);
  if (!m || !m[1] || !m[2]) return null;
  const a = m[1].toUpperCase();
  const b = m[2].toUpperCase();
  if (a === b) return null;
  return [a, b];
}

type CompareTr = {
  title: (an: string, at: string, bn: string, bt: string) => string;
  h1: (an: string, at: string, bn: string, bt: string) => string;
  intro: (an: string, bn: string, qualityWinner: string, priceWinner: string) => string;
  introTie: (an: string, bn: string) => string;
  tableH2: string;
  thMetric: string; thScore: string; thPfcf: string; thSector: string; thPrice: string; thCap: string;
  qualityH2: string;
  qualityBody: (hn: string, hs: string, ln: string, ls: string) => string;
  qualityEqual: (an: string, bn: string, sc: string) => string;
  priceH2: string;
  priceBody: (cn: string, cp: string, dn: string, dp: string) => string;
  priceMissing: string;
  verdictH2: string;
  verdictBody: (an: string, bn: string) => string;
  goFurtherH2: string;
  seeA: (n: string, t: string) => string;
  interactive: string;
  na: string;
  faqH2: string;
  faqBetterQ: (an: string, bn: string) => string;
  faqCheaperQ: (an: string, bn: string) => string;
  faqBothQ: string;
  faqBothA: string;
  breadcrumbCompare: string;
  /** « contre » / « against » / « frente a » : le comparatif etait code en dur en FR. */
  vsWord: string;
};

const COMPARE_TR: Record<ArticleLang, CompareTr> = {
  fr: {
    title: (an, at, bn, bt) => `${an} (${at}) vs ${bn} (${bt}) : quelle action est la meilleure ? Notes de qualité, valorisation P/FCF et verdict`,
    h1: (an, at, bn, bt) => `${an} (${at}) vs ${bn} (${bt}) : la comparaison chiffrée`,
    intro: (an, bn, qw, pw) => `Sur nos 10 critères de qualité, c'est ${qw} qui l'emporte. Sur le prix, c'est ${pw} qui se paie le moins cher rapporté à son free cash flow. Autrement dit, comparer ${an} et ${bn} demande de répondre à deux questions séparées, et elles n'ont pas forcément la même réponse.`,
    introTie: (an, bn) => `${an} et ${bn} obtiennent la même note de qualité sur nos 10 critères. Le départage se joue donc sur le prix, et sur ce que tu penses de leurs perspectives.`,
    tableH2: 'Les deux actions côte à côte',
    thMetric: 'Critère', thScore: 'Note de qualité', thPfcf: 'P/FCF', thSector: 'Secteur', thPrice: 'Cours', thCap: 'Capitalisation',
    qualityH2: 'La qualité : qui valide le plus de critères',
    qualityBody: (hn, hs, ln, ls) => `${hn} valide ${hs} de nos critères de qualité, contre ${ls} pour ${ln}. Ces critères sont les mêmes pour les deux : rentabilité, croissance du chiffre d'affaires et du free cash flow par action, contrôle du nombre d'actions, marge de free cash flow, expansion des marges, rendement du capital, endettement, conversion du bénéfice en cash et cycle de trésorerie. Aucune pondération, aucun avis : c'est un décompte.`,
    qualityEqual: (an, bn, sc) => `${an} et ${bn} valident autant de critères l'une que l'autre, ${sc}. La qualité financière ne permet donc pas de les départager sur nos critères.`,
    priceH2: 'Le prix : qui se paie le moins cher',
    priceBody: (cn, cp, dn, dp) => `${cn} se paie ${cp} son free cash flow, contre ${dp} pour ${dn}. Un multiple plus bas veut dire que tu paies moins d'années de cash pour la même part d'entreprise. Attention au réflexe : un multiple bas n'est une bonne affaire que si la qualité tient. C'est pour ça que nous jugeons les deux séparément, et jamais l'un à travers l'autre.`,
    priceMissing: "Le multiple P/FCF n'est pas calculable sur l'une des deux valeurs, faute de free cash flow exploitable. La comparaison de prix est donc incomplète, et seule la qualité est comparable ici.",
    verdictH2: 'Comment trancher',
    verdictBody: (an, bn) => `Il n'y a pas de « meilleure action » dans l'absolu, il y a une meilleure action pour un objectif donné. Si tu cherches la qualité financière la plus solide, suis la note. Si tu cherches à payer le moins cher le cash produit, suis le P/FCF. Si les deux pointent vers la même valeur, le cas est simple. Si elles divergent, tu es en train d'arbitrer entre payer plus pour un meilleur business et payer moins pour un business plus discutable. Les deux fiches détaillées ci-dessous donnent le détail critère par critère pour ${an} et pour ${bn}.`,
    goFurtherH2: 'Aller plus loin',
    seeA: (n, t) => `L'analyse complète ${deFr(n)} (${t})`,
    interactive: 'Comparer ces deux actions dans le comparateur interactif',
    na: 'non disponible',
    faqH2: 'Questions fréquentes',
    faqBetterQ: (an, bn) => `Faut-il acheter ${an} ou ${bn} ?`,
    faqCheaperQ: (an, bn) => `${an} ou ${bn} : laquelle est la moins chère ?`,
    faqBothQ: 'Peut-on détenir les deux ?',
    faqBothA: "Rien ne l'interdit, et c'est fréquent quand les deux valident nos critères de qualité. Garde en tête que deux sociétés du même secteur réagissent souvent aux mêmes chocs, donc les détenir toutes les deux diversifie moins qu'il n'y paraît. Cette page est une comparaison chiffrée, pas une recommandation.",
    breadcrumbCompare: 'Comparer',
    vsWord: 'contre',
  },
  en: {
    title: (an, at, bn, bt) => `${an} (${at}) vs ${bn} (${bt}): which stock is better? Quality scores, P/FCF valuation and verdict`,
    h1: (an, at, bn, bt) => `${an} (${at}) vs ${bn} (${bt}): the numbers side by side`,
    intro: (an, bn, qw, pw) => `On our 10 quality criteria, ${qw} comes out ahead. On price, ${pw} trades cheapest relative to its free cash flow. In other words, comparing ${an} and ${bn} means answering two separate questions, and they do not necessarily have the same answer.`,
    introTie: (an, bn) => `${an} and ${bn} score the same on our 10 quality criteria. The tie-break therefore comes down to price, and to what you make of their prospects.`,
    tableH2: 'Both stocks side by side',
    thMetric: 'Metric', thScore: 'Quality score', thPfcf: 'P/FCF', thSector: 'Sector', thPrice: 'Price', thCap: 'Market cap',
    qualityH2: 'Quality: which one passes more criteria',
    qualityBody: (hn, hs, ln, ls) => `${hn} passes ${hs} of our quality criteria, against ${ls} for ${ln}. The criteria are identical for both: profitability, revenue and free cash flow per share growth, share count control, free cash flow margin, margin expansion, return on capital, debt, conversion of earnings into cash, and cash conversion cycle. No weighting, no opinion: it is a count.`,
    qualityEqual: (an, bn, sc) => `${an} and ${bn} pass the same number of criteria, ${sc}. Financial quality therefore does not separate them on our criteria.`,
    priceH2: 'Price: which one is cheaper',
    priceBody: (cn, cp, dn, dp) => `${cn} trades at ${cp} its free cash flow, against ${dp} for ${dn}. A lower multiple means you pay fewer years of cash for the same slice of the business. Mind the reflex though: a low multiple is only a bargain if the quality holds up. That is why we judge the two separately, and never one through the other.`,
    priceMissing: 'The P/FCF multiple cannot be computed for one of the two stocks, for lack of usable free cash flow. The price comparison is therefore incomplete, and only quality is comparable here.',
    verdictH2: 'How to decide',
    verdictBody: (an, bn) => `There is no "better stock" in the abstract, there is a better stock for a given goal. If you want the most solid financial quality, follow the score. If you want to pay the least for the cash produced, follow the P/FCF. If both point to the same name, the case is simple. If they diverge, you are trading off paying more for a better business against paying less for a more questionable one. The two detailed pages below give the criterion-by-criterion breakdown for ${an} and for ${bn}.`,
    goFurtherH2: 'Go further',
    seeA: (n, t) => `The full analysis of ${n} (${t})`,
    interactive: 'Compare these two stocks in the interactive comparator',
    na: 'not available',
    faqH2: 'Frequently asked questions',
    faqBetterQ: (an, bn) => `Should you buy ${an} or ${bn}?`,
    faqCheaperQ: (an, bn) => `${an} or ${bn}: which one is cheaper?`,
    faqBothQ: 'Can you hold both?',
    faqBothA: 'Nothing prevents it, and it is common when both pass our quality criteria. Keep in mind that two companies in the same sector often react to the same shocks, so holding both diversifies less than it looks. This page is a numbers comparison, not a recommendation.',
    breadcrumbCompare: 'Compare',
    vsWord: 'against',
  },
  es: {
    title: (an, at, bn, bt) => `${an} (${at}) vs ${bn} (${bt}): ¿qué acción es mejor? Notas de calidad, valoración P/FCF y veredicto`,
    h1: (an, at, bn, bt) => `${an} (${at}) vs ${bn} (${bt}): la comparación en cifras`,
    intro: (an, bn, qw, pw) => `En nuestros 10 criterios de calidad, gana ${qw}. En precio, ${pw} cotiza más barata respecto a su free cash flow. Es decir, comparar ${an} y ${bn} exige responder a dos preguntas separadas, y no tienen necesariamente la misma respuesta.`,
    introTie: (an, bn) => `${an} y ${bn} obtienen la misma nota en nuestros 10 criterios de calidad. El desempate se juega entonces en el precio, y en lo que pienses de sus perspectivas.`,
    tableH2: 'Las dos acciones lado a lado',
    thMetric: 'Criterio', thScore: 'Nota de calidad', thPfcf: 'P/FCF', thSector: 'Sector', thPrice: 'Precio', thCap: 'Capitalización',
    qualityH2: 'La calidad: cuál valida más criterios',
    qualityBody: (hn, hs, ln, ls) => `${hn} valida ${hs} de nuestros criterios de calidad, frente a ${ls} de ${ln}. Los criterios son idénticos para ambas: rentabilidad, crecimiento de los ingresos y del free cash flow por acción, control del número de acciones, margen de free cash flow, expansión de márgenes, rentabilidad del capital, deuda, conversión del beneficio en cash y ciclo de tesorería. Sin ponderación y sin opinión: es un recuento.`,
    qualityEqual: (an, bn, sc) => `${an} y ${bn} validan el mismo número de criterios, ${sc}. La calidad financiera no permite por tanto separarlas con nuestros criterios.`,
    priceH2: 'El precio: cuál cotiza más barata',
    priceBody: (cn, cp, dn, dp) => `${cn} cotiza a ${cp} su free cash flow, frente a ${dp} de ${dn}. Un múltiplo más bajo significa que pagas menos años de cash por la misma parte del negocio. Cuidado con el reflejo: un múltiplo bajo solo es una oportunidad si la calidad se sostiene. Por eso juzgamos ambas cosas por separado, y nunca una a través de la otra.`,
    priceMissing: 'El múltiplo P/FCF no se puede calcular en una de las dos acciones, por falta de free cash flow utilizable. La comparación de precio queda incompleta y aquí solo la calidad es comparable.',
    verdictH2: 'Cómo decidir',
    verdictBody: (an, bn) => `No hay una «mejor acción» en abstracto, hay una mejor acción para un objetivo dado. Si buscas la calidad financiera más sólida, sigue la nota. Si buscas pagar lo menos posible por el cash generado, sigue el P/FCF. Si ambas señalan el mismo nombre, el caso es simple. Si divergen, estás eligiendo entre pagar más por un mejor negocio y pagar menos por uno más discutible. Las dos fichas detalladas de abajo dan el desglose criterio por criterio de ${an} y de ${bn}.`,
    goFurtherH2: 'Saber más',
    seeA: (n, t) => `El análisis completo de ${n} (${t})`,
    interactive: 'Comparar estas dos acciones en el comparador interactivo',
    na: 'no disponible',
    faqH2: 'Preguntas frecuentes',
    faqBetterQ: (an, bn) => `¿Comprar ${an} o ${bn}?`,
    faqCheaperQ: (an, bn) => `${an} o ${bn}: ¿cuál es más barata?`,
    faqBothQ: '¿Se pueden tener las dos?',
    faqBothA: 'Nada lo impide, y es frecuente cuando ambas validan nuestros criterios de calidad. Ten en cuenta que dos empresas del mismo sector reaccionan a menudo a los mismos golpes, así que tenerlas ambas diversifica menos de lo que parece. Esta página es una comparación en cifras, no una recomendación.',
    breadcrumbCompare: 'Comparar',
    vsWord: 'frente a',
  },
};

type CompareRow = {
  ticker: string; name: string | null; sector: string | null;
  scoreChiffres: number | null; scoreChiffresMax: number | null;
  pfcfTTM: number | null; currency: string | null; price: number | null;
  marketCap: number | null; region: string; lastScoredAt: Date | null;
};

/** Capitalisation lisible (2 chiffres significatifs suffisent pour une comparaison). */
function formatCap(v: number | null, lang: ArticleLang): string | null {
  if (v == null || !isFinite(v) || v <= 0) return null;
  // En francais on reste en milliards meme au-dela de 1000 (« 5000 Md » et pas « 5 T »),
  // c'est la convention de place ; en EN/ES on bascule sur T/B/M.
  if (lang === 'fr') {
    // Séparateur de milliers français : « 5 003 Md » et non « 5003 Md ».
    if (v >= 1e12) return `${Math.round(v / 1e9).toLocaleString('fr-FR')} Md`;
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)} Md`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)} M`;
    return String(Math.round(v));
  }
  const units: Array<[number, string]> = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M']];
  for (const [div, suffix] of units) {
    if (v >= div) return `${(v / div).toFixed(1)}${suffix}`;
  }
  return String(Math.round(v));
}

function renderCompareHtml(a: CompareRow, b: CompareRow, lang: ArticleLang): string {
  const tr = COMPARE_TR[lang];
  const lq = lang === 'fr' ? '' : `?lng=${lang}`;
  const aName = stripLegalSuffix(a.name || a.ticker);
  const bName = stripLegalSuffix(b.name || b.ticker);
  const aNameEsc = escapeHtml(aName);
  const bNameEsc = escapeHtml(bName);
  const aT = escapeHtml(a.ticker);
  const bT = escapeHtml(b.ticker);

  const aScore = formatScore(a.scoreChiffres, a.scoreChiffresMax);
  const bScore = formatScore(b.scoreChiffres, b.scoreChiffresMax);
  const aRatio = a.scoreChiffres != null && a.scoreChiffresMax ? a.scoreChiffres / a.scoreChiffresMax : null;
  const bRatio = b.scoreChiffres != null && b.scoreChiffresMax ? b.scoreChiffres / b.scoreChiffresMax : null;

  const aPfcfOk = a.pfcfTTM != null && isFinite(a.pfcfTTM) && a.pfcfTTM > 0;
  const bPfcfOk = b.pfcfTTM != null && isFinite(b.pfcfTTM) && b.pfcfTTM > 0;
  const aPfcf = aPfcfOk ? `${(a.pfcfTTM as number).toFixed(1)}×` : tr.na;
  const bPfcf = bPfcfOk ? `${(b.pfcfTTM as number).toFixed(1)}×` : tr.na;

  // Gagnants, STRICTEMENT dérivés de la donnée (parité éditoriale : rien d'arbitraire).
  const qualityTie = aRatio != null && bRatio != null && aRatio === bRatio;
  const qualityWinner = aRatio == null || bRatio == null ? null : (aRatio > bRatio ? 'a' : 'b');
  const priceWinner = !aPfcfOk || !bPfcfOk ? null : ((a.pfcfTTM as number) < (b.pfcfTTM as number) ? 'a' : 'b');

  const introHtml = qualityTie || qualityWinner == null || priceWinner == null
    ? (qualityTie ? tr.introTie(aNameEsc, bNameEsc) : tr.intro(aNameEsc, bNameEsc, qualityWinner === 'b' ? bNameEsc : aNameEsc, priceWinner === 'b' ? bNameEsc : aNameEsc))
    : tr.intro(aNameEsc, bNameEsc, qualityWinner === 'a' ? aNameEsc : bNameEsc, priceWinner === 'a' ? aNameEsc : bNameEsc);

  const qualityHtml = qualityTie
    ? tr.qualityEqual(aNameEsc, bNameEsc, aScore)
    : qualityWinner == null
    ? tr.qualityEqual(aNameEsc, bNameEsc, `${aScore} / ${bScore}`)
    : qualityWinner === 'a'
    ? tr.qualityBody(aNameEsc, aScore, bNameEsc, bScore)
    : tr.qualityBody(bNameEsc, bScore, aNameEsc, aScore);

  const priceHtml = priceWinner == null
    ? tr.priceMissing
    : priceWinner === 'a'
    ? tr.priceBody(aNameEsc, aPfcf, bNameEsc, bPfcf)
    : tr.priceBody(bNameEsc, bPfcf, aNameEsc, aPfcf);

  const fmtPrice = (r: CompareRow) =>
    r.price != null && isFinite(r.price) ? `${r.price.toFixed(2)} ${escapeHtml(r.currency || 'USD')}` : tr.na;
  const aCap = formatCap(a.marketCap, lang) ?? tr.na;
  const bCap = formatCap(b.marketCap, lang) ?? tr.na;

  const slug = comparePairSlug(a.ticker, b.ticker);
  const baseCanonical = `${SITE_URL}/comparer/${slug}`;
  const canonical = lang === 'fr' ? baseCanonical : `${baseCanonical}?lng=${lang}`;
  const hreflang = (['fr', 'en', 'es'] as const)
    .map((l) => `<link rel="alternate" hreflang="${l}" href="${l === 'fr' ? baseCanonical : `${baseCanonical}?lng=${l}`}">`)
    .join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${baseCanonical}">`;

  const rawTitle = tr.title(aName, a.ticker, bName, b.ticker);
  const title = escapeHtml(rawTitle);

  // Liens sortants par section vers les comptes officiels (US) + la littérature.
  const filings = [a, b]
    .filter((r) => r.region === 'US')
    .map((r) => `<p>${tr === COMPARE_TR.fr
      ? `Les comptes ${deFr(escapeHtml(stripLegalSuffix(r.name || r.ticker)))} sont publics : <a href="${edgarFilingsUrl(r.ticker)}" target="_blank" rel="noopener nofollow">dépôts 10-K auprès de la SEC (EDGAR)</a>.`
      : tr === COMPARE_TR.es
      ? `Las cuentas de ${escapeHtml(stripLegalSuffix(r.name || r.ticker))} son públicas: <a href="${edgarFilingsUrl(r.ticker)}" target="_blank" rel="noopener nofollow">informes 10-K ante la SEC (EDGAR)</a>.`
      : `${escapeHtml(stripLegalSuffix(r.name || r.ticker))}'s accounts are public: <a href="${edgarFilingsUrl(r.ticker)}" target="_blank" rel="noopener nofollow">10-K filings with the SEC (EDGAR)</a>.`
    }</p>`).join('\n');

  const scoredAt = (a.lastScoredAt && b.lastScoredAt)
    ? (a.lastScoredAt > b.lastScoredAt ? a.lastScoredAt : b.lastScoredAt)
    : (a.lastScoredAt ?? b.lastScoredAt ?? new Date());
  const isoDate = scoredAt.toISOString();

  const faq = [
    { q: tr.faqBetterQ(aName, bName), a: `${stripTags(qualityHtml)} ${stripTags(priceHtml)}` },
    { q: tr.faqCheaperQ(aName, bName), a: priceWinner == null ? stripTags(tr.priceMissing) : `${priceWinner === 'a' ? aName : bName} : ${priceWinner === 'a' ? aPfcf : bPfcf} ${tr.vsWord} ${priceWinner === 'a' ? bPfcf : aPfcf}.` },
    { q: tr.faqBothQ, a: tr.faqBothA },
  ];

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="robots" content="index,follow">
<link rel="canonical" href="${canonical}">
${hreflang}
<link rel="icon" type="image/svg+xml" href="${SITE_URL}/favicon.svg">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Lubin Investment">
<meta property="og:image" content="${SITE_URL}/og-default.png">
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'AnalysisNewsArticle',
  headline: rawTitle,
  url: canonical,
  inLanguage: TICKER_TR[lang].inLanguage,
  datePublished: isoDate,
  dateModified: isoDate,
  author: { '@type': 'Person', name: AUTHOR_NAME, jobTitle: AUTHOR_JOBTITLE[lang], url: `${SITE_URL}/methodologie${lq}` },
  publisher: { '@type': 'Organization', name: 'Lubin Investment', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
  mainEntityOfPage: canonical,
}, null, 2)}
</script>
</head>
<body>
<header>
  <p><span data-nosnippet><a href="${SITE_URL}/${lq}">Lubin Investment</a> · <a href="${SITE_URL}/screener${lq}">Screener</a> · <a href="${SITE_URL}/methodologie${lq}">${escapeHtml(STATIC_TR[lang].nav)}</a></span></p>
</header>
<main>
<nav aria-label="${escapeHtml(tr.breadcrumbCompare)}"><span data-nosnippet><a href="${SITE_URL}/${lq}">${escapeHtml(STATIC_TR[lang].home)}</a> › <a href="${SITE_URL}/compare${lq}">${escapeHtml(tr.breadcrumbCompare)}</a> › ${aT} vs ${bT}</span></nav>

<h1>${escapeHtml(tr.h1(aName, a.ticker, bName, b.ticker))}</h1>
<p><small>${escapeHtml(AUTHOR_BYLINE[lang])}</small></p>

<p><strong>${introHtml}</strong></p>

<h2>${escapeHtml(tr.tableH2)}</h2>
<table style="border-collapse:collapse;width:100%">
<thead><tr><th>${escapeHtml(tr.thMetric)}</th><th>${aNameEsc} (${aT})</th><th>${bNameEsc} (${bT})</th></tr></thead>
<tbody>
<tr><td>${escapeHtml(tr.thScore)}</td><td>${aScore}</td><td>${bScore}</td></tr>
<tr><td>${escapeHtml(tr.thPfcf)}</td><td>${escapeHtml(aPfcf)}</td><td>${escapeHtml(bPfcf)}</td></tr>
<tr><td>${escapeHtml(tr.thSector)}</td><td>${a.sector ? escapeHtml(displaySector(a.sector, lang)) : escapeHtml(tr.na)}</td><td>${b.sector ? escapeHtml(displaySector(b.sector, lang)) : escapeHtml(tr.na)}</td></tr>
<tr><td>${escapeHtml(tr.thPrice)}</td><td>${fmtPrice(a)}</td><td>${fmtPrice(b)}</td></tr>
<tr><td>${escapeHtml(tr.thCap)}</td><td>${escapeHtml(aCap)}</td><td>${escapeHtml(bCap)}</td></tr>
</tbody>
</table>

<h2>${escapeHtml(tr.qualityH2)}</h2>
<p>${qualityHtml}</p>

<h2>${escapeHtml(tr.priceH2)}</h2>
<p>${priceHtml}</p>
${filings}

<h2>${escapeHtml(tr.verdictH2)}</h2>
<p>${tr.verdictBody(aNameEsc, bNameEsc)}</p>

<h2>${escapeHtml(tr.faqH2)}</h2>
${faq.map((f) => `<h3>${escapeHtml(f.q)}</h3>\n<p>${escapeHtml(f.a)}</p>`).join('\n')}

<h2>${escapeHtml(tr.goFurtherH2)}</h2>
<ul>
<li><a href="${SITE_URL}/analyse/${aT}${lq}">${escapeHtml(tr.seeA(aName, a.ticker))}</a></li>
<li><a href="${SITE_URL}/analyse/${bT}${lq}">${escapeHtml(tr.seeA(bName, b.ticker))}</a></li>
<li><a href="${SITE_URL}/compare?tickers=${aT},${bT}${lang === 'fr' ? '' : `&lng=${lang}`}">${escapeHtml(tr.interactive)}</a></li>
</ul>
</main>
<footer><p><small><span data-nosnippet>${TICKER_TR[lang].disclaimer}</span></small></p></footer>
</body>
</html>`;
}

/** Retire les balises HTML d'un fragment (les réponses de FAQ doivent être du texte pur). */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

// GET /comparer/:pair — servi UNIQUEMENT aux bots (rewrite Vercel conditionnel).
// Les humains sont redirigés par la SPA vers /compare?tickers=A,B (comparateur interactif).
seoPrerenderRouter.get('/comparer/:pair', async (req: Request, res: Response) => {
  const raw = typeof req.params.pair === 'string' ? req.params.pair : '';
  const parsed = parseComparePair(raw.slice(0, 40));
  if (!parsed) {
    res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(render404(raw || '?'));
    return;
  }
  const [aT, bT] = parsed;
  // ⚠️ Seules les paires CURÉES sont servies. Sans cette garde, /comparer/X-vs-Y ouvrirait
  // des millions d'URLs générables à la demande : c'est précisément le motif de pages
  // satellites que Google sanctionne, et ça donnerait un puits de crawl infini.
  const isCurated = COMPARE_PAIRS.some(([x, y]) => (x === aT && y === bT) || (x === bT && y === aT));
  if (!isCurated) {
    res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(render404(`${aT} vs ${bT}`));
    return;
  }
  try {
    const rows = await prisma.screenerTicker.findMany({
      where: { ticker: { in: [aT, bT] }, status: 'scored' },
      select: {
        ticker: true, name: true, sector: true, scoreChiffres: true, scoreChiffresMax: true,
        pfcfTTM: true, currency: true, price: true, marketCap: true, region: true, lastScoredAt: true,
      },
    });
    const a = rows.find((r) => r.ticker === aT);
    const b = rows.find((r) => r.ticker === bT);
    // Si l'une des deux n'est pas encore notée, la comparaison n'a pas de contenu : vrai 404
    // plutôt qu'une page à moitié vide (qui serait du thin content).
    if (!a || !b) {
      res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(render404(`${aT} vs ${bT}`));
      return;
    }
    const lang = toArticleLang(typeof req.query.lng === 'string' ? req.query.lng : 'fr');
    res
      .status(200)
      .set('Content-Type', 'text/html; charset=utf-8')
      .set('Cache-Control', 'public, max-age=3600, s-maxage=3600')
      .send(renderCompareHtml(a, b, lang));
  } catch (err) {
    console.error('[seoPrerender comparer]', raw, (err as Error).message);
    res.status(503).set('Content-Type', 'text/html; charset=utf-8').send(render404(`${aT} vs ${bT}`));
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
  fr: "Écrit par Lubin Danilo, fondateur de Lubin Investment. Investisseur particulier autodidacte, l'analyse fondamentale me passionne et m'a donné d'excellents résultats. Cela fait désormais trois années que ma performance bat le S&P 500. Mais analyser chaque action me prenait trop de temps : des sites aux données incomplètes, des méthodes de calcul et des critères jamais alignés sur les miens. Et repérer les meilleures actions était tout aussi chronophage, même avec ma liste de critères bien définie. J'ai donc mis mon expérience en développement à profit pour créer ce logiciel, bâtir ma stratégie d'investissement sur les résultats de celui-ci et en faire profiter les gens partageant la même passion que moi. Il juge séparément la qualité d'un business et son prix, à partir de critères inspirés de la littérature financière (Warren Buffett, Michael Mauboussin, Aswath Damodaran).",
  en: "Written by Lubin Danilo, founder of Lubin Investment. A self-taught individual investor, I find fundamental analysis fascinating, and it has delivered excellent results. For three years now, my performance has beaten the S&P 500. But analyzing every stock took too much time: sites with incomplete data, calculation methods and criteria never aligned with mine. And spotting the best stocks was just as time-consuming, even with my own well-defined checklist. So I put my software development background to work to build this software, base my investment strategy on its results, and share it with people who share the same passion as me. It judges a company's quality and its price separately, using criteria drawn from the financial literature (Warren Buffett, Michael Mauboussin, Aswath Damodaran).",
  es: "Escrito por Lubin Danilo, fundador de Lubin Investment. Inversor particular autodidacta, el análisis fundamental me apasiona y me ha dado resultados excelentes. Desde hace ya tres años, mi rentabilidad supera al S&P 500. Pero analizar cada acción me llevaba demasiado tiempo: sitios con datos incompletos, métodos de cálculo y criterios nunca alineados con los míos. Y detectar las mejores acciones era igual de laborioso, incluso con mi lista de criterios bien definida. Por eso aproveché mi experiencia en desarrollo para crear este software, basar mi estrategia de inversión en los resultados de este y compartirlo con quienes comparten la misma pasión que yo. Juzga por separado la calidad de un negocio y su precio, con criterios inspirados en la literatura financiera (Warren Buffett, Michael Mauboussin, Aswath Damodaran).",
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

  // Maillage interne VISIBLE PAR LES BOTS (2026-07-28) : le SPA a une section « À lire aussi »,
  // mais elle n'était PAS dans le HTML pré-rendu servi aux crawlers → aucun lien inter-articles
  // pour Google. On rend ici 3 articles liés (score = ticker commun + tags partagés) en <a> réels,
  // avec la langue propagée (?lng=). Bidirectionnel automatiquement (un nouvel article devient lié
  // depuis les anciens dès sa publication).
  const refTagsRel = new Set((c.tags || []).map((t) => t.toLowerCase()));
  const lqRel = lang === 'fr' ? '' : `?lng=${lang}`;
  const relatedList = listArticles()
    .filter((a) => a.slug !== article.slug)
    .map((a) => {
      const rc = a.content[lang] || a.content.fr;
      const shared = (rc.tags || []).filter((t) => refTagsRel.has(t.toLowerCase())).length;
      const sameTicker = a.ticker && article.ticker && a.ticker.toUpperCase() === article.ticker.toUpperCase() ? 3 : 0;
      return { a, rc, score: sameTicker + shared };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => (y.score - x.score) || (x.a.date < y.a.date ? 1 : -1))
    .slice(0, 3);
  const relatedHeading = lang === 'en' ? 'Related reading' : lang === 'es' ? 'Lecturas relacionadas' : 'À lire aussi';
  const relatedHtml = relatedList.length > 0
    ? `<h2>${relatedHeading}</h2>\n<ul>\n${relatedList.map(({ a, rc }) => `<li><a href="${SITE_URL}/blog/${encodeURIComponent(a.slug)}${lqRel}">${escapeHtml(rc.title)}</a></li>`).join('\n')}\n</ul>`
    : '';

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
      sameAs: SAME_AS,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Lubin Investment',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` },
      sameAs: SAME_AS,
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
  // CTA identique en tête (sous le titre) et en fin d'article ; nom de société propre si connu.
  const ctaName = companyDisplayName(article.ticker);
  const ctaLabel = article.ticker
    ? (lang === 'en' ? `${ctaName}: see the full analysis on Lubin Investment`
      : lang === 'es' ? `${ctaName}: ver el análisis completo en Lubin Investment`
      : `${ctaName} : voir l'analyse complète sur Lubin Investment`)
    : (lang === 'en' ? 'Analyze a stock on Lubin Investment'
      : lang === 'es' ? 'Analizar una acción en Lubin Investment'
      : 'Analyser une action sur Lubin Investment');
  const ctaHtml = `<p><a href="${ctaHref}"><strong>${escapeHtml(ctaLabel)}</strong></a></p>`;

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
<meta name="twitter:site" content="@${X_HANDLE}">
<meta name="twitter:creator" content="@${X_HANDLE}">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${SITE_URL}/og-default.png">
<script type="application/ld+json">${JSON.stringify(articleLd, null, 2)}</script>
<script type="application/ld+json">${JSON.stringify(faqLd, null, 2)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd, null, 2)}</script>
</head>
<body>
<header>
  <p><span data-nosnippet><a href="${SITE_URL}/">Lubin Investment</a> · <a href="${SITE_URL}/blog">Blog</a></span></p>
</header>
<main>
<nav aria-label="Fil d'Ariane"><span data-nosnippet><a href="${SITE_URL}/">Accueil</a> › <a href="${SITE_URL}/blog">Blog</a></span></nav>
<h1>${escapeHtml(c.title)}</h1>
<p><small>${escapeHtml(article.date)} · <span rel="author">${escapeHtml(AUTHOR_BYLINE[lang])}</span></small></p>
${ctaHtml}
<p><strong>${renderInline(c.answer)}</strong></p>
${bodyHtml}
<h2>FAQ</h2>
${faqHtml}
${relatedHtml}
${ctaHtml}
<h2>${lang === 'en' ? 'About the author' : lang === 'es' ? 'Sobre el autor' : "À propos de l'auteur"}</h2>
<p>${escapeHtml(AUTHOR_BIO[lang])}</p>
<footer><p><small><span data-nosnippet>${escapeHtml(c.disclaimer)}</span></small></p></footer>
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
/**
 * Noms de secteurs en FRANÇAIS (Q9 du plan SEO, version sans migration d'URL).
 *
 * Les secteurs viennent du fournisseur de données en anglais (« Software - Infrastructure »).
 * Sur un site francophone, c'est du vocabulaire interne importé : le corpus mesure +567 %
 * d'événements clés et +64 % de chiffre d'affaires en passant du vocabulaire interne au
 * vocabulaire client, et 841 % de hausse des ventes en remplaçant des catégories produit par
 * des catégories d'intention.
 *
 * ⚠️ Ce qui est traduit ici, c'est L'AFFICHAGE : titre, H1, intro, ancres de liens et fil
 * d'Ariane. Les SLUGS restent en anglais, donc AUCUNE URL ne change et aucune redirection
 * n'est nécessaire. La traduction des 181 slugs est délibérément écartée : son coût réel n'est
 * pas le code mais 181 décisions de mots-clés, et le corpus est explicite sur ce point,
 * « ne payez pas cher la traduction, payez l'étude des requêtes locales ». Inventer 181 termes
 * français sans vérifier ce que les investisseurs tapent réellement produirait 181 mauvais
 * mots-clés maquillés en optimisation. Le même effort rend beaucoup plus dans les collections
 * d'intention (§6.1 du plan), qui sont nativement françaises.
 *
 * Couverture : les 30 secteurs les plus peuplés, soit environ 54 % des fiches. Les 151 autres
 * gardent leur libellé anglais jusqu'à traduction vérifiée. Une entrée absente n'est pas un
 * bug, c'est l'état d'avancement.
 *
 * L'anglais reste servi tel quel sur les pages `?lng=en` (c'est sa langue d'origine).
 * L'espagnol retombe sur l'anglais, comme aujourd'hui : à traiter dans un second temps.
 */
const SECTOR_FR: Record<string, string> = {
  'Biotechnology': 'Biotechnologies',
  'Banks - Regional': 'Banques régionales',
  'Shell Companies': 'Sociétés coquilles',
  'Software - Application': 'Logiciels applicatifs',
  'Software - Infrastructure': "Logiciels d'infrastructure",
  'Asset Management': "Gestion d'actifs",
  'Medical Devices': 'Dispositifs médicaux',
  'Aerospace & Defense': 'Aéronautique et défense',
  'Specialty Industrial Machinery': 'Machines industrielles spécialisées',
  'Drug Manufacturers - Specialty & Generic': 'Médicaments génériques et de spécialité',
  'Information Technology Services': 'Services informatiques',
  'Telecom Services': 'Télécommunications',
  'Packaged Foods': 'Agroalimentaire',
  'Capital Markets': 'Marchés de capitaux',
  'Engineering & Construction': 'Ingénierie et construction',
  'Semiconductors': 'Semi-conducteurs',
  'Specialty Chemicals': 'Chimie de spécialité',
  'Oil & Gas E&P': 'Exploration et production pétrolière',
  'Internet Content & Information': 'Contenus et services en ligne',
  'Medical Instruments & Supplies': 'Instruments et fournitures médicales',
  'Auto Parts': 'Équipementiers automobiles',
  'Other Industrial Metals & Mining': 'Métaux industriels et mines',
  'Electrical Equipment & Parts': 'Équipements électriques',
  'Restaurants': 'Restauration',
  'Insurance - Property & Casualty': 'Assurance dommages',
  'Specialty Retail': 'Distribution spécialisée',
  'Electronic Components': 'Composants électroniques',
  'Real Estate Services': 'Services immobiliers',
  'Oil & Gas Equipment & Services': 'Services pétroliers',
  'Gold': 'Or',
};

/** Affichage propre du nom de secteur (sans tiret, préférence Lubin), traduit en français
 *  quand la traduction est vérifiée. La valeur brute reste la clé du slug : cf. SECTOR_FR. */
function displaySector(s: string, lang: ArticleLang = 'en'): string {
  if (lang === 'fr') {
    const fr = SECTOR_FR[s.trim()];
    if (fr) return fr;
  }
  return s.replace(/\s*-\s*/g, ' ').trim();
}

type HubRow = {
  ticker: string; name: string | null;
  scoreChiffres: number | null; scoreChiffresMax: number | null; pfcfTTM: number | null;
};

// ─── Maillage pied de page (Q4 du plan SEO) ──────────────────────────────────
// Deux raisons mesurées, distinctes.
//   1. Indexation : une page liée depuis une page souvent explorée est indexée en quelques
//      heures, et corriger des pages orphelines a produit 6 fois plus d'impressions en 24 h.
//      /compare, /palmares, /faq et /pricing n'étaient liés depuis AUCUNE page pré-rendue
//      autre que quelques fiches.
//   2. Google signale comme motif de pages satellites des pages volontairement absentes de
//      la navigation. On ne veut pas de page publique atteignable seulement par le sitemap.
//
// ⚠️ RÈGLE DU PREMIER LIEN : Google ne compte que le PREMIER lien d'une page vers une URL
// donnée. Répéter dans le pied de page une cible déjà présente dans le header ou le corps
// ne transmet RIEN, ça ne fait que gonfler le nombre de liens (le corpus recommande environ
// 5 liens utiles dans le corps, pas 50). Chaque appelant passe donc la liste de ce qu'il
// relie déjà, et seul le complément est émis.
const FOOTER_NAV: Record<ArticleLang, ReadonlyArray<readonly [string, string]>> = {
  fr: [
    ['/screener', "Screener d'actions"],
    ['/classement/qualite-10-sur-10', 'Actions de la meilleure qualité'],
    ['/classement/sous-evaluees', 'Actions de qualité sous-évaluées'],
    ['/compare', 'Comparer deux actions'],
    ['/palmares', 'Palmarès des opportunités repérées'],
    ['/methodologie', 'Méthodologie de notation'],
    ['/blog', 'Blog : analyses et méthode'],
    ['/faq', 'Questions fréquentes'],
    ['/pricing', 'Tarifs'],
  ],
  en: [
    ['/screener', 'Stock screener'],
    ['/classement/qualite-10-sur-10', 'Highest quality stocks'],
    ['/classement/sous-evaluees', 'Undervalued quality stocks'],
    ['/compare', 'Compare two stocks'],
    ['/palmares', 'Track record of spotted opportunities'],
    ['/methodologie', 'Scoring methodology'],
    ['/blog', 'Blog: analysis and method'],
    ['/faq', 'Frequently asked questions'],
    ['/pricing', 'Pricing'],
  ],
  es: [
    ['/screener', 'Screener de acciones'],
    ['/classement/qualite-10-sur-10', 'Acciones de mayor calidad'],
    ['/classement/sous-evaluees', 'Acciones de calidad infravaloradas'],
    ['/compare', 'Comparar dos acciones'],
    ['/palmares', 'Historial de oportunidades detectadas'],
    ['/methodologie', 'Metodología de puntuación'],
    ['/blog', 'Blog: análisis y método'],
    ['/faq', 'Preguntas frecuentes'],
    ['/pricing', 'Precios'],
  ],
};

const FOOTER_NAV_H2: Record<ArticleLang, string> = {
  fr: 'Explorer le site', en: 'Explore the site', es: 'Explorar el sitio',
};

/** Liens de pied de page, moins ceux que la page relie déjà (règle du premier lien).
 *  `alreadyLinked` prend des chemins nus, sans suffixe de langue. */
function renderFooterNav(lang: ArticleLang, lq: string, alreadyLinked: ReadonlyArray<string>): string {
  const skip = new Set(alreadyLinked);
  const items = FOOTER_NAV[lang].filter(([href]) => !skip.has(href));
  if (items.length === 0) return '';
  const links = items
    .map(([href, label]) => `<li><a href="${SITE_URL}${href}${lq}">${escapeHtml(label)}</a></li>`)
    .join('\n');
  return `<nav aria-label="${escapeHtml(FOOTER_NAV_H2[lang])}">\n<ul>\n${links}\n</ul>\n</nav>`;
}

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

/**
 * Plancher de plausibilité du multiple de valorisation, pour ce qui est PROMU en résumé.
 *
 * Sous 3, une société générerait chaque année l'équivalent d'un tiers ou plus de sa
 * capitalisation en free cash flow. Sur le catalogue actuel, ces valeurs sont des bugs de
 * devise ou d'unité, pas des aubaines : PayPay ressort à 0,1 et Afya à 1,1, tous deux cotés
 * hors zone dollar, exactement le motif de SPEC-004 (capitalisations londoniennes en pence).
 *
 * On refuse de mettre un chiffre invraisemblable en tête de page sur un site qui parle
 * d'argent : le corpus mesure que la confiance éditoriale est LA variable de survie en YMYL.
 * La ligne reste dans le tableau, elle n'est simplement pas promue au rang de « meilleure
 * affaire du groupe ». Le vrai correctif est en amont, dans le pipeline de devises.
 */
const PFCF_PLAUSIBILITY_FLOOR = 3;

/** Nombre à une décimale, avec le séparateur de la langue (« 20,1 » en fr et es, « 20.1 » en
 *  en). Les chiffres du résumé sont dans une PHRASE, pas dans un tableau : un point décimal
 *  dans du texte français est une faute qui se voit. */
function formatDecimal(v: number, lang: ArticleLang): string {
  const s = v.toFixed(1);
  return lang === 'en' ? s : s.replace('.', ',');
}

/** Résumé et lien sortant des hubs (Q8 du plan SEO), par langue. */
const HUB_EXTRA_TR: Record<ArticleLang, {
  summaryCount: (total: number, perfect: number) => string;
  summaryMedian: (median: string) => string;
  summaryCheapest: (name: string, ticker: string, pfcf: string) => string;
  sourceSector: string;
  sourceRanking: string;
}> = {
  fr: {
    summaryCount: (total, perfect) => perfect === 0
      ? `Sur les ${total} actions listées ici, aucune n'obtient pour l'instant la note de qualité maximale.`
      : perfect === 1
      ? `Sur les ${total} actions listées ici, une seule obtient la note de qualité maximale.`
      : `Sur les ${total} actions listées ici, ${perfect} obtiennent la note de qualité maximale.`,
    summaryMedian: (m) => `La valorisation médiane du groupe ressort à ${m} fois son free cash flow.`,
    summaryCheapest: (n, tk, p) => `Parmi celles qui ont la note maximale, la moins chère est <a href="${SITE_URL}/analyse/${tk}">${n} (${tk})</a>, à ${p} fois son free cash flow.`,
    sourceSector: `Pour situer ces multiples face aux moyennes du secteur, les données sectorielles publiques de référence sont celles d'<a href="https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html" target="_blank" rel="noopener nofollow">Aswath Damodaran (NYU Stern)</a>.`,
    sourceRanking: `Les notions employées ici (free cash flow, rendement du capital, endettement) sont expliquées dans les <a href="https://www.investor.gov/" target="_blank" rel="noopener nofollow">ressources pédagogiques de la SEC (investor.gov)</a>.`,
  },
  en: {
    summaryCount: (total, perfect) => perfect === 0
      ? `Of the ${total} stocks listed here, none currently reaches the maximum quality score.`
      : perfect === 1
      ? `Of the ${total} stocks listed here, only one reaches the maximum quality score.`
      : `Of the ${total} stocks listed here, ${perfect} reach the maximum quality score.`,
    summaryMedian: (m) => `The median valuation of the group comes out at ${m} times its free cash flow.`,
    summaryCheapest: (n, tk, p) => `Among those with the maximum score, the cheapest is <a href="${SITE_URL}/analyse/${tk}">${n} (${tk})</a>, at ${p} times its free cash flow.`,
    sourceSector: `To place these multiples against sector averages, the reference public sector data is <a href="https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html" target="_blank" rel="noopener nofollow">Aswath Damodaran's (NYU Stern)</a>.`,
    sourceRanking: `The notions used here (free cash flow, return on capital, debt) are explained in the <a href="https://www.investor.gov/" target="_blank" rel="noopener nofollow">SEC investor education resources (investor.gov)</a>.`,
  },
  es: {
    summaryCount: (total, perfect) => perfect === 0
      ? `De las ${total} acciones listadas aquí, ninguna alcanza por ahora la nota de calidad máxima.`
      : perfect === 1
      ? `De las ${total} acciones listadas aquí, solo una alcanza la nota de calidad máxima.`
      : `De las ${total} acciones listadas aquí, ${perfect} alcanzan la nota de calidad máxima.`,
    summaryMedian: (m) => `La valoración mediana del grupo se sitúa en ${m} veces su flujo de caja libre.`,
    summaryCheapest: (n, tk, p) => `Entre las que tienen la nota máxima, la más barata es <a href="${SITE_URL}/analyse/${tk}">${n} (${tk})</a>, a ${p} veces su flujo de caja libre.`,
    sourceSector: `Para situar estos múltiplos frente a las medias del sector, los datos sectoriales públicos de referencia son los de <a href="https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html" target="_blank" rel="noopener nofollow">Aswath Damodaran (NYU Stern)</a>.`,
    sourceRanking: `Las nociones utilizadas aquí (flujo de caja libre, rendimiento del capital, deuda) se explican en los <a href="https://www.investor.gov/" target="_blank" rel="noopener nofollow">recursos educativos de la SEC (investor.gov)</a>.`,
  },
};

/**
 * Résumé chiffré en tête de hub (Q8 du plan SEO), calculé depuis les lignes du hub, sans
 * requête supplémentaire.
 *
 * Deux effets distincts, tous deux mesurés.
 *   1. Un résumé de 2 à 3 phrases en tête de page mesure +33 % de conversion, six occurrences
 *      indépendantes dans le corpus. C'est le meilleur rapport effort sur résultat du livre,
 *      et la réponse doit tenir au-dessus de la ligne de flottaison.
 *   2. Il rend chaque hub RÉELLEMENT différent des 182 autres. Un gabarit dont seul le nom de
 *      secteur change est du mauvais côté de la ligne des 50 % de contenu unique, et l'ajout de
 *      données propres est la seule réponse documentée à une désindexation de contenu généré.
 */
function renderHubSummary(rows: HubRow[], lang: ArticleLang): string {
  if (rows.length === 0) return '';
  const t = HUB_EXTRA_TR[lang];
  const perfect = rows.filter((r) =>
    r.scoreChiffres != null && r.scoreChiffresMax != null && r.scoreChiffres >= r.scoreChiffresMax);
  const median = medianOf(rows.map((r) => r.pfcfTTM));
  const cheapestPerfect = perfect
    .filter((r) => r.pfcfTTM != null && isFinite(r.pfcfTTM) && r.pfcfTTM >= PFCF_PLAUSIBILITY_FLOOR)
    .sort((a, b) => (a.pfcfTTM as number) - (b.pfcfTTM as number))[0];

  const sentences = [t.summaryCount(rows.length, perfect.length)];
  if (median != null && median >= PFCF_PLAUSIBILITY_FLOOR) sentences.push(t.summaryMedian(formatDecimal(median, lang)));
  if (cheapestPerfect) {
    sentences.push(t.summaryCheapest(
      escapeHtml(stripLegalSuffix(cheapestPerfect.name || cheapestPerfect.ticker)),
      escapeHtml(cheapestPerfect.ticker),
      formatDecimal(cheapestPerfect.pfcfTTM as number, lang),
    ));
  }
  return `<p><strong>${sentences.join(' ')}</strong></p>`;
}

function renderHubHtml(o: { title: string; h1: string; intro: string; path: string; rows: HubRow[]; lang: ArticleLang; outbound?: 'sector' | 'ranking' }): string {
  const tr = HUB_T[o.lang];
  const base = `${SITE_URL}${o.path}`;
  const canonical = o.lang === 'fr' ? base : `${base}?lng=${o.lang}`;
  const title = escapeHtml(o.title);
  // ⚠️ Q6 du plan SEO : `description` n'alimente PLUS de <meta name="description">, seulement
  // Open Graph. Les descriptions générées par GABARIT sont mesurées comme MOINS BONNES que pas
  // de description du tout ; celles que Google écrit lui-même battent celles écrites à la main
  // de 3 %, et il ignore la description fournie 63 % du temps. Les 181 hubs secteur partageaient
  // la même phrase à un nom de secteur près : c'était exactement le cas mesuré. Les fiches
  // ticker appliquent déjà cette règle. Open Graph est un autre usage : les réseaux sociaux
  // reprennent le texte tel quel, donc là on le fournit.
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
${renderHubSummary(o.rows, o.lang)}
<p>${escapeHtml(o.intro)}</p>
<table>
<thead><tr><th>#</th><th>${tr.thAction}</th><th>${tr.thScore}</th><th>P/FCF</th></tr></thead>
<tbody>
${rowsHtml}
</tbody>
</table>
<p>${tr.methodo} <a href="${SITE_URL}/methodologie">${tr.methodoLink}</a>.</p>
<p>${o.outbound === 'sector' ? HUB_EXTRA_TR[o.lang].sourceSector : HUB_EXTRA_TR[o.lang].sourceRanking}</p>
<p><a href="${SITE_URL}/screener">${tr.explore}</a></p>
</main>
<footer>
${renderFooterNav(o.lang, o.lang === 'fr' ? '' : `?lng=${o.lang}`, ['/screener', '/methodologie', o.path])}
</footer>
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

// ─── Collections d'intention (§6.1 du plan SEO, première vague du 4 août 2026) ────────
//
// POURQUOI. Le diagnostic Search Console du 4 août est sans ambiguïté : sur 90 jours, 129 clics
// dont 51 sur l'accueil en recherche de marque. Les 5 500 autres URL ont produit environ 78
// clics. Le site répond très bien à « faut-il acheter <ticker> », que presque personne ne tape,
// et pas du tout à « meilleures actions <critère> », que tout le monde tape. Les hubs
// `/secteur/*` ne corrigent pas ça : ce sont des catégories PRODUIT, une taxonomie sectorielle
// anglophone importée du fournisseur de données.
//
// Ces pages-ci sont des catégories d'INTENTION, formulées comme un investisseur francophone
// nomme son besoin. Le corpus mesure l'écart : remplacer des catégories produit par des
// catégories d'intention a produit 841 % de hausse des ventes, et passer du vocabulaire interne
// au vocabulaire client 567 % d'événements clés en plus.
//
// TAILLE DU LOT. 15 pages d'un coup, et c'est délibéré : le seul motif programmatique validé par
// une expérience contrôlée du corpus est précisément un lot de 15 à 20 pages, classé en première
// page en trois semaines. La première version du plan disait « 2 par semaine au maximum » ;
// c'était une lecture trop prudente du seuil de détection, qui porte sur plus de 100 pages en 10
// secondes. 15 pages adossées à une base propriétaire ne sont pas un réseau de pages satellites.
//
// CE QUI REND CHAQUE PAGE UNIQUE. Le tableau vient d'un filtre différent, donc les sociétés
// listées diffèrent, et le résumé en tête est recalculé depuis les lignes de la page
// (`renderHubSummary`). Vérifié avant livraison : aucune paire de collections ne partage plus de
// 70 % de ses tickers. C'est la garantie qui manque aux gabarits sanctionnés.
//
// AJOUTER UNE COLLECTION = une entrée ici. La route, le sitemap, le maillage depuis /screener et
// le fil d'Ariane se branchent automatiquement.
//
// ⚠️ PIÈGE DE DONNÉE MESURÉ. `pfcfPercentile` n'est renseigné que sur 567 fiches sur 4 814 (12 %),
// parce qu'il demande un historique de valorisation. Toute collection bâtie sur le percentile est
// donc structurellement maigre : `sous-evaluees` ne sort que 72 lignes, et un premier essai
// d'« européennes sous-évaluées » sur le percentile n'en sortait qu'UNE. Les collections de
// valorisation ci-dessous utilisent donc un SEUIL ABSOLU de multiple, pas le percentile.

type ClassementCopy = { title: string; h1: string; intro: string };
type Classement = {
  /** Filtre Prisma, appliqué en plus de `status: 'scored'` et d'un multiple non nul. */
  where: Record<string, unknown>;
  /** Nombre de lignes affichées. */
  take: number;
  copy: Record<ArticleLang, ClassementCopy>;
  /** Post-filtre facultatif, quand la condition n'est pas exprimable en Prisma. */
  postFilter?: (r: HubRow) => boolean;
};

/** Bourses de l'Espace économique européen (approximation d'éligibilité PEA par la place de
 *  cotation). L'éligibilité réelle dépend du siège de l'émetteur, pas de la place : c'est dit
 *  explicitement dans l'intro de la page, on ne laisse pas le lecteur le deviner. */
const EEA_EXCHANGES = ['PA', 'AS', 'BR', 'LS', 'DE', 'MI', 'MC', 'ST', 'HE', 'CO', 'OL', 'VI', 'WA', 'IR', 'AT', 'BD'];
const TECH_SECTORS = ['Software', 'Semiconductor', 'Information Technology Services', 'Electronic', 'Computer', 'Communication Equipment', 'Internet Content'];
const HEALTH_SECTORS = ['Biotechnology', 'Drug Manufacturers', 'Medical', 'Diagnostics', 'Healthcare', 'Health Information'];
const FIN_SECTORS = ['Banks', 'Capital Markets', 'Asset Management', 'Financial', 'Credit Services', 'Insurance'];
const INDUS_SECTORS = ['Industrial', 'Aerospace', 'Engineering', 'Building', 'Farm & Heavy', 'Specialty Business', 'Railroads', 'Trucking', 'Integrated Freight', 'Electrical Equipment', 'Tools'];
const CONSO_SECTORS = ['Restaurants', 'Apparel', 'Packaged Foods', 'Beverages', 'Household', 'Personal', 'Specialty Retail', 'Discount Stores', 'Footwear', 'Luxury', 'Leisure'];
const sectorIn = (keys: string[]) => ({ OR: keys.map((k) => ({ sector: { contains: k } })) });

const CLASSEMENTS: Record<string, Classement> = {
  'qualite-10-sur-10': {
    where: {}, take: 100,
    postFilter: (r) => r.scoreChiffres != null && r.scoreChiffresMax != null && r.scoreChiffres >= r.scoreChiffresMax,
    copy: {
      fr: HUB_COPY.q10.fr, en: HUB_COPY.q10.en, es: HUB_COPY.q10.es,
    },
  },
  'sous-evaluees': {
    where: { opportunity: true }, take: 100,
    copy: { fr: HUB_COPY.sousval.fr, en: HUB_COPY.sousval.en, es: HUB_COPY.sousval.es },
  },
  'actions-pea-eligibles-de-qualite': {
    where: { exchange: { in: EEA_EXCHANGES }, scoreRatio: { gte: 0.8 } }, take: 100,
    copy: {
      fr: {
        title: 'Actions de qualité éligibles au PEA',
        h1: 'Les actions de qualité cotées dans la zone du PEA',
        intro: "Les sociétés les mieux notées par notre analyse fondamentale et cotées sur une place de l'Espace économique européen, celles qui alimentent en général un PEA. Attention, l'éligibilité réelle dépend du siège de l'émetteur et non de la place de cotation : vérifie toujours auprès de ton courtier avant d'acheter.",
      },
      en: {
        title: 'Quality stocks listed in the EEA',
        h1: 'Quality stocks listed in the European Economic Area',
        intro: 'The companies with the highest scores from our fundamental analysis listed on a European Economic Area exchange. Note that eligibility for a French PEA account depends on where the issuer is domiciled, not where it is listed: check with your broker before buying.',
      },
      es: {
        title: 'Acciones de calidad cotizadas en el EEE',
        h1: 'Acciones de calidad cotizadas en el Espacio Económico Europeo',
        intro: 'Las empresas mejor puntuadas por nuestro análisis fundamental y cotizadas en un mercado del Espacio Económico Europeo. Ojo: la elegibilidad para una cuenta PEA francesa depende del domicilio del emisor, no del mercado de cotización. Confírmalo con tu bróker antes de comprar.',
      },
    },
  },
  'actions-francaises-de-qualite': {
    where: { exchange: 'PA' }, take: 60,
    copy: {
      fr: {
        title: 'Meilleures actions françaises : le classement',
        h1: 'Les meilleures actions françaises selon nos critères',
        intro: "Toutes les sociétés cotées à Paris que nous analysons, classées de la meilleure qualité à la moins bonne sur nos 10 critères financiers, avec leur valorisation. La note juge le business, la colonne de valorisation juge le prix : les deux se lisent séparément.",
      },
      en: {
        title: 'Best French stocks: the ranking',
        h1: 'The best French stocks by our criteria',
        intro: 'Every Paris-listed company we cover, ranked from best to worst quality on our 10 financial criteria, with its valuation. The score judges the business, the valuation column judges the price: read them separately.',
      },
      es: {
        title: 'Mejores acciones francesas: el ranking',
        h1: 'Las mejores acciones francesas según nuestros criterios',
        intro: 'Todas las empresas cotizadas en París que analizamos, ordenadas de mayor a menor calidad sobre nuestros 10 criterios financieros, con su valoración. La nota juzga el negocio, la columna de valoración juzga el precio: se leen por separado.',
      },
    },
  },
  'actions-europeennes-sous-evaluees': {
    where: { region: 'EU', pfcfTTM: { lte: 15, gte: 3 } }, take: 100,
    copy: {
      fr: {
        title: 'Actions européennes sous-évaluées',
        h1: 'Les actions européennes les moins chères de notre univers',
        intro: "Les sociétés européennes qui se valorisent moins de 15 fois leur free cash flow, classées par note de qualité décroissante. Un multiple bas ne suffit pas : c'est la combinaison d'un multiple bas ET d'une note élevée qui fait une occasion, pas le multiple seul.",
      },
      en: {
        title: 'Undervalued European stocks',
        h1: 'The cheapest European stocks in our universe',
        intro: 'European companies valued at less than 15 times their free cash flow, ranked by descending quality score. A low multiple is not enough: what makes an opportunity is a low multiple AND a high score, not the multiple on its own.',
      },
      es: {
        title: 'Acciones europeas infravaloradas',
        h1: 'Las acciones europeas más baratas de nuestro universo',
        intro: 'Empresas europeas valoradas en menos de 15 veces su flujo de caja libre, ordenadas por nota de calidad descendente. Un múltiplo bajo no basta: lo que crea una oportunidad es un múltiplo bajo Y una nota alta, no el múltiplo por sí solo.',
      },
    },
  },
  'actions-a-acheter-maintenant': {
    where: { scoreRatio: { gte: 0.9 }, pfcfTTM: { lte: 25, gte: 3 } }, take: 100,
    copy: {
      fr: {
        title: 'Quelles actions acheter maintenant ?',
        h1: 'Les actions qui cumulent une note élevée et un prix raisonnable',
        intro: "La liste que notre méthode produit quand on croise les deux seuls critères qui comptent : une note de qualité d'au moins 9 sur 10 et une valorisation sous 25 fois le free cash flow. C'est une liste de départ pour ta propre analyse, pas une recommandation d'achat.",
      },
      en: {
        title: 'Which stocks to buy now?',
        h1: 'Stocks combining a high score with a reasonable price',
        intro: 'The list our method produces when we cross the only two criteria that matter: a quality score of at least 9 out of 10 and a valuation below 25 times free cash flow. It is a starting point for your own analysis, not a buy recommendation.',
      },
      es: {
        title: '¿Qué acciones comprar ahora?',
        h1: 'Las acciones que combinan nota alta y precio razonable',
        intro: 'La lista que produce nuestro método al cruzar los dos únicos criterios que importan: una nota de calidad de al menos 9 sobre 10 y una valoración por debajo de 25 veces el flujo de caja libre. Es un punto de partida para tu propio análisis, no una recomendación de compra.',
      },
    },
  },
  'actions-de-qualite-pas-cheres': {
    where: { scoreRatio: { gte: 0.8 }, pfcfTTM: { lte: 15, gte: 3 } }, take: 100,
    copy: {
      fr: {
        title: 'Actions de qualité pas chères',
        h1: 'Les actions de qualité qui se valorisent moins de 15 fois leur cash',
        intro: "Une bonne entreprise payée trop cher reste un mauvais placement : c'est la règle de départ de la méthode. Cette page ne garde que les sociétés bien notées dont le prix reste modéré face au free cash flow qu'elles produisent.",
      },
      en: {
        title: 'Cheap quality stocks',
        h1: 'Quality stocks valued at less than 15 times their cash',
        intro: 'A good company bought too expensively is still a bad investment: that is the starting rule of the method. This page keeps only well-scored companies whose price stays moderate against the free cash flow they generate.',
      },
      es: {
        title: 'Acciones de calidad baratas',
        h1: 'Acciones de calidad valoradas en menos de 15 veces su caja',
        intro: 'Una buena empresa pagada demasiado cara sigue siendo una mala inversión: es la regla de partida del método. Esta página solo conserva empresas bien puntuadas cuyo precio se mantiene moderado frente al flujo de caja libre que generan.',
      },
    },
  },
  'small-caps-de-qualite': {
    where: { scoreRatio: { gte: 0.8 }, marketCapUsd: { gt: 0, lt: 2_000_000_000 } }, take: 100,
    copy: {
      fr: {
        title: 'Meilleures small caps de qualité',
        h1: 'Les petites capitalisations les mieux notées',
        intro: "Les sociétés de moins de 2 milliards de dollars de capitalisation qui passent nos critères de qualité. Peu suivies par les analystes, donc plus souvent mal valorisées, dans les deux sens : la liquidité et la volatilité y sont aussi plus fortes.",
      },
      en: {
        title: 'Best quality small caps',
        h1: 'The highest-scoring small capitalisations',
        intro: 'Companies under 2 billion dollars of market capitalisation that pass our quality criteria. Thinly covered by analysts, therefore more often mispriced, in both directions: liquidity and volatility are also rougher here.',
      },
      es: {
        title: 'Mejores small caps de calidad',
        h1: 'Las pequeñas capitalizaciones mejor puntuadas',
        intro: 'Empresas por debajo de 2.000 millones de dólares de capitalización que superan nuestros criterios de calidad. Poco seguidas por los analistas y por tanto peor valoradas más a menudo, en ambos sentidos: la liquidez y la volatilidad también son más duras aquí.',
      },
    },
  },
  'grandes-capitalisations-de-qualite': {
    where: { scoreRatio: { gte: 0.8 }, marketCapUsd: { gte: 50_000_000_000 } }, take: 100,
    copy: {
      fr: {
        title: 'Meilleures grandes capitalisations',
        h1: 'Les grandes capitalisations les mieux notées',
        intro: "Les sociétés de plus de 50 milliards de dollars qui passent nos critères. Ce sont les noms les plus suivis du marché, donc les moins souvent mal valorisés : la note sert ici surtout à trier ce qui mérite d'être détenu longtemps.",
      },
      en: {
        title: 'Best large capitalisations',
        h1: 'The highest-scoring large capitalisations',
        intro: 'Companies above 50 billion dollars that pass our criteria. These are the most closely followed names on the market, therefore the least often mispriced: here the score mostly sorts what deserves to be held for years.',
      },
      es: {
        title: 'Mejores grandes capitalizaciones',
        h1: 'Las grandes capitalizaciones mejor puntuadas',
        intro: 'Empresas por encima de 50.000 millones de dólares que superan nuestros criterios. Son los nombres más seguidos del mercado y por tanto los menos veces mal valorados: aquí la nota sirve sobre todo para ordenar lo que merece mantenerse años.',
      },
    },
  },
  'actions-technologiques-de-qualite': {
    where: { scoreRatio: { gte: 0.8 }, ...sectorIn(TECH_SECTORS) }, take: 100,
    copy: {
      fr: {
        title: 'Meilleures actions technologiques',
        h1: 'Les actions technologiques les mieux notées',
        intro: "Logiciels, semi-conducteurs, services informatiques et composants électroniques : les sociétés du secteur qui passent nos 10 critères. Un secteur où les marges et le rendement du capital sont structurellement élevés, et où les multiples le sont aussi.",
      },
      en: {
        title: 'Best technology stocks',
        h1: 'The highest-scoring technology stocks',
        intro: 'Software, semiconductors, IT services and electronic components: the companies in the sector that pass our 10 criteria. A sector where margins and return on capital are structurally high, and where multiples are too.',
      },
      es: {
        title: 'Mejores acciones tecnológicas',
        h1: 'Las acciones tecnológicas mejor puntuadas',
        intro: 'Software, semiconductores, servicios informáticos y componentes electrónicos: las empresas del sector que superan nuestros 10 criterios. Un sector donde los márgenes y el rendimiento del capital son estructuralmente altos, y los múltiplos también.',
      },
    },
  },
  'actions-technologiques-sous-evaluees': {
    where: { pfcfTTM: { lte: 20, gte: 3 }, ...sectorIn(TECH_SECTORS) }, take: 100,
    copy: {
      fr: {
        title: 'Actions technologiques sous-évaluées',
        h1: 'Les actions technologiques les moins chères de notre univers',
        intro: "La technologie se valorise cher par construction, ce qui rend un multiple sous 20 fois le free cash flow inhabituel dans le secteur. Cette page liste ces cas, classés par note de qualité : à toi de juger si le prix bas est une occasion ou un avertissement.",
      },
      en: {
        title: 'Undervalued technology stocks',
        h1: 'The cheapest technology stocks in our universe',
        intro: 'Technology carries high valuations by construction, which makes a multiple below 20 times free cash flow unusual in the sector. This page lists those cases, ranked by quality score: it is up to you to judge whether the low price is an opportunity or a warning.',
      },
      es: {
        title: 'Acciones tecnológicas infravaloradas',
        h1: 'Las acciones tecnológicas más baratas de nuestro universo',
        intro: 'La tecnología se valora caro por construcción, lo que hace inusual en el sector un múltiplo por debajo de 20 veces el flujo de caja libre. Esta página lista esos casos, ordenados por nota de calidad: a ti te toca juzgar si el precio bajo es una oportunidad o una advertencia.',
      },
    },
  },
  'actions-sante-de-qualite': {
    where: { scoreRatio: { gte: 0.8 }, ...sectorIn(HEALTH_SECTORS) }, take: 100,
    copy: {
      fr: {
        title: 'Meilleures actions du secteur santé',
        h1: 'Les actions de santé les mieux notées',
        intro: "Laboratoires, dispositifs médicaux, diagnostics et sous-traitance pharmaceutique : les sociétés du secteur qui passent nos critères. Un secteur où la falaise des brevets et le cycle de la recherche font que la note de qualité passée ne dit pas tout de l'avenir.",
      },
      en: {
        title: 'Best healthcare stocks',
        h1: 'The highest-scoring healthcare stocks',
        intro: 'Drug makers, medical devices, diagnostics and pharmaceutical outsourcing: the companies in the sector that pass our criteria. A sector where the patent cliff and the research cycle mean a past quality score does not tell you everything about the future.',
      },
      es: {
        title: 'Mejores acciones del sector salud',
        h1: 'Las acciones de salud mejor puntuadas',
        intro: 'Laboratorios, dispositivos médicos, diagnóstico y subcontratación farmacéutica: las empresas del sector que superan nuestros criterios. Un sector donde el precipicio de patentes y el ciclo de investigación hacen que una nota de calidad pasada no lo diga todo del futuro.',
      },
    },
  },
  'actions-bancaires-et-financieres-de-qualite': {
    where: { scoreRatio: { gte: 0.8 }, ...sectorIn(FIN_SECTORS) }, take: 100,
    copy: {
      fr: {
        title: 'Meilleures actions bancaires et financières',
        h1: 'Les actions financières les mieux notées',
        intro: "Banques, assurance, gestion d'actifs et marchés de capitaux : les sociétés du secteur qui passent nos critères. Réserve de méthode à connaître : le free cash flow d'une banque ne se lit pas comme celui d'un industriel, donc lis la valorisation de ce secteur avec prudence.",
      },
      en: {
        title: 'Best bank and financial stocks',
        h1: 'The highest-scoring financial stocks',
        intro: 'Banks, insurance, asset management and capital markets: the companies in the sector that pass our criteria. One methodological caveat: a bank\'s free cash flow does not read like an industrial company\'s, so treat valuations in this sector with care.',
      },
      es: {
        title: 'Mejores acciones bancarias y financieras',
        h1: 'Las acciones financieras mejor puntuadas',
        intro: 'Bancos, seguros, gestión de activos y mercados de capitales: las empresas del sector que superan nuestros criterios. Una reserva de método: el flujo de caja libre de un banco no se lee como el de una industrial, así que interpreta con cautela las valoraciones de este sector.',
      },
    },
  },
  'actions-industrielles-de-qualite': {
    where: { scoreRatio: { gte: 0.8 }, ...sectorIn(INDUS_SECTORS) }, take: 100,
    copy: {
      fr: {
        title: 'Meilleures actions industrielles',
        h1: 'Les actions industrielles les mieux notées',
        intro: "Aéronautique et défense, machines, ingénierie, transport et équipements électriques : les sociétés du secteur qui passent nos critères. C'est le terrain de chasse classique des sociétés discrètes à fort rendement du capital, souvent moins suivies que la technologie.",
      },
      en: {
        title: 'Best industrial stocks',
        h1: 'The highest-scoring industrial stocks',
        intro: 'Aerospace and defence, machinery, engineering, transport and electrical equipment: the companies in the sector that pass our criteria. This is the classic hunting ground for quiet businesses with high returns on capital, often less followed than technology.',
      },
      es: {
        title: 'Mejores acciones industriales',
        h1: 'Las acciones industriales mejor puntuadas',
        intro: 'Aeronáutica y defensa, maquinaria, ingeniería, transporte y equipos eléctricos: las empresas del sector que superan nuestros criterios. Es el terreno de caza clásico de negocios discretos con alto rendimiento del capital, a menudo menos seguidos que la tecnología.',
      },
    },
  },
  'actions-de-consommation-de-qualite': {
    where: { scoreRatio: { gte: 0.8 }, ...sectorIn(CONSO_SECTORS) }, take: 100,
    copy: {
      fr: {
        title: 'Meilleures actions de consommation',
        h1: 'Les actions de consommation les mieux notées',
        intro: "Alimentation, boissons, restauration, distribution spécialisée, habillement et luxe : les sociétés du secteur qui passent nos critères. Le secteur où le pouvoir de fixer ses prix se voit le plus directement dans les marges.",
      },
      en: {
        title: 'Best consumer stocks',
        h1: 'The highest-scoring consumer stocks',
        intro: 'Food, beverages, restaurants, specialty retail, apparel and luxury: the companies in the sector that pass our criteria. The sector where pricing power shows up most directly in the margins.',
      },
      es: {
        title: 'Mejores acciones de consumo',
        h1: 'Las acciones de consumo mejor puntuadas',
        intro: 'Alimentación, bebidas, restauración, distribución especializada, textil y lujo: las empresas del sector que superan nuestros criterios. El sector donde el poder de fijar precios se ve de forma más directa en los márgenes.',
      },
    },
  },
  'actions-britanniques-de-qualite': {
    where: { exchange: 'L' }, take: 100,
    copy: {
      fr: {
        title: 'Meilleures actions britanniques',
        h1: 'Les meilleures actions britanniques selon nos critères',
        intro: "Les sociétés cotées à Londres que nous analysons, classées par note de qualité. Marché souvent moins cher que les États-Unis à qualité comparable, et hors PEA depuis le Brexit : le gain de valorisation se paie en fiscalité.",
      },
      en: {
        title: 'Best UK stocks',
        h1: 'The best UK stocks by our criteria',
        intro: 'The London-listed companies we cover, ranked by quality score. A market often cheaper than the United States at comparable quality, and outside the French PEA wrapper since Brexit: the valuation gain comes at a tax cost.',
      },
      es: {
        title: 'Mejores acciones británicas',
        h1: 'Las mejores acciones británicas según nuestros criterios',
        intro: 'Las empresas cotizadas en Londres que analizamos, ordenadas por nota de calidad. Un mercado a menudo más barato que Estados Unidos a calidad comparable, y fuera del PEA francés desde el Brexit: la ganancia de valoración se paga en fiscalidad.',
      },
    },
  },
  'actions-japonaises-de-qualite': {
    where: { exchange: 'T' }, take: 100,
    copy: {
      fr: {
        title: 'Meilleures actions japonaises',
        h1: 'Les meilleures actions japonaises selon nos critères',
        intro: "Les sociétés cotées à Tokyo que nous analysons, classées par note de qualité. Marché historiquement peu valorisé, où la réforme de la gouvernance pousse depuis quelques années au rachat d'actions et à la remontée du rendement du capital.",
      },
      en: {
        title: 'Best Japanese stocks',
        h1: 'The best Japanese stocks by our criteria',
        intro: 'The Tokyo-listed companies we cover, ranked by quality score. A historically cheap market, where governance reform has been pushing companies towards buybacks and higher returns on capital for several years.',
      },
      es: {
        title: 'Mejores acciones japonesas',
        h1: 'Las mejores acciones japonesas según nuestros criterios',
        intro: 'Las empresas cotizadas en Tokio que analizamos, ordenadas por nota de calidad. Un mercado históricamente barato, donde la reforma del gobierno corporativo empuja desde hace años hacia las recompras y un mayor rendimiento del capital.',
      },
    },
  },
};

/** Slugs des collections, dans l'ordre d'affichage. Exporté pour le sitemap et le maillage. */
export const CLASSEMENT_SLUGS: string[] = Object.keys(CLASSEMENTS);

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
    const lang = toArticleLang(typeof req.query.lng === 'string' ? req.query.lng : 'fr');
    const disp = displaySector(sector, lang);
    // Titre ≤ 60 car : on borne le nom de secteur à 26 (sinon Google tronque les noms
    // longs comme "Drug Manufacturers...") ; laisse la place au préfixe traduit.
    const dispTitle = disp.length > 26 ? disp.slice(0, 25).trimEnd() + '…' : disp;
    const copy = HUB_COPY.secteur[lang](disp);
    res.status(200).set('Content-Type', 'text/html; charset=utf-8').set('Cache-Control', 'public, max-age=3600, s-maxage=3600').send(renderHubHtml({
      title: HUB_COPY.secteur[lang](dispTitle).title,
      h1: copy.h1, intro: copy.intro, path: `/secteur/${slug}`, rows, lang,
      outbound: 'sector',
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
  const def = CLASSEMENTS[slug];
  if (!def) { res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(render404(slug)); return; }
  try {
    const copy = def.copy[lang];
    // `pfcfTTM: { not: null }` est imposé partout : c'est la même condition que la règle
    // d'indexation des fiches (palier 1). Une collection ne doit jamais lister une page que
    // Google ne peut pas indexer, sinon elle envoie du budget d'exploration dans un mur.
    const raw = await prisma.screenerTicker.findMany({
      where: { status: 'scored', pfcfTTM: { not: null }, ...def.where },
      orderBy: [{ scoreRatio: 'desc' }, { ticker: 'asc' }],
      take: def.postFilter ? def.take * 4 : def.take,
      select: HUB_SELECT,
    });
    const rows = (def.postFilter ? raw.filter(def.postFilter) : raw).slice(0, def.take);
    // Une collection vide serait une page sans contenu : mieux vaut un 404 franc.
    if (rows.length === 0) { res.status(404).set('Content-Type', 'text/html; charset=utf-8').send(render404(slug)); return; }
    res.status(200).set('Content-Type', 'text/html; charset=utf-8').set('Cache-Control', 'public, max-age=3600, s-maxage=3600').send(renderHubHtml({
      title: copy.title, h1: copy.h1, intro: copy.intro, path: `/classement/${slug}`, rows, lang,
      outbound: 'ranking',
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

// Bloc HTML qui liste des articles (titre + date + lien trilingue).
// Sert le maillage interne : la page /blog ne servait AUCUN lien vers les articles
// (cause confirmée des 50% URL unknown to Google dans l'audit 2026-06-23).
function renderArticleListBlock(lang: ArticleLang, lq: string, limit?: number): string {
  const headings = {
    fr: { h2Recent: 'Derniers articles du blog', h2All: 'Tous les articles', viewAll: 'Voir tous les articles', date: 'date', noTitle: 'Article' },
    en: { h2Recent: 'Latest blog articles', h2All: 'All articles', viewAll: 'See all articles', date: 'date', noTitle: 'Article' },
    es: { h2Recent: 'Últimos artículos del blog', h2All: 'Todos los artículos', viewAll: 'Ver todos los artículos', date: 'fecha', noTitle: 'Artículo' },
  } as const;
  const t = headings[lang];
  const all = listArticles();
  const list = limit ? all.slice(0, limit) : all;
  if (list.length === 0) return '';
  const items = list.map((a) => {
    const c = a.content[lang] || a.content.fr;
    const title = c?.title ? escapeHtml(c.title) : `${t.noTitle} ${escapeHtml(a.slug)}`;
    return `<li><a href="${SITE_URL}/blog/${encodeURIComponent(a.slug)}${lq}">${title}</a> <small>(${escapeHtml(a.date)})</small></li>`;
  }).join('\n');
  const h2 = limit ? t.h2Recent : t.h2All;
  const viewAllLink = limit ? `\n<p><a href="${SITE_URL}/blog${lq}">${t.viewAll}</a></p>` : '';
  return `<h2>${h2}</h2>\n<ul>\n${items}\n</ul>${viewAllLink}`;
}

// ─── Blocs de maillage dynamiques des pages-hub (Q2 et Q3 du plan SEO) ──────────
// Le diagnostic du 4 août 2026 : /screener servait 8 liens et AUCUN vers les 5000 fiches
// ni vers les 181 hubs secteur ; /compare servait 0 lien vers les 19 pages « X vs Y ».
// C'est exactement le bug déjà corrigé sur /blog en juin (cf. renderArticleListBlock),
// laissé ouvert sur les deux autres hubs. Sans ces liens, les fiches et les hubs ne sont
// atteignables que par le sitemap, or le sitemap aide à DÉCOUVRIR, il ne convainc pas
// Google de GARDER : environ la moitié des 5538 URL n'était pas indexée.

const SCREENER_BLOCK_TR: Record<ArticleLang, {
  h2Collections: string; introCollections: string;
  h2Sectors: string; introSectors: string; h2Top: string; introTop: string;
  thAction: string; thScore: string;
}> = {
  fr: {
    h2Collections: 'Les classements les plus demandés',
    introCollections: "Des listes prêtes à l'emploi, construites sur nos 10 critères et recalculées en continu : par enveloppe fiscale, par pays, par taille et par secteur.",
    h2Sectors: 'Les meilleures actions, secteur par secteur',
    introSectors: 'Chaque secteur a sa page : les entreprises les mieux notées de ce secteur, classées de la meilleure qualité à la moins bonne, avec leur valorisation.',
    h2Top: 'Les actions les mieux notées, toutes bourses confondues',
    introTop: 'Les cent meilleures notes de qualité du moment. Une note élevée ne dit rien du prix : la colonne de valorisation est là pour ça.',
    thAction: 'Action', thScore: 'Note qualité',
  },
  en: {
    h2Collections: 'The most requested rankings',
    introCollections: 'Ready-made lists built on our 10 criteria and recomputed continuously: by tax wrapper, by country, by size and by sector.',
    h2Sectors: 'The best stocks, sector by sector',
    introSectors: 'Every sector has its page: the highest-scoring companies of that sector, ranked from best to worst quality, with their valuation.',
    h2Top: 'The highest-scoring stocks, all exchanges',
    introTop: 'The hundred best quality scores right now. A high score says nothing about price: that is what the valuation column is for.',
    thAction: 'Stock', thScore: 'Quality score',
  },
  es: {
    h2Collections: 'Los rankings más solicitados',
    introCollections: 'Listas listas para usar, construidas sobre nuestros 10 criterios y recalculadas de forma continua: por envoltorio fiscal, por país, por tamaño y por sector.',
    h2Sectors: 'Las mejores acciones, sector por sector',
    introSectors: 'Cada sector tiene su página: las empresas mejor puntuadas de ese sector, ordenadas de mayor a menor calidad, con su valoración.',
    h2Top: 'Las acciones mejor puntuadas, todas las bolsas',
    introTop: 'Las cien mejores notas de calidad del momento. Una nota alta no dice nada del precio: para eso está la columna de valoración.',
    thAction: 'Acción', thScore: 'Nota de calidad',
  },
};

/** Nombre de fiches liées depuis /screener. Volontairement borné : lier plus de 500 pages
 *  depuis une même page divise l'autorité transmise, et réduire une navigation aux pages
 *  qui comptent a augmenté leur classement. Cent suffit à amorcer le graphe, les hubs
 *  secteur ci-dessous couvrent le reste du catalogue (181 hubs x 60 fiches). */
const SCREENER_TOP_LIMIT = 100;

/** Bloc de maillage de /screener : les 181 hubs secteur + les 100 meilleures fiches.
 *  Dégrade en chaîne vide si la base ne répond pas, pour ne jamais casser la page. */
async function renderScreenerHubBlock(lang: ArticleLang, lq: string): Promise<string> {
  const t = SCREENER_BLOCK_TR[lang];
  try {
    const [sectorRows, topRows] = await Promise.all([
      prisma.screenerTicker.findMany({
        where: { status: 'scored', sector: { not: null } },
        distinct: ['sector'], select: { sector: true },
      }),
      prisma.screenerTicker.findMany({
        where: { status: 'scored' }, orderBy: { scoreRatio: 'desc' },
        take: SCREENER_TOP_LIMIT, select: HUB_SELECT,
      }),
    ]);

    const sectors = sectorRows
      .map((r) => r.sector)
      .filter((s): s is string => !!s)
      .map((s) => ({ slug: slugifySector(s), label: displaySector(s, lang) }))
      .filter((s) => !!s.slug)
      .sort((a, b) => a.label.localeCompare(b.label));

    const collectionsHtml = [
      `<h2>${escapeHtml(t.h2Collections)}</h2>`,
      `<p>${escapeHtml(t.introCollections)}</p>`,
      '<ul>',
      ...CLASSEMENT_SLUGS.map((slug) => {
        const c = CLASSEMENTS[slug]!.copy[lang];
        return `<li><a href="${SITE_URL}/classement/${slug}${lq}">${escapeHtml(c.h1)}</a></li>`;
      }),
      '</ul>',
    ].join('\n');

    const sectorsHtml = sectors.length === 0 ? '' : [
      `<h2>${escapeHtml(t.h2Sectors)}</h2>`,
      `<p>${escapeHtml(t.introSectors)}</p>`,
      '<ul>',
      ...sectors.map((s) => `<li><a href="${SITE_URL}/secteur/${s.slug}${lq}">${escapeHtml(s.label)}</a></li>`),
      '</ul>',
    ].join('\n');

    const topHtml = topRows.length === 0 ? '' : [
      `<h2>${escapeHtml(t.h2Top)}</h2>`,
      `<p>${escapeHtml(t.introTop)}</p>`,
      '<table>',
      `<thead><tr><th>#</th><th>${escapeHtml(t.thAction)}</th><th>${escapeHtml(t.thScore)}</th><th>P/FCF</th></tr></thead>`,
      '<tbody>',
      ...topRows.map((r, i) => {
        const tk = escapeHtml(r.ticker);
        const nm = escapeHtml(r.name || r.ticker);
        const score = r.scoreChiffres != null && r.scoreChiffresMax ? `${r.scoreChiffres}/${r.scoreChiffresMax}` : 'n.d.';
        const pfcf = r.pfcfTTM != null && isFinite(r.pfcfTTM) ? `${r.pfcfTTM.toFixed(1)}x` : 'n.d.';
        return `<tr><td>${i + 1}</td><td><a href="${SITE_URL}/analyse/${tk}${lq}">${nm} (${tk})</a></td><td>${score}</td><td>${pfcf}</td></tr>`;
      }),
      '</tbody>',
      '</table>',
    ].join('\n');

    return [collectionsHtml, sectorsHtml, topHtml].filter(Boolean).join('\n');
  } catch (err) {
    console.error('[screener hub block]', (err as Error).message);
    return '';
  }
}

const COMPARE_BLOCK_TR: Record<ArticleLang, { h2: string; intro: string; anchor: (a: string, b: string) => string }> = {
  fr: {
    h2: 'Les comparaisons les plus demandées',
    intro: 'Deux entreprises du même secteur, mises face à face sur la qualité du business et sur le prix payé. Le verdict suit la donnée, aucune des deux n\'est favorisée.',
    anchor: (a, b) => `${a} ou ${b} : laquelle acheter`,
  },
  en: {
    h2: 'The most requested comparisons',
    intro: 'Two companies from the same sector, put face to face on business quality and on the price paid. The verdict follows the data, neither side is favoured.',
    anchor: (a, b) => `${a} or ${b}: which one to buy`,
  },
  es: {
    h2: 'Las comparaciones más solicitadas',
    intro: 'Dos empresas del mismo sector, cara a cara sobre la calidad del negocio y el precio pagado. El veredicto sigue el dato, ninguna de las dos se favorece.',
    anchor: (a, b) => `${a} o ${b}: cuál comprar`,
  },
};

/** Bloc de maillage de /compare : les 19 paires curées, avec le nom réel des sociétés en
 *  ancre plutôt que le ticker (le corpus mesure qu'un décalage entre l'ancre et la page
 *  d'arrivée entraîne une rétrogradation, et « X ou Y » est le patron de sous-requête visé). */
async function renderComparePairsBlock(lang: ArticleLang, lq: string): Promise<string> {
  const t = COMPARE_BLOCK_TR[lang];
  const tickers = [...new Set(COMPARE_PAIRS.flat())];
  let names = new Map<string, string>();
  try {
    const rows = await prisma.screenerTicker.findMany({
      where: { ticker: { in: tickers } }, select: { ticker: true, name: true },
    });
    names = new Map(rows.map((r) => [r.ticker, stripLegalSuffix(r.name || r.ticker)]));
  } catch (err) {
    // Sans les noms on garde les tickers en ancre : dégradé mais le lien existe, et c'est
    // le lien qui porte l'indexation.
    console.error('[compare pairs block]', (err as Error).message);
  }
  const items = COMPARE_PAIRS.map(([a, b]) => {
    const an = names.get(a) || a;
    const bn = names.get(b) || b;
    const slug = comparePairSlug(a, b);
    return `<li><a href="${SITE_URL}/comparer/${slug}${lq}">${escapeHtml(t.anchor(an, bn))}</a></li>`;
  }).join('\n');
  return `<h2>${escapeHtml(t.h2)}</h2>\n<p>${escapeHtml(t.intro)}</p>\n<ul>\n${items}\n</ul>`;
}

function renderStaticHtml(o: StaticSeo, lang: ArticleLang, extraBlock = ''): string {
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
        url: `${SITE_URL}/`, logo: `${SITE_URL}/icon-512.png`, sameAs: SAME_AS,
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
${o.path === '/blog' ? renderArticleListBlock(lang, lq) : ''}
${o.path === '/' ? renderArticleListBlock(lang, lq, 5) : ''}
${extraBlock}
${criteriaHtml}
<p>${linksHtml}</p>
</main>
<footer>
${renderFooterNav(lang, lq, ['/screener', '/methodologie', '/blog', o.path, ...c.links.map((l) => l.href)])}
</footer>
</body>
</html>`;
}

const STATIC_SEO: StaticSeo[] = [
  {
    // 🔒 VERROU PRODUIT : le title de la home est une décision manuelle (title long avec la
    // marque en suffixe). Les agents SEO NE DOIVENT PAS le raccourcir/modifier. Garde-fou :
    // scripts/check-home-title.mjs (job requis `no-dashes`). Le title de la home a 3 sources qui
    // doivent rester cohérentes (ici + apps/web/index.html + i18n seo.home.title fr/en/es).
    path: '/',
    website: true,
    content: {
      fr: {
        title: 'Surperforme le marché avec des actions de qualité au bon prix | Lubin Investment',
        desc: "Repère en un clin d'œil les meilleures opportunités d'investissement parmi des milliers d'entreprises analysées en continu.",
        h1: "Trouve les actions à acheter aujourd'hui, en un coup d'œil",
        intro: "Achète des actions de qualité au bon prix : la stratégie d'investissement qui surperforme le marché sur le long terme.",
        sections: [
          { h2: 'Comment ça marche', p: "Tapez un ticker, lisez la note sur 10 et son détail, puis décidez du prix d'entrée. La qualité du business et le prix de l'action sont jugés séparément : c'est la règle d'or de la méthode." },
          { h2: 'Une méthode transparente', p: "Les critères s'appuient sur la littérature financière (Warren Buffett, Michael Mauboussin, Aswath Damodaran). Aucune opinion, aucune boîte noire : la donnée décide." },
          { h2: 'Disponible dans Claude', p: "Un connecteur MCP branche Lubin Investment dans Claude : 10 outils pour analyser un titre, filtrer le screener, lire la résilience du modèle économique et gérer sa watchlist. Les notes restent calculées par Lubin à partir des chiffres publiés, jamais générées par le modèle." },
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
        title: 'Beat the market with quality stocks at the right price | Lubin Investment',
        desc: 'Spot the best investment opportunities at a glance, among thousands of companies analyzed continuously.',
        h1: 'Find the stocks to buy today, at a glance',
        intro: 'Buy quality stocks at the right price: the investment strategy that beats the market over the long term.',
        sections: [
          { h2: 'How it works', p: "Type a ticker, read the score out of 10 and its breakdown, then decide on your entry price. Business quality and share price are judged separately: that's the golden rule of the method." },
          { h2: 'A transparent method', p: 'The criteria draw on financial literature (Warren Buffett, Michael Mauboussin, Aswath Damodaran). No opinions, no black box: the data decides.' },
          { h2: 'Available inside Claude', p: 'An MCP connector plugs Lubin Investment into Claude: 10 tools to analyze a stock, filter the screener, read business-model resilience and manage a watchlist. Scores stay computed by Lubin from published figures, never generated by the model.' },
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
        title: 'Supera al mercado con acciones de calidad al precio justo | Lubin Investment',
        desc: 'Detecta de un vistazo las mejores oportunidades de inversión entre miles de empresas analizadas en continuo.',
        h1: 'Encuentra las acciones para comprar hoy, de un vistazo',
        intro: 'Compra acciones de calidad al precio justo: la estrategia de inversión que supera al mercado a largo plazo.',
        sections: [
          { h2: 'Cómo funciona', p: 'Escribe un ticker, lee la nota sobre 10 y su detalle, y luego decide el precio de entrada. La calidad del negocio y el precio de la acción se juzgan por separado: es la regla de oro del método.' },
          { h2: 'Un método transparente', p: 'Los criterios se apoyan en la literatura financiera (Warren Buffett, Michael Mauboussin, Aswath Damodaran). Sin opiniones, sin caja negra: decide el dato.' },
          { h2: 'Disponible en Claude', p: 'Un conector MCP integra Lubin Investment en Claude: 10 herramientas para analizar un valor, filtrar el screener, leer la resiliencia del modelo de negocio y gestionar la watchlist. Las notas las sigue calculando Lubin a partir de las cifras publicadas, nunca las genera el modelo.' },
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
    path: '/palmares',
    content: {
      fr: {
        title: 'Palmarès : des opportunités repérées avant le marché',
        desc: "Cas réels où le signal « opportunité du moment » a pointé une action des années avant le marché, mesurés en backtest, biais de survie assumé.",
        h1: 'Quand la méthode repère un gagnant très tôt',
        intro: "Le signal « opportunité du moment » (note de qualité ≥ 8/10 et P/FCF au plus bas de son historique) a parfois pointé des actions des années avant que le marché ne les rattrape. Voici des exemples issus de notre backtest point-in-time.",
        sections: [
          { h2: 'Des gagnants repérés tôt', p: "Comfort Systems USA (FIX), Lam Research (LRCX), Micron (MU), Ciena (CIEN), Apple (AAPL), Rambus (RMBS), Mueller Industries (MLI), Quanta Services (PWR), Arista Networks (ANET), FormFactor (FORM), Amphenol (APH) ou PulteGroup (PHM) figuraient parmi les opportunités du backtest et ont largement dépassé le S&P 500 sur leur période de détention." },
          { h2: 'Lecture honnête', p: "Ce sont les meilleurs cas, pas la moyenne : sur 310 opportunités du backtest (entrées de 2014 à 2022), environ 34 % seulement ont battu le S&P 500, avec un biais de survie assumé. Les performances passées ne préjugent pas des performances futures et rien ici n'est un conseil en investissement." },
        ],
        links: [
          { href: '/screener', label: 'Voir les opportunités du moment' },
          { href: '/methodologie', label: 'Notre méthodologie' },
        ],
      },
      en: {
        title: 'Track record: opportunities spotted before the market',
        desc: 'Real cases where the "opportunity of the moment" signal flagged a stock years before the market, measured in a backtest, survivorship bias acknowledged.',
        h1: 'When the method spots a winner early',
        intro: 'The "opportunity of the moment" signal (quality score ≥ 8/10 and P/FCF at the low of its own history) has at times flagged stocks years before the market caught up. Here are examples from our point-in-time backtest.',
        sections: [
          { h2: 'Winners spotted early', p: 'Comfort Systems USA (FIX), Lam Research (LRCX), Micron (MU), Ciena (CIEN), Apple (AAPL), Rambus (RMBS), Mueller Industries (MLI), Quanta Services (PWR), Arista Networks (ANET), FormFactor (FORM), Amphenol (APH) and PulteGroup (PHM) were among the backtest opportunities and far outpaced the S&P 500 over their holding period.' },
          { h2: 'Honest reading', p: 'These are the best cases, not the average: of 310 opportunities in the backtest (entries from 2014 to 2022), only about 34% beat the S&P 500, with survivorship bias acknowledged. Past performance does not guarantee future results, and nothing here is investment advice.' },
        ],
        links: [
          { href: '/screener', label: 'See the opportunities of the moment' },
          { href: '/methodologie', label: 'Our methodology' },
        ],
      },
      es: {
        title: 'Palmarés: oportunidades detectadas antes que el mercado',
        desc: 'Casos reales donde la señal «oportunidad del momento» detectó una acción años antes que el mercado, medidos en backtest, con sesgo de supervivencia asumido.',
        h1: 'Cuando el método detecta un ganador muy pronto',
        intro: 'La señal «oportunidad del momento» (nota de calidad ≥ 8/10 y P/FCF en el mínimo de su propio historial) a veces detectó acciones años antes de que el mercado las alcanzara. Aquí tienes ejemplos de nuestro backtest point-in-time.',
        sections: [
          { h2: 'Ganadores detectados pronto', p: 'Comfort Systems USA (FIX), Lam Research (LRCX), Micron (MU), Ciena (CIEN), Apple (AAPL), Rambus (RMBS), Mueller Industries (MLI), Quanta Services (PWR), Arista Networks (ANET), FormFactor (FORM), Amphenol (APH) o PulteGroup (PHM) estaban entre las oportunidades del backtest y superaron con creces al S&P 500 durante su periodo de tenencia.' },
          { h2: 'Lectura honesta', p: 'Son los mejores casos, no el promedio: de 310 oportunidades del backtest (entradas de 2014 a 2022), solo alrededor del 34 % superaron al S&P 500, con sesgo de supervivencia asumido. Las rentabilidades pasadas no garantizan resultados futuros y nada aquí es asesoramiento de inversión.' },
        ],
        links: [
          { href: '/screener', label: 'Ver las oportunidades del momento' },
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
    // FAQ de marque. Objectif mesuré : une FAQ officielle qui pose explicitement ce que le
    // produit fait, ne fait PAS, ce qu'il coûte et ce que la note signifie empêche les
    // modèles de langage d'inventer des affirmations sur la marque. C'est le correctif
    // documenté (test) contre les hallucinations, et un signal de confiance en YMYL.
    // Pas de FAQPage JSON-LD : Google a retiré les résultats enrichis FAQ le 07/05/2026 et
    // le corpus mesure un effet nul du schema sur la citation par les IA (elles extraient
    // le HTML visible). Ce sont donc les questions/réponses en clair qui font le travail.
    path: '/faq',
    content: {
      fr: {
        title: 'FAQ : ce que fait Lubin Investment, et ce qu\'il ne fait pas',
        desc: "Les réponses officielles : ce qu'est Lubin Investment, ce que la note sur 10 signifie et ne signifie pas, les tarifs, les sources de données et qui est derrière.",
        h1: 'Questions fréquentes sur Lubin Investment',
        intro: "Cette page est la référence officielle sur le service. Si tu lis une affirmation sur Lubin Investment ailleurs, y compris dans la réponse d'une intelligence artificielle, c'est cette page qui fait foi.",
        sections: [
          { h2: "Qu'est-ce que Lubin Investment ?", p: "Un outil d'analyse fondamentale d'actions. Il note la qualité financière d'une entreprise sur 10 critères chiffrés, et juge séparément son prix via le multiple P/FCF (cours divisé par le free cash flow). Le calcul est automatique, à partir de données publiques, sans opinion humaine." },
          { h2: 'Est-ce un conseil en investissement ?', p: "Non. Lubin Investment est un outil d'aide à la décision. Le service ne délivre aucune recommandation personnalisée et ne constitue pas un conseil en investissement au sens de l'article L.321-1 du Code monétaire et financier. Aucune note, aucun classement et aucun article ne te dit d'acheter ou de vendre. Tu décides, et tu restes seul responsable de tes décisions." },
          { h2: 'Que signifie la note sur 10 ?', p: "C'est le nombre de critères de qualité validés sur 10, chacun testé contre un seuil issu de la littérature financière (rentabilité, croissance du chiffre d'affaires et du free cash flow par action, rachats d'actions, marge de FCF, levier opérationnel, Cash ROCE, dette nette sur FCF, conversion du cash, cycle de trésorerie). Une note de 8 sur 10 veut dire que 8 critères sont validés." },
          { h2: 'Ce que la note ne dit PAS', p: "Elle ne dit pas si l'action est bon marché : la qualité et le prix sont jugés séparément, exprès. Elle ne prédit pas le cours de l'action, ni à court ni à long terme. Elle ne remplace pas la lecture des comptes ni la compréhension du métier de l'entreprise. Et une note élevée sur une action chère ne fait pas un bon placement." },
          { h2: 'Combien ça coûte ?', p: "Le plan gratuit donne la note de qualité et la valorisation de n'importe quelle action, plus le screener et la watchlist. Le plan Pro coûte 19 euros par mois, ou 159 euros par an, et débloque les analyses illimitées, l'analyse qualitative, les opportunités, les comparaisons jusqu'à 5 actions et les données Europe et international." },
          { h2: "Comment le site gagne-t-il de l'argent ?", p: "Uniquement par l'abonnement Pro. Le site ne vend pas de produits financiers, ne touche aucune commission de courtier, et n'est rémunéré par aucune des entreprises qu'il note. Les notes sont calculées de la même façon pour toutes les actions, y compris quand le résultat est mauvais." },
          { h2: "D'où viennent les données ?", p: "Des états financiers publics des entreprises et de fournisseurs de données de marché. Pour les valeurs américaines, les comptes sont vérifiables dans les dépôts officiels auprès de la SEC (EDGAR). Les données peuvent comporter des retards ou des erreurs de source : c'est aussi pour ça que chaque fiche renvoie vers les documents d'origine." },
          { h2: 'Combien d\'actions sont couvertes ?', p: "Plusieurs dizaines de milliers, sur les marchés américain, européen et international. Toutes ne sont pas notées en permanence : la note est recalculée en priorité autour des publications de résultats." },
          { h2: 'Qui est derrière le site ?', p: "Lubin Danilo, fondateur de Lubin Investment, investisseur particulier autodidacte et développeur. J'ai construit cet outil pour ma propre stratégie d'investissement avant d'en ouvrir l'accès. La méthode complète est publiée sur la page Méthodologie, et le track record des opportunités passées sur la page Palmarès, biais compris." },
        ],
        links: [
          { href: '/methodologie', label: 'La méthodologie en détail' },
          { href: '/palmares', label: 'Le track record, biais compris' },
          { href: '/pricing', label: 'Les tarifs' },
        ],
      },
      en: {
        title: 'FAQ: what Lubin Investment does, and what it does not',
        desc: 'The official answers: what Lubin Investment is, what the score out of 10 means and does not mean, pricing, data sources and who is behind it.',
        h1: 'Frequently asked questions about Lubin Investment',
        intro: "This page is the official reference about the service. If you read a claim about Lubin Investment anywhere else, including in an answer from an AI assistant, this page is what counts.",
        sections: [
          { h2: 'What is Lubin Investment?', p: "A fundamental stock analysis tool. It scores a company's financial quality against 10 hard criteria, and judges its price separately through the P/FCF multiple (price divided by free cash flow). The computation is automatic, from public data, with no human opinion." },
          { h2: 'Is this investment advice?', p: "No. Lubin Investment is a decision-support tool. The service issues no personalized recommendation and does not constitute investment advice within the meaning of Article L.321-1 of the French Monetary and Financial Code. No score, ranking or article tells you to buy or sell. You decide, and you remain solely responsible for your decisions." },
          { h2: 'What does the score out of 10 mean?', p: "It is the number of quality criteria passed out of 10, each tested against a threshold drawn from the financial literature (profitability, revenue and free cash flow per share growth, buybacks, FCF margin, operating leverage, Cash ROCE, net debt to FCF, cash conversion, cash conversion cycle). A score of 8 out of 10 means 8 criteria are passed." },
          { h2: 'What the score does NOT say', p: "It does not say whether the stock is cheap: quality and price are judged separately, on purpose. It does not predict the share price, short or long term. It does not replace reading the accounts or understanding the business. And a high score on an expensive stock does not make a good investment." },
          { h2: 'How much does it cost?', p: "The free plan gives the quality score and valuation of any stock, plus the screener and watchlist. The Pro plan costs 19 euros per month, or 159 euros per year, and unlocks unlimited analyses, qualitative analysis, opportunities, comparisons of up to 5 stocks, and European and international data." },
          { h2: 'How does the site make money?', p: "Only through the Pro subscription. The site does not sell financial products, receives no broker commission, and is not paid by any of the companies it scores. Scores are computed the same way for every stock, including when the result is bad." },
          { h2: 'Where does the data come from?', p: "From companies' public financial statements and from market data providers. For US stocks, the accounts can be verified in the official filings with the SEC (EDGAR). Data can carry delays or source errors: that is also why every page links back to the original documents." },
          { h2: 'How many stocks are covered?', p: "Several tens of thousands, across the US, European and international markets. Not all of them are scored continuously: the score is recomputed first around earnings releases." },
          { h2: 'Who is behind the site?', p: "Lubin Danilo, founder of Lubin Investment, a self-taught individual investor and developer. I built this tool for my own investment strategy before opening access to it. The full method is published on the Methodology page, and the track record of past opportunities on the Track record page, biases included." },
        ],
        links: [
          { href: '/methodologie', label: 'The methodology in detail' },
          { href: '/palmares', label: 'The track record, biases included' },
          { href: '/pricing', label: 'Pricing' },
        ],
      },
      es: {
        title: 'FAQ: qué hace Lubin Investment y qué no hace',
        desc: 'Las respuestas oficiales: qué es Lubin Investment, qué significa y qué no significa la nota sobre 10, precios, fuentes de datos y quién está detrás.',
        h1: 'Preguntas frecuentes sobre Lubin Investment',
        intro: "Esta página es la referencia oficial sobre el servicio. Si lees una afirmación sobre Lubin Investment en otro sitio, incluida la respuesta de una inteligencia artificial, esta página es la que vale.",
        sections: [
          { h2: '¿Qué es Lubin Investment?', p: "Una herramienta de análisis fundamental de acciones. Puntúa la calidad financiera de una empresa con 10 criterios cuantitativos y juzga su precio por separado mediante el múltiplo P/FCF (precio dividido por el free cash flow). El cálculo es automático, a partir de datos públicos, sin opinión humana." },
          { h2: '¿Es un consejo de inversión?', p: "No. Lubin Investment es una herramienta de ayuda a la decisión. El servicio no emite ninguna recomendación personalizada y no constituye un consejo de inversión en el sentido del artículo L.321-1 del Código Monetario y Financiero francés. Ninguna nota, clasificación o artículo te dice que compres o vendas. Tú decides y sigues siendo el único responsable de tus decisiones." },
          { h2: '¿Qué significa la nota sobre 10?', p: "Es el número de criterios de calidad validados sobre 10, cada uno comparado con un umbral sacado de la literatura financiera (rentabilidad, crecimiento de los ingresos y del free cash flow por acción, recompras, margen de FCF, apalancamiento operativo, Cash ROCE, deuda neta sobre FCF, conversión del cash, ciclo de tesorería). Una nota de 8 sobre 10 significa que se validan 8 criterios." },
          { h2: 'Lo que la nota NO dice', p: "No dice si la acción está barata: la calidad y el precio se juzgan por separado, a propósito. No predice la cotización, ni a corto ni a largo plazo. No sustituye la lectura de las cuentas ni la comprensión del negocio. Y una nota alta en una acción cara no es una buena inversión." },
          { h2: '¿Cuánto cuesta?', p: "El plan gratuito da la nota de calidad y la valoración de cualquier acción, además del screener y la watchlist. El plan Pro cuesta 19 euros al mes, o 159 euros al año, y desbloquea los análisis ilimitados, el análisis cualitativo, las oportunidades, las comparaciones de hasta 5 acciones y los datos de Europa e internacionales." },
          { h2: '¿Cómo gana dinero el sitio?', p: "Únicamente con la suscripción Pro. El sitio no vende productos financieros, no cobra ninguna comisión de bróker y no recibe pagos de ninguna de las empresas que puntúa. Las notas se calculan igual para todas las acciones, incluso cuando el resultado es malo." },
          { h2: '¿De dónde vienen los datos?', p: "De los estados financieros públicos de las empresas y de proveedores de datos de mercado. Para los valores estadounidenses, las cuentas se pueden verificar en los informes oficiales ante la SEC (EDGAR). Los datos pueden tener retrasos o errores de origen: también por eso cada ficha enlaza a los documentos originales." },
          { h2: '¿Cuántas acciones están cubiertas?', p: "Varias decenas de miles, en los mercados estadounidense, europeo e internacional. No todas se puntúan de forma continua: la nota se recalcula con prioridad en torno a la publicación de resultados." },
          { h2: '¿Quién está detrás del sitio?', p: "Lubin Danilo, fundador de Lubin Investment, inversor particular autodidacta y desarrollador. Construí esta herramienta para mi propia estrategia de inversión antes de abrir el acceso. El método completo está publicado en la página Metodología, y el track record de las oportunidades pasadas en la página Palmarés, sesgos incluidos." },
        ],
        links: [
          { href: '/methodologie', label: 'La metodología en detalle' },
          { href: '/palmares', label: 'El track record, sesgos incluidos' },
          { href: '/pricing', label: 'Los precios' },
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

/** Pages statiques qui portent un bloc de maillage tiré de la base (Q2 et Q3 du plan SEO).
 *  Leur cache CDN est plus court que celui des pages figées : la liste des meilleures notes
 *  bouge au fil des re-scorings. */
const STATIC_DYNAMIC_BLOCK: Record<string, (lang: ArticleLang, lq: string) => Promise<string>> = {
  '/screener': renderScreenerHubBlock,
  '/compare': renderComparePairsBlock,
};

for (const seo of STATIC_SEO) {
  seoPrerenderRouter.get(seo.path, async (req: Request, res: Response) => {
    // Langue demandée par le bot via ?lng= (les alternates hreflang du sitemap pointent
    // vers ?lng=en / ?lng=es). Défaut fr. Le cache CDN distingue les langues car ?lng=
    // fait partie de l'URL.
    const lang = toArticleLang(typeof req.query.lng === 'string' ? req.query.lng : 'fr');
    const lq = lang === 'fr' ? '' : `?lng=${lang}`;
    const build = STATIC_DYNAMIC_BLOCK[seo.path];
    // Le bloc dégrade déjà en chaîne vide en cas d'erreur DB : la page part toujours en 200.
    const extraBlock = build ? await build(lang, lq) : '';
    res.status(200)
      .set('Content-Type', 'text/html; charset=utf-8')
      .set('Cache-Control', build ? 'public, max-age=3600, s-maxage=3600' : 'public, max-age=3600, s-maxage=86400')
      .send(renderStaticHtml(STATIC_BY_PATH[seo.path]!, lang, extraBlock));
  });
}
