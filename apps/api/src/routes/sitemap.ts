/**
 * /sitemap.xml — sitemap dynamique pour le référencement.
 *
 * Inclut :
 *   - les pages statiques principales (home, pricing, screener, compare, etc.)
 *     avec balises hreflang fr/en/es (xhtml:link) ;
 *   - jusqu'à 5000 tickers scorés, ordonnés par scoreRatio décroissant
 *     (les meilleures notes en premier → meilleur signal pour les crawlers).
 *
 * Cache mémoire 1 h : le sitemap est régénéré au plus toutes les heures
 * (les jobs de scoring tournent en continu, mais inutile d'interroger Prisma à chaque hit).
 */
import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { prisma } from '../db/client.js';
// ⚠️ On NE peut PAS importer de valeur depuis '@lubin/shared' (pas de build dist/ → crash
// de la lambda en prod, cf. scripts/check-api-shared-imports.mjs). On consomme donc une
// COPIE locale du module articles. La source de vérité reste packages/shared/src/articles.ts
// (côté web) — il faut synchroniser les deux fichiers quand un article est ajouté/édité.
// TODO : à terme, transformer @lubin/shared en vrai package compilé (tsc → dist/) et virer
// cette duplication.
import { listArticles } from '../data/articles.js';
import { slugifySector } from './seoPrerender.js';

export const sitemapRouter: Router = Router();

/** URL canonique du site, surchargée par env en prod. */
const SITE_URL = (process.env.SITE_URL || 'https://lubin-investment.com').replace(/\/$/, '');

/** Locales gérées par l'app (hreflang). La langue par défaut est le français. */
const LOCALES = ['fr', 'en', 'es'] as const;

/** Pages statiques + leurs hints SEO. */
const STATIC_PAGES: Array<{ path: string; changefreq: string; priority: number }> = [
  { path: '/',                  changefreq: 'daily',   priority: 1.0 },
  { path: '/pricing',           changefreq: 'weekly',  priority: 0.8 },
  { path: '/screener',          changefreq: 'daily',   priority: 0.9 },
  { path: '/compare',           changefreq: 'weekly',  priority: 0.7 },
  { path: '/methodologie',      changefreq: 'monthly', priority: 0.6 },
  { path: '/blog',              changefreq: 'weekly',  priority: 0.7 },
  { path: '/mentions-legales',  changefreq: 'yearly',  priority: 0.2 },
  { path: '/cgu',               changefreq: 'yearly',  priority: 0.2 },
  { path: '/cgv',               changefreq: 'yearly',  priority: 0.2 },
  { path: '/confidentialite',   changefreq: 'yearly',  priority: 0.2 },
];

/** Cache mémoire — clé unique car le sitemap est global (pas multi-tenant). */
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

/** Assemble le XML complet (statiques + hubs + tickers scorés). */
async function buildSitemap(): Promise<string> {
  const lastmod = new Date().toISOString().slice(0, 10);

  // Tickers scorés, meilleurs ratios en premier (limite Google : 50 000 URLs / sitemap).
  // On récupère scoreRatio (pour différencier la priority) et lastScoredAt (lastmod réel)
  // afin d'envoyer à Google de vrais signaux de fraîcheur + d'importance par fiche.
  const tickers = await prisma.screenerTicker.findMany({
    where: { status: 'scored' },
    orderBy: { scoreRatio: 'desc' },
    take: 5000,
    select: { ticker: true, scoreRatio: true, lastScoredAt: true, updatedAt: true },
  });

  // Hubs secteur : un par secteur ayant au moins un ticker scoré (pages d'indexation/maillage).
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

  const staticBlocks = STATIC_PAGES.map((p) => buildStaticUrlBlock(p.path, p.changefreq, p.priority, lastmod));
  // Articles de blog (hreflang fr/en/es via ?lng). lastmod = date de mise à jour de l'article.
  const articleBlocks = listArticles().map((a) =>
    buildStaticUrlBlock(`/blog/${a.slug}`, 'monthly', 0.6, a.updated),
  );
  // Hubs : classements transverses (toujours présents) + un hub par secteur.
  const hubBlocks = [
    buildHubUrlBlock('/classement/qualite-10-sur-10', lastmod),
    buildHubUrlBlock('/classement/sous-evaluees', lastmod),
    ...sectorSlugs.map((slug) => buildHubUrlBlock(`/secteur/${slug}`, lastmod)),
  ];
  const tickerBlocks = tickers.map((t) => {
    // lastmod réel : dernière analyse (lastScoredAt) > updatedAt > date du jour.
    const tickerLastmod = (t.lastScoredAt ?? t.updatedAt)?.toISOString().slice(0, 10) ?? lastmod;
    return buildTickerUrlBlock(t.ticker, tickerLastmod, t.scoreRatio);
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...staticBlocks,
    ...articleBlocks,
    ...hubBlocks,
    ...tickerBlocks,
    '</urlset>',
  ].join('\n');
}

sitemapRouter.get(
  '/sitemap.xml',
  asyncHandler(async (_req: Request, res: Response) => {
    const now = Date.now();
    const cached = CACHE.get('default');
    let xml: string;
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      xml = cached.xml;
    } else {
      xml = await buildSitemap();
      CACHE.set('default', { xml, ts: now });
    }
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(xml);
  }),
);
