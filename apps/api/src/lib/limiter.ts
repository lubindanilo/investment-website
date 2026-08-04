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
 *
 * ⚠️ Ce réservoir est PAR PROCESS. Sur Vercel, chaque instance de lambda s'accorde donc ses propres
 * 30 req/min : le débit sortant réel est un multiple inconnu de 30, et c'est ce burst qui faisait
 * throttler Yahoo (cf. PR #147). Un process unique (le drain nocturne sur runner) est le seul cas où
 * le chiffre est honnête, et c'est donc aussi celui où il devient le PLAFOND DE DÉBIT : ~8 requêtes
 * par titre non-US, soit ~4 titres/min au mieux, à partager entre les workers.
 *
 * `YAHOO_RPM` permet de relever ce plafond pour ce process-là seulement (variable du workflow de
 * drain), sans toucher au réglage de l'app. À ne monter qu'avec une mesure en main : le throttle
 * Yahoo est la panne qu'on vient de faire disparaître.
 */
const YAHOO_RPM = Math.max(1, Number(process.env.YAHOO_RPM) || 30);
export const yahooLimiter = new Bottleneck({
  reservoir: YAHOO_RPM,
  reservoirRefreshAmount: YAHOO_RPM,
  reservoirRefreshInterval: 60_000,
  maxConcurrent: 3,
});

// Pour logguer les saturations en dev
[finnhubLimiter, fmpLimiter, openaiLimiter, yahooLimiter].forEach(l => {
  l.on('depleted', () => console.warn('[limiter] reservoir empty — requests will queue'));
  l.on('error', (e) => console.error('[limiter] error', e));
});
