/**
 * Sitemaps dynamiques pour le référencement.
 *
 * ⚠️ ARCHITECTURE (revue audit masterclass SEO 2026-08-04) : ce n'est plus UN sitemap
 * monolithique mais un INDEX qui pointe vers plusieurs sitemaps thématiques :
 *
 *   /sitemap.xml              → index (c'est l'URL déclarée dans robots.txt et la GSC)
 *   /sitemap-pages.xml        → pages statiques (home, pricing, screener, légal…)
 *   /sitemap-articles.xml     → articles de blog
 *   /sitemap-hubs.xml         → hubs secteur + comparaisons
 *   /sitemap-tickers-1.xml…N  → fiches /analyse, par tranches de 1000
 *
 * Pourquoi : le corpus mesure que plusieurs petits sitemaps s'indexent PLUS VITE qu'un
 * gros, et surtout un découpage thématique rend le diagnostic possible dans la Search
 * Console (elle affiche le taux de couverture PAR sitemap). Avec un fichier unique de
 * 5000 URLs, impossible de savoir si le problème d'indexation touche les fiches, les
 * articles ou les hubs. Là, on le lit directement.
 *
 * Chaque sitemap porte des balises hreflang fr/en/es (xhtml:link) et les fiches ticker
 * sont ordonnées par scoreRatio décroissant (les meilleures notes en premier).
 *
 * Cache mémoire 1 h par sitemap : les jobs de scoring tournent en continu, inutile
 * d'interroger Prisma à chaque hit.
 */
import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { prisma } from '../db/client.js';
import { CDN_TTL, publicCacheControl } from '../lib/publicCache.js';
// ⚠️ On NE peut PAS importer de valeur depuis '@lubin/shared' (pas de build dist/ → crash
// de la lambda en prod, cf. scripts/check-api-shared-imports.mjs). On consomme donc une
// COPIE locale du module articles. La source de vérité reste packages/shared/src/articles.ts
// (côté web) — il faut synchroniser les deux fichiers quand un article est ajouté/édité.
// TODO : à terme, transformer @lubin/shared en vrai package compilé (tsc → dist/) et virer
// cette duplication.
import { listArticles } from '../data/articles.js';
import { slugifySector, COMPARE_PAIRS, comparePairSlug } from './seoPrerender.js';

export const sitemapRouter: Router = Router();

/** URL canonique du site, surchargée par env en prod. */
const SITE_URL = (process.env.SITE_URL || 'https://lubin-investment.com').replace(/\/$/, '');

/** Locales gérées par l'app (hreflang). La langue par défaut est le français. */
const LOCALES = ['fr', 'en', 'es'] as const;

/** Nombre max de fiches ticker par sitemap. Google autorise 50 000 URLs par fichier :
 *  on descend très en dessous, l'objectif étant la vitesse d'indexation et la lisibilité
 *  du rapport de couverture, pas de tenir dans la limite. */
const TICKERS_PER_SITEMAP = 1000;

/** Plafond global de fiches advertisées (inchangé par rapport au sitemap monolithique). */
const MAX_TICKERS = 5000;

/** Pages statiques + leurs hints SEO. */
const STATIC_PAGES: Array<{ path: string; changefreq: string; priority: number }> = [
  { path: '/',                  changefreq: 'daily',   priority: 1.0 },
  { path: '/analyser',          changefreq: 'weekly',  priority: 0.9 },
  { path: '/pricing',           changefreq: 'weekly',  priority: 0.8 },
  { path: '/screener',          changefreq: 'daily',   priority: 0.9 },
  { path: '/compare',           changefreq: 'weekly',  priority: 0.7 },
  { path: '/methodologie',      changefreq: 'monthly', priority: 0.6 },
  { path: '/palmares',          changefreq: 'monthly', priority: 0.6 },
  { path: '/faq',               changefreq: 'monthly', priority: 0.7 },
  { path: '/blog',              changefreq: 'weekly',  priority: 0.7 },
  // Offre SEO. `/visibilite-ia` est l'outil gratuit (l'entrée du tunnel), la landing et les
  // tarifs sont les pages de décision. Les URL de RÉSULTAT `/visibilite-ia/<cible>` ne sont
  // volontairement PAS listées : ce sont des milliers de pages générées par les visiteurs,
  // quasi dupliquées, et elles sortent déjà en noindex côté pré-rendu.
  { path: '/audit-seo',         changefreq: 'weekly',  priority: 0.9 },
  { path: '/audit-seo/tarifs',  changefreq: 'weekly',  priority: 0.8 },
  { path: '/visibilite-ia',     changefreq: 'weekly',  priority: 0.9 },
  { path: '/mentions-legales',  changefreq: 'yearly',  priority: 0.2 },
  { path: '/cgu',               changefreq: 'yearly',  priority: 0.2 },
  { path: '/cgv',               changefreq: 'yearly',  priority: 0.2 },
  { path: '/confidentialite',   changefreq: 'yearly',  priority: 0.2 },
];

/** Cache mémoire, une entrée par sitemap (clé = nom du sitemap). */
const CACHE = new Map<string, { xml: string; ts: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 h

/** Échappe les caractères XML dangereux dans les URLs (& en particulier). */
function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Construit un bloc <url> avec hreflang pour une page statique. */
function buildStaticUrlBlock(path: string, changefreq: string, priority: number, lastmod: string): string {
  const loc = xmlEscape(`${SITE_URL}${path}`);
  const altLinks = LOCALES.map((lng) => {
    // En interne, fr est la langue par défaut (pas de préfixe). Les autres locales
    // utilisent le paramètre ?lng= côté SPA — c'est suffisant pour signaler les variantes.
    const href = lng === 'fr'
      ? `${SITE_URL}${path}`
      : `${SITE_URL}${path}${path.includes('?') ? '&' : '?'}lng=${lng}`;
    return `    <xhtml:link rel="alternate" hreflang="${lng}" href="${xmlEscape(href)}"/>`;
  }).join('\n');
  const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}"/>`;
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority.toFixed(1)}</priority>`,
    altLinks,
    xDefault,
    '  </url>',
  ].join('\n');
}

/** Construit un bloc <url> pour une page d'analyse ticker.
 *  - hreflang fr/en/es + x-default : signale à Google les 3 variantes linguistiques.
 *  - priority différenciée par scoreRatio : Google rationne le crawl budget sur 5000 fiches
 *    si toutes ont la même priority. On surnage les meilleures notes.
 *  - lastmod réel = dernière analyse (lastScoredAt), pas la date du build : signal de
 *    fraîcheur fiable pour Google.
 */
function buildTickerUrlBlock(ticker: string, lastmod: string, scoreRatio: number | null): string {
  const base = `${SITE_URL}/analyse/${encodeURIComponent(ticker)}`;
  const loc = xmlEscape(base);
  // Bucket priority : top quality (>= 0.8) = 0.8, top quartile (>= 0.6) = 0.7,
  // mediane (>= 0.4) = 0.5, queue = 0.3. Sans score : 0.4 (low default).
  const priority = scoreRatio == null
    ? 0.4
    : scoreRatio >= 0.8 ? 0.8
    : scoreRatio >= 0.6 ? 0.7
    : scoreRatio >= 0.4 ? 0.5
    : 0.3;
  // changefreq weekly : les notes bougent mais pas chaque jour ; daily faisait perdre
  // de la crédibilité auprès de Google sur 5000 URLs (signal jugé spammeux).
  const altLinks = LOCALES.map((lng) => {
    const href = lng === 'fr' ? base : `${base}?lng=${lng}`;
    return `    <xhtml:link rel="alternate" hreflang="${lng}" href="${xmlEscape(href)}"/>`;
  }).join('\n');
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>weekly</changefreq>`,
    `    <priority>${priority.toFixed(1)}</priority>`,
    altLinks,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}"/>`,
    '  </url>',
  ].join('\n');
}

/** Construit un bloc <url> pour une page de hub (secteur / classement), avec hreflang
 *  fr/en/es (le pré-rendu des hubs gère le paramètre ?lng). */
function buildHubUrlBlock(path: string, lastmod: string): string {
  const loc = xmlEscape(`${SITE_URL}${path}`);
  const altLinks = LOCALES.map((lng) => {
    const href = lng === 'fr' ? `${SITE_URL}${path}` : `${SITE_URL}${path}?lng=${lng}`;
    return `    <xhtml:link rel="alternate" hreflang="${lng}" href="${xmlEscape(href)}"/>`;
  }).join('\n');
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>daily</changefreq>`,
    `    <priority>0.8</priority>`,
    altLinks,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}"/>`,
    '  </url>',
  ].join('\n');
}

/** Enveloppe une liste de blocs <url> dans un <urlset> complet. */
function wrapUrlset(blocks: string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...blocks,
    '</urlset>',
  ].join('\n');
}

/** Tickers à INDEXER, STRICTEMENT le miroir de la règle robots de seoPrerender
 *  (renderTickerHtml). On exclut :
 *    - toute fiche SANS multiple de valorisation (palier 1 de la réduction du catalogue,
 *      2026-08-04 : la fiche ne peut pas répondre à la question que son titre pose) ;
 *    - le « bas » historique : note < 5/10 ET (very small cap US < 500 M$ OU penny < 1 $),
 *      cf. audit SEO 2026-07-19 ;
 *  SAUF opportunité du moment ou ticker rattaché à un article.
 *  ⚠️ Toute évolution de cette règle DOIT être répliquée dans seoPrerender.ts (sinon on advertise
 *  dans le sitemap des pages en noindex, signaux incohérents). Le test
 *  `sitemap.indexRule.test.ts` verrouille l'équivalence des deux. */
function tickerWhere() {
  const articleTickers = Array.from(
    new Set(
      listArticles()
        .map((a) => (a.ticker ? a.ticker.toUpperCase() : ''))
        .filter((s) => s.length > 0),
    ),
  );
  return {
    status: 'scored',
    OR: [
      { opportunity: true },
      { ticker: { in: articleTickers } },
      {
        AND: [
          // Condition non négociable depuis le palier 1 : il faut un multiple de valorisation.
          { pfcfTTM: { not: null } },
          {
            OR: [
              // Note >= 5/10 (ou pas encore de note) : la fiche a quelque chose à dire.
              { scoreRatio: { gte: 0.5 } },
              { scoreRatio: null },
              // Note < 5/10 : tolérée seulement hors penny stock et hors micro cap US.
              {
                AND: [
                  { OR: [{ price: null }, { price: { gte: 1 } }] },
                  { NOT: { region: 'US', marketCap: { lt: 500_000_000 } } },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

/** Nombre de tranches de fiches ticker (au moins 1, pour que l'index ne soit jamais vide). */
async function countTickerChunks(): Promise<number> {
  const total = Math.min(await prisma.screenerTicker.count({ where: tickerWhere() }), MAX_TICKERS);
  return Math.max(1, Math.ceil(total / TICKERS_PER_SITEMAP));
}

/** Index de sitemaps : c'est CE fichier qui reste déclaré dans robots.txt et la GSC. */
async function buildSitemapIndex(): Promise<string> {
  const lastmod = new Date().toISOString().slice(0, 10);
  const chunks = await countTickerChunks();
  const children = [
    '/sitemap-pages.xml',
    '/sitemap-articles.xml',
    '/sitemap-hubs.xml',
    ...Array.from({ length: chunks }, (_, i) => `/sitemap-tickers-${i + 1}.xml`),
  ];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...children.map((p) => [
      '  <sitemap>',
      `    <loc>${xmlEscape(`${SITE_URL}${p}`)}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      '  </sitemap>',
    ].join('\n')),
    '</sitemapindex>',
  ].join('\n');
}

/** Sitemap des pages statiques. */
function buildPagesSitemap(): string {
  const lastmod = new Date().toISOString().slice(0, 10);
  return wrapUrlset(STATIC_PAGES.map((p) => buildStaticUrlBlock(p.path, p.changefreq, p.priority, lastmod)));
}

/** Sitemap des articles de blog. lastmod = date de mise à jour de l'article. */
function buildArticlesSitemap(): string {
  return wrapUrlset(
    listArticles().map((a) => buildStaticUrlBlock(`/blog/${a.slug}`, 'monthly', 0.6, a.updated)),
  );
}

/** Sitemap des hubs : un hub par secteur + les pages de comparaison curées. */
async function buildHubsSitemap(): Promise<string> {
  const lastmod = new Date().toISOString().slice(0, 10);
  const sectorRows = await prisma.screenerTicker.findMany({
    where: { status: 'scored', sector: { not: null } },
    distinct: ['sector'],
    select: { sector: true },
  });
  const sectorSlugs = Array.from(
    new Set(
      sectorRows
        .map((r) => (r.sector ? slugifySector(r.sector) : ''))
        .filter((s) => s.length > 0),
    ),
  );
  return wrapUrlset([
    ...sectorSlugs.map((slug) => buildHubUrlBlock(`/secteur/${slug}`, lastmod)),
    // Pages de comparaison « X vs Y » : liste curée (~20), servies en HTML pré-rendu aux
    // bots. Elles n'ont aucun lien entrant naturel puisqu'elles viennent d'être créées, or
    // une page orpheline est ignorée ou déprioritisée : le sitemap est ici le canal de
    // découverte, en plus du lien depuis chaque fiche concernée.
    ...COMPARE_PAIRS.map(([a, b]) =>
      buildStaticUrlBlock(`/comparer/${comparePairSlug(a, b)}`, 'weekly', 0.7, lastmod),
    ),
  ]);
}

/** Sitemap d'une tranche de fiches ticker (1-indexé), meilleurs scoreRatio en premier. */
async function buildTickersSitemap(chunk: number): Promise<string> {
  const fallbackLastmod = new Date().toISOString().slice(0, 10);
  const skip = (chunk - 1) * TICKERS_PER_SITEMAP;
  // On respecte le plafond global : la dernière tranche peut être plus courte.
  const take = Math.max(0, Math.min(TICKERS_PER_SITEMAP, MAX_TICKERS - skip));
  if (take === 0) return wrapUrlset([]);
  const tickers = await prisma.screenerTicker.findMany({
    where: tickerWhere(),
    // ⚠️ Tri STABLE obligatoire : sans le tie-break sur `ticker`, deux fiches de même
    // scoreRatio peuvent permuter entre deux requêtes et une URL se retrouverait dans
    // deux tranches à la fois (ou dans aucune) selon la pagination.
    orderBy: [{ scoreRatio: 'desc' }, { ticker: 'asc' }],
    skip,
    take,
    select: { ticker: true, scoreRatio: true, lastScoredAt: true, updatedAt: true },
  });
  return wrapUrlset(
    tickers.map((t) => {
      // lastmod réel : dernière analyse (lastScoredAt) > updatedAt > date du jour.
      const tickerLastmod = (t.lastScoredAt ?? t.updatedAt)?.toISOString().slice(0, 10) ?? fallbackLastmod;
      return buildTickerUrlBlock(t.ticker, tickerLastmod, t.scoreRatio);
    }),
  );
}

/** Sert un sitemap avec cache mémoire + cache CDN. */
async function serveSitemap(res: Response, key: string, build: () => Promise<string> | string): Promise<void> {
  const now = Date.now();
  const cached = CACHE.get(key);
  let xml: string;
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    xml = cached.xml;
  } else {
    xml = await build();
    CACHE.set(key, { xml, ts: now });
  }
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // Le cache mémoire ci-dessus ne vit que le temps d'une instance de lambda : c'est `s-maxage`,
  // partagé, qui évite de relire 1 000 lignes par fichier de tickers à chaque passage de robot.
  // La liste ne change qu'au scoring nocturne (cf. lib/publicCache.ts).
  res.setHeader('Cache-Control', publicCacheControl(CDN_TTL.nightly, 3600));
  res.status(200).send(xml);
}

sitemapRouter.get(
  '/sitemap.xml',
  asyncHandler(async (_req: Request, res: Response) => {
    await serveSitemap(res, 'index', buildSitemapIndex);
  }),
);

sitemapRouter.get(
  '/sitemap-pages.xml',
  asyncHandler(async (_req: Request, res: Response) => {
    await serveSitemap(res, 'pages', buildPagesSitemap);
  }),
);

sitemapRouter.get(
  '/sitemap-articles.xml',
  asyncHandler(async (_req: Request, res: Response) => {
    await serveSitemap(res, 'articles', buildArticlesSitemap);
  }),
);

sitemapRouter.get(
  '/sitemap-hubs.xml',
  asyncHandler(async (_req: Request, res: Response) => {
    await serveSitemap(res, 'hubs', buildHubsSitemap);
  }),
);

sitemapRouter.get(
  '/sitemap-tickers-:chunk.xml',
  asyncHandler(async (req: Request, res: Response) => {
    const raw = typeof req.params.chunk === 'string' ? req.params.chunk : '';
    const chunk = Number.parseInt(raw, 10);
    // Borne haute = nombre réel de tranches : évite qu'un crawler (ou un scan) déclenche
    // des requêtes DB à l'infini sur /sitemap-tickers-99999.xml.
    if (!Number.isInteger(chunk) || chunk < 1 || chunk > (await countTickerChunks())) {
      res.status(404).set('Content-Type', 'text/plain; charset=utf-8').send('Not found');
      return;
    }
    await serveSitemap(res, `tickers-${chunk}`, () => buildTickersSitemap(chunk));
  }),
);

/** Export de test uniquement : permet de rejouer la clause reelle contre la base. */
export const __tickerWhereForTest = tickerWhere;
