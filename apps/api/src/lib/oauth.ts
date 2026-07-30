/**
 * OAuth 2.1 — helpers crypto & tokens pour le serveur d'autorisation MCP.
 *
 * Choix techniques :
 *   - Access token MCP = JWT HS256 court (1 h), NON stocké en DB (stateless).
 *     Sa clé de signature DÉRIVE d'AUTH_SECRET mais lui est distincte
 *     (`AUTH_SECRET + '::mcp-access-v1'`) → séparation de domaine : un cookie de
 *     session web ne peut pas être présenté comme un access token MCP, et
 *     inversement. Zéro variable d'env supplémentaire à provisionner.
 *   - Refresh token = valeur opaque aléatoire, stockée HASHÉE (sha256) en DB,
 *     révocable et à rotation.
 *   - PKCE S256 obligatoire (OAuth 2.1 : "plain" interdit).
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

/** Scope unique en v1 — le gating Pro/membre est fait côté serveur (isProActive), pas via le scope. */
export const MCP_SCOPES = ['mcp'] as const;
export const DEFAULT_SCOPE = 'mcp';

export const MCP_ACCESS_TTL_SEC = 60 * 60; // 1 h
export const AUTH_CODE_TTL_SEC = 10 * 60; // 10 min
export const REFRESH_TTL_SEC = 60 * 60 * 24 * 60; // 60 j

/** Clé de signature des access tokens MCP — dérivée d'AUTH_SECRET, domaine séparé. */
function getMcpSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET manquant ou trop court (< 32 chars) — requis pour signer les tokens MCP.');
  }
  return secret + '::mcp-access-v1';
}

export interface McpAccessClaims {
  /** userId Lubin Investment. */
  sub: string;
  email: string;
  scope: string;
  /** Resource indicator (l'URL du MCP) — RFC 8707. */
  aud: string;
}

export function signMcpAccessToken(claims: McpAccessClaims): string {
  return jwt.sign(claims, getMcpSecret(), { expiresIn: MCP_ACCESS_TTL_SEC, algorithm: 'HS256' });
}

export function verifyMcpAccessToken(token: string): McpAccessClaims | null {
  try {
    const d = jwt.verify(token, getMcpSecret(), { algorithms: ['HS256'] });
    if (typeof d !== 'object' || d === null) return null;
    const { sub, email, scope, aud } = d as Record<string, unknown>;
    if (typeof sub !== 'string' || typeof email !== 'string') return null;
    return {
      sub,
      email,
      scope: typeof scope === 'string' ? scope : '',
      aud: typeof aud === 'string' ? aud : '',
    };
  } catch {
    return null;
  }
}

/** Token opaque (code d'autorisation, refresh token) — 32 octets en base64url. */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** sha256 en hex — pour stocker les refresh tokens sans les garder en clair. */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * PKCE — vérifie `code_verifier` contre `code_challenge` (S256 uniquement).
 * Comparaison à temps constant pour éviter les attaques par timing.
 */
export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  const computed = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const a = Buffer.from(computed);
  const b = Buffer.from(codeChallenge);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Domaine de production — repli identique à celui du service Stripe. */
const PRODUCTION_BASE_URL = 'https://lubin-investment.com';

/** `true` si la base URL vient d'une source de confiance (env), pas des headers client. */
export function hasTrustedBaseUrl(): boolean {
  return !!(process.env.SITE_URL || process.env.PUBLIC_BASE_URL) || isDeployed();
}

function isDeployed(): boolean {
  return !!process.env.VERCEL || process.env.NODE_ENV === 'production';
}

/**
 * Base URL publique du serveur (= issuer OAuth, et audience des tokens).
 *
 * ⚠ SÉCURITÉ : cette valeur est publiée dans les métadonnées de découverte
 * (`authorization_endpoint`, `token_endpoint`…). La dériver du header `Host` en
 * production permettrait à un attaquant d'envoyer `Host: evil.com` et de faire
 * annoncer SES endpoints à un client qui découvre le serveur → vol de code
 * d'autorisation. On ne fait donc confiance aux headers QUE hors déploiement :
 *   1. SITE_URL / PUBLIC_BASE_URL si configurés,
 *   2. sinon, en déploiement, le domaine de production en dur,
 *   3. sinon (dev local uniquement), les headers de la requête.
 */
export function getBaseUrl(req: { protocol?: string; get(name: string): string | undefined }): string {
  const env = (process.env.SITE_URL || process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (env) return env;
  if (isDeployed()) return PRODUCTION_BASE_URL;
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3001';
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  return `${proto}://${host}`;
}

/** URL canonique de la resource MCP (audience des tokens). */
export function mcpResourceUrl(baseUrl: string): string {
  return `${baseUrl}/api/mcp`;
}
