/**
 * Rate limiters Express — protègent les routes contre les abus côté client.
 * Distinct des limiteurs OUTBOUND (lib/limiter.ts) qui protègent les fournisseurs externes.
 */
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

/**
 * En tests on désactive tous les limiters (NODE_ENV=test).
 * Sinon les suites Vitest qui multiplient les POST /signup ou /login
 * exploseraient le quota et masqueraient les vraies erreurs métier.
 */
const SKIP_IN_TESTS = process.env.NODE_ENV === 'test';

const handler = (label: string, limit: number): RateLimitRequestHandler => rateLimit({
  windowMs: 60_000,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // trust proxy est activé (Vercel) → on désactive la validation "permissive trust proxy"
  // d'express-rate-limit (un simple warning console, sans incidence sur le keying par IP).
  validate: { trustProxy: false },
  message: { error: `Trop de requêtes — réessaie dans une minute.`, scope: label },
  skip: () => SKIP_IN_TESTS,
});

/**
 * Global (toutes routes /api/*) — 1000 req/min/IP.
 *
 * Mono-utilisateur (toi en local) : 1000 est très large, le but est d'attraper les boucles infinies.
 *
 * On EXCLUE :
 *   • GET /api/watchlist        : read idempotent, lu à l'ouverture de chaque page
 *   • GET /api/timeseries       : majoritairement cached, lu à chaque ouverture d'histogramme
 *   • Toutes les autres routes restent throttlées (POST analyze, POST watchlist refresh, etc.)
 *
 * Les vrais coûts sont protégés par les limiters outbound (Bottleneck Finnhub/Yahoo/OpenAI)
 * et le cache earnings-aware — donc même 1000 req/min ne peut pas saturer les APIs externes.
 */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // trust proxy est activé (Vercel) → on désactive la validation "permissive trust proxy"
  // d'express-rate-limit (un simple warning console, sans incidence sur le keying par IP).
  validate: { trustProxy: false },
  message: { error: `Trop de requêtes — réessaie dans une minute.`, scope: 'global' },
  skip: (req) => {
    if (SKIP_IN_TESTS) return true;
    if (req.method !== 'GET') return false;
    // Les reads idempotents : pas de coût significatif, pas besoin de throttle
    if (req.path.startsWith('/api/watchlist')) return true;
    if (req.path.startsWith('/api/timeseries')) return true;
    return false;
  },
});

/** /analyze : coûteux (appel GPT) — 20/min/IP (gros marge avec le cache) */
export const analyzeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // trust proxy est activé (Vercel) → on désactive la validation "permissive trust proxy"
  // d'express-rate-limit (un simple warning console, sans incidence sur le keying par IP).
  validate: { trustProxy: false },
  message: { error: 'Trop d\'analyses récentes — patiente 1 minute.', scope: 'analyze' },
  skip: () => SKIP_IN_TESTS,
});

/** /watchlist mutations — 60/min/IP */
export const watchlistMutateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // trust proxy est activé (Vercel) → on désactive la validation "permissive trust proxy"
  // d'express-rate-limit (un simple warning console, sans incidence sur le keying par IP).
  validate: { trustProxy: false },
  message: { error: 'Trop de modifications de watchlist — patiente.', scope: 'watchlist' },
  skip: () => SKIP_IN_TESTS,
});

/**
 * Enregistrement dynamique de clients OAuth (RFC 7591) — 20/min/IP.
 * L'endpoint est NON authentifié par nature (le host MCP s'enregistre seul) et écrit en
 * DB : sans plafond serré, n'importe qui peut faire grossir la table OAuthClient.
 */
export const oauthRegisterLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: 'Trop d\'enregistrements de clients — patiente 1 minute.', scope: 'oauth-register' },
  skip: () => SKIP_IN_TESTS,
});

/**
 * Échange de tokens OAuth — 60/min/IP.
 * Plus permissif que le login (un client légitime rafraîchit son token régulièrement),
 * mais borné : le /token teste des secrets (code, code_verifier, refresh_token).
 */
export const oauthTokenLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: 'Trop de requêtes de token — patiente 1 minute.', scope: 'oauth-token' },
  skip: () => SKIP_IN_TESTS,
});

/**
 * Endpoint MCP (/api/mcp) — 120/min/IP.
 * Un client MCP est bavard (plusieurs tool calls par tour de conversation), mais chaque
 * appel peut déclencher un compute lourd (analyze_watchlist). Plafond intermédiaire :
 * confortable pour un usage humain, casse une boucle d'agent emballée.
 */
export const mcpLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: 'Trop de requêtes MCP — patiente 1 minute.', scope: 'mcp' },
  skip: () => SKIP_IN_TESTS,
});

/**
 * /ai-visibility — 12/min/IP.
 *
 * Endpoint public SANS compte : c'est l'outil d'acquisition, il doit rester sans friction.
 * Mais chaque appel déclenche DEUX requêtes HTTP sortantes vers une URL fournie par
 * l'utilisateur — donc c'est aussi un amplificateur potentiel (on fait requêter notre
 * infra à la place de l'appelant). 12/min laisse un humain enchaîner ses pages et rend
 * l'usage en proxy de scan inintéressant. La garde SSRF est dans lib/aiVisibility.ts.
 */
export const aiVisibilityLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: 'Trop de vérifications — patiente une minute.', scope: 'ai-visibility' },
  skip: () => SKIP_IN_TESTS,
});

/**
 * /auth signup/login — 10/min/IP.
 * Limite serrée pour casser les attaques brute-force sans gêner un humain qui se trompe.
 * ⚠ À appliquer sur TOUT endpoint qui vérifie un mot de passe, y compris le POST
 * /api/oauth/authorize du serveur d'autorisation MCP (sinon il devient un contournement).
 */
export const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // trust proxy est activé (Vercel) → on désactive la validation "permissive trust proxy"
  // d'express-rate-limit (un simple warning console, sans incidence sur le keying par IP).
  validate: { trustProxy: false },
  message: { error: 'Trop de tentatives — patiente 1 minute.', scope: 'auth' },
  skip: () => SKIP_IN_TESTS,
});
