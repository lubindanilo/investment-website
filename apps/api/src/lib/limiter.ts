/**
 * Outbound rate limiters (Bottleneck) — un par fournisseur API.
 * Évite de cramer la quota gratuite en cas de batch (refresh watchlist, etc.).
 *
 * Finnhub free   : 60 req/min  → on impose 50/min + maxConcurrent 5 (marge de sécurité)
 * FMP free       : 250 req/jour, mais on évite les bursts → 30/min
 * OpenAI Tier 1+ : ~500 req/min — 60/min suffit largement pour nous
 */
import Bottleneck from 'bottleneck';

export const finnhubLimiter = new Bottleneck({
  reservoir: 50,
  reservoirRefreshAmount: 50,
  reservoirRefreshInterval: 60_000,
  maxConcurrent: 5,
});

export const fmpLimiter = new Bottleneck({
  reservoir: 30,
  reservoirRefreshAmount: 30,
  reservoirRefreshInterval: 60_000,
  maxConcurrent: 3,
});

export const openaiLimiter = new Bottleneck({
  reservoir: 60,
  reservoirRefreshAmount: 60,
  reservoirRefreshInterval: 60_000,
  maxConcurrent: 3,
});

/**
 * Yahoo Finance n'a pas de quota officiel mais throttle agressivement si on burst.
 * 30/min avec concurrence 3 est une marge raisonnable.
 */
export const yahooLimiter = new Bottleneck({
  reservoir: 30,
  reservoirRefreshAmount: 30,
  reservoirRefreshInterval: 60_000,
  maxConcurrent: 3,
});

// Pour logguer les saturations en dev
[finnhubLimiter, fmpLimiter, openaiLimiter, yahooLimiter].forEach(l => {
  l.on('depleted', () => console.warn('[limiter] reservoir empty — requests will queue'));
  l.on('error', (e) => console.error('[limiter] error', e));
});
