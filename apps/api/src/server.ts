/**
 * Express bootstrap — Lubin Investment API.
 *
 * Ordre des middlewares (important) :
 *   1. env (side effect : doit charger AVANT tout autre import qui lit process.env)
 *   2. Sentry init (idem)
 *   3. CORS + JSON parser
 *   4. Logging
 *   5. Rate limit global
 *   6. Routes
 *   7. 404
 *   8. Error handler (toujours en dernier)
 */
import './env.js';
import { initSentry, Sentry } from './lib/sentry.js';
initSentry();

import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { analyzeRouter } from './routes/analyze.js';
import { watchlistRouter } from './routes/watchlist.js';
import { timeseriesRouter } from './routes/timeseries.js';
import { pfcfHistoryRouter } from './routes/pfcfHistory.js';
import { cccHistoryRouter } from './routes/cccHistory.js';
import { cashRoceHistoryRouter } from './routes/cashRoceHistory.js';
import { priceHistoryRouter } from './routes/priceHistory.js';
import { screenerRouter } from './routes/screener.js';
import { portfolioRouter } from './routes/portfolio.js';
import { compareRouter } from './routes/compare.js';
import { authRouter } from './routes/auth.js';
import { sitemapRouter } from './routes/sitemap.js';
import { seoPrerenderRouter } from './routes/seoPrerender.js';
import { billingRouter, meRouter } from './routes/billing.js';
import { stripeWebhookRouter } from './routes/stripeWebhook.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/error.js';

const app: Express = express();
// Derrière le proxy Vercel : sans ça, req.ip = l'IP du proxy (identique pour tous),
// ce qui ferait dégénérer les rate-limiters par IP en limite GLOBALE. Avec trust proxy,
// req.ip = la vraie IP client (X-Forwarded-For) → rate-limit réellement par visiteur.
// N'affecte PAS le cookie auth (secure est basé sur l'env VERCEL, pas sur req.secure).
app.set('trust proxy', true);
const PORT = Number(process.env.API_PORT ?? 3001);

// CORS :
//   - dev local : Vite tourne sur 5173, l'API sur 3001 → origin distinct, on autorise explicitement
//   - Vercel prod : web + api servis sur le même domaine → same-origin, CORS n'a rien à faire.
//     On autorise quand même WEB_URL si défini (utile pour PR preview qui pointe vers prod).
//   - Vercel preview : VERCEL_URL = le domaine de la preview courante
const allowedOrigins = [
  process.env.WEB_URL ?? 'http://localhost:5173',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
].filter((o): o is string => !!o);
// credentials:true → autorise le navigateur à envoyer le cookie auth en cross-origin (dev local).
// En prod Vercel (same-origin), c'est neutre — le cookie passerait de toute façon.
app.use(cors({
  origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
  credentials: true,
}));
// ⚠️ Webhook Stripe AVANT express.json() — la signature est calculée sur le RAW body.
// Si on parse en JSON avant, la signature ne matchera jamais et tous les events seront
// rejetés en 400. Le router monte sa propre middleware express.raw() pour cette route.
app.use('/api', stripeWebhookRouter);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Logging minimal
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health-check (PAS de rate limit dessus)
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'lubin-investment-api',
    version: '0.1.0',
    env: {
      node: process.version,
      openai: !!process.env.OPENAI_API_KEY,
      finnhub: !!process.env.FINNHUB_API_KEY,
      db: !!process.env.DATABASE_URL,
      auth: !!process.env.AUTH_SECRET,
      sentry: !!process.env.SENTRY_DSN,
    },
  });
});

// Rate limit appliqué uniquement aux routes /api/*
app.use('/api', apiLimiter);
app.use('/api/auth', authRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/timeseries', timeseriesRouter);
app.use('/api/pfcf-history', pfcfHistoryRouter);
app.use('/api/ccc-history', cccHistoryRouter);
app.use('/api/cash-roce-history', cashRoceHistoryRouter);
app.use('/api/price-history', priceHistoryRouter);
app.use('/api/screener', screenerRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/compare', compareRouter);
app.use('/api/billing', billingRouter);
app.use('/api/me', meRouter);

// Sitemap dynamique — accessible à DEUX chemins :
//   - /api/sitemap.xml      (chemin direct, utile en dev local sans rewrite)
//   - /sitemap.xml          (chemin canonique SEO, le rewrite Vercel envoie la requête
//                            à la lambda `api/[...all]` qui reçoit le path original)
// Vercel ne chaîne PAS les rewrites : un rewrite /sitemap.xml → /api/sitemap.xml ne
// re-déclenche pas la règle /api/(.*) → /api/[...all]. On rewrite donc directement
// vers /api/[...all] côté vercel.json et on monte le router aux deux niveaux ici.
app.use('/api', sitemapRouter);
app.use('/', sitemapRouter);

// Dynamic Rendering — pré-rendu HTML SEO pour les bots sur /analyse/:ticker.
// Vercel route les requêtes vers cette lambda UNIQUEMENT si le User-Agent matche
// un crawler connu (rewrite conditionnel `has` dans vercel.json). Les humains
// continuent à atterrir sur la SPA via le rewrite catch-all → index.html.
// Monté à la racine + sur /api pour couvrir les deux chemins possibles (selon
// que Vercel route via /api/[...all] ou directement).
app.use('/', seoPrerenderRouter);
app.use('/api', seoPrerenderRouter);

// 404 fallback (avant l'error handler)
app.use((req, res) => {
  res.status(404).json({ error: 'Route inconnue', path: req.path });
});

// Error handler central — capture vers Sentry si init
app.use(errorHandler);

// On ne démarre le listener QUE si on tourne en standalone (dev local, Docker, VPS…).
// Conditions de skip :
//   - NODE_ENV=test    → Vitest charge l'app sans bind de port
//   - VERCEL=1         → runtime serverless : Vercel route lui-même les requêtes vers l'export
const isStandalone = process.env.NODE_ENV !== 'test' && !process.env.VERCEL;
if (isStandalone) {
  const server = app.listen(PORT, () => {
    console.log(`✓ Lubin Investment API → http://localhost:${PORT}`);
    console.log(`  Health → http://localhost:${PORT}/health`);
  });

  // Graceful shutdown (utile en prod sous Docker)
  const shutdown = (signal: string) => {
    console.log(`\n${signal} reçu — arrêt propre`);
    server.close(() => {
      Sentry.close(2000).finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export { app };
export default app;
