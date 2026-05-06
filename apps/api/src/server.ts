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
import { analyzeRouter } from './routes/analyze.js';
import { watchlistRouter } from './routes/watchlist.js';
import { timeseriesRouter } from './routes/timeseries.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/error.js';

const app: Express = express();
const PORT = Number(process.env.API_PORT ?? 3001);

// CORS : autorise le front Vite (5173 en dev)
app.use(cors({ origin: process.env.WEB_URL ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

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
      fmp: !!process.env.FMP_API_KEY,
      db: !!process.env.DATABASE_URL,
      sentry: !!process.env.SENTRY_DSN,
    },
  });
});

// Rate limit appliqué uniquement aux routes /api/*
app.use('/api', apiLimiter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/timeseries', timeseriesRouter);

// 404 fallback (avant l'error handler)
app.use((req, res) => {
  res.status(404).json({ error: 'Route inconnue', path: req.path });
});

// Error handler central — capture vers Sentry si init
app.use(errorHandler);

// On ne démarre le listener que hors tests (Vitest met NODE_ENV='test')
if (process.env.NODE_ENV !== 'test') {
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
