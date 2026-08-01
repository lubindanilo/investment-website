/**
 * /api/oauth — Serveur d'autorisation OAuth 2.1 pour le connecteur MCP (claude.ai).
 *
 * Endpoints :
 *   POST /api/oauth/register     → Dynamic Client Registration (RFC 7591)
 *   GET  /api/oauth/authorize    → page login + consentement (Authorization Code + PKCE)
 *   POST /api/oauth/authorize    → traite la décision, émet le code, redirige
 *   POST /api/oauth/token        → échange code→tokens, et refresh→tokens
 *
 * Les métadonnées de découverte (.well-known/*) sont servies par `wellKnownRouter`
 * (monté à la racine dans server.ts).
 *
 * Sécurité :
 *   - PKCE S256 OBLIGATOIRE (pas de "plain").
 *   - redirect_uri en allowlist STRICTE (match exact), validé AVANT toute redirection.
 *   - Codes d'autorisation à usage unique (consumedAt) + TTL court, anti-double-spend
 *     par UPDATE conditionnel atomique.
 *   - Refresh tokens stockés hashés, à rotation.
 *   - Aucune valeur non échappée injectée dans le HTML de la page de consentement.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import express from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { asyncHandler } from '../middleware/error.js';
import { authLimiter, oauthRegisterLimiter, oauthTokenLimiter } from '../middleware/rateLimit.js';
import { verifyPassword } from '../lib/auth.js';
import {
  DEFAULT_SCOPE,
  MCP_SCOPES,
  AUTH_CODE_TTL_SEC,
  REFRESH_TTL_SEC,
  MCP_ACCESS_TTL_SEC,
  randomToken,
  sha256,
  signMcpAccessToken,
  verifyPkceS256,
  getBaseUrl,
  mcpResourceUrl,
} from '../lib/oauth.js';

export const oauthRouter: Router = Router();

// Le token endpoint reçoit de l'application/x-www-form-urlencoded (norme OAuth) ;
// le global express.json() couvre déjà le JSON de /register.
oauthRouter.use(express.urlencoded({ extended: true }));

// CORS permissif pour les endpoints OAuth : ils sont appelés par le host MCP
// (claude.ai) et n'utilisent PAS le cookie de session → pas de credentials.
// On écrase l'origine restreinte posée par le cors() global.
oauthRouter.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.removeHeader('Access-Control-Allow-Credentials');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────────────────────────────────────

/**
 * En-têtes de la page de consentement : interdit l'affichage en iframe (une page de
 * login encadrée par un site tiers est un vecteur de détournement de clic) et le cache.
 */
function consentSecurityHeaders(res: Response): void {
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Réponse d'erreur OAuth normalisée (RFC 6749 §5.2). */
function oauthError(res: Response, status: number, error: string, description?: string): void {
  res.status(status)
    .setHeader('Cache-Control', 'no-store')
    .json({ error, ...(description ? { error_description: description } : {}) });
}

/** Un redirect_uri est-il autorisé pour ce client ? Match exact contre l'allowlist. */
function redirectAllowed(client: { redirectUris: unknown }, uri: string): boolean {
  const list = Array.isArray(client.redirectUris) ? (client.redirectUris as unknown[]) : [];
  return list.includes(uri);
}

/** http autorisé uniquement pour localhost (dev) ; https partout ailleurs. */
function isValidRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.protocol === 'https:') return true;
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true;
    return false;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /register — Dynamic Client Registration (RFC 7591)
// ─────────────────────────────────────────────────────────────────────────────

// Bornes strictes : l'endpoint est NON authentifié et persiste ce qu'il reçoit. Sans
// plafond sur le tableau, un `POST /register` d'1 Mo de redirect_uris écrit directement
// en base (table sans TTL ni purge) → épuisement du stockage Neon.
const registerSchema = z.object({
  redirect_uris: z.array(z.string().max(500)).min(1).max(5),
  client_name: z.string().max(200).optional(),
  grant_types: z.array(z.string().max(60)).max(10).optional(),
  response_types: z.array(z.string().max(60)).max(10).optional(),
  token_endpoint_auth_method: z.string().max(60).optional(),
  scope: z.string().max(200).optional(),
});

oauthRouter.post('/register', oauthRegisterLimiter, asyncHandler(async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    oauthError(res, 400, 'invalid_client_metadata', 'redirect_uris requis (tableau non vide).');
    return;
  }
  const meta = parsed.data;

  if (!meta.redirect_uris.every(isValidRedirectUri)) {
    oauthError(res, 400, 'invalid_redirect_uri', 'Chaque redirect_uri doit être https (ou http://localhost en dev).');
    return;
  }

  const grantTypes = meta.grant_types?.length ? meta.grant_types : ['authorization_code', 'refresh_token'];
  const responseTypes = meta.response_types?.length ? meta.response_types : ['code'];
  const authMethod = meta.token_endpoint_auth_method || 'none';

  const client = await prisma.oAuthClient.create({
    data: {
      clientName: meta.client_name ?? null,
      redirectUris: meta.redirect_uris,
      grantTypes,
      responseTypes,
      tokenEndpointAuthMethod: authMethod,
      scope: meta.scope ?? DEFAULT_SCOPE,
    },
  });

  res.status(201)
    .setHeader('Cache-Control', 'no-store')
    .json({
      client_id: client.id,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      redirect_uris: meta.redirect_uris,
      grant_types: grantTypes,
      response_types: responseTypes,
      token_endpoint_auth_method: authMethod,
      scope: client.scope,
      // Client public (PKCE) : pas de client_secret.
    });
}));

// ─────────────────────────────────────────────────────────────────────────────
// GET /authorize — page login + consentement
// ─────────────────────────────────────────────────────────────────────────────

interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
}

function readAuthorizeParams(src: Record<string, unknown>): AuthorizeParams {
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  return {
    clientId: str(src.client_id),
    redirectUri: str(src.redirect_uri),
    scope: str(src.scope) || DEFAULT_SCOPE,
    state: str(src.state),
    codeChallenge: str(src.code_challenge),
    codeChallengeMethod: str(src.code_challenge_method) || 'S256',
    resource: str(src.resource),
  };
}

/**
 * Le scope demandé doit être un sous-ensemble de ceux que ce serveur émet. Sans ce
 * filtre, un client peut demander n'importe quelle chaîne (`scope=admin`), qui serait
 * stockée puis signée dans le token : le premier contrôle qui s'y fierait hériterait
 * d'une élévation de privilège. On refuse au lieu de tronquer silencieusement.
 */
function scopeIsAllowed(scope: string): boolean {
  const asked = scope.split(/\s+/).filter(Boolean);
  return asked.length > 0 && asked.every(s => (MCP_SCOPES as readonly string[]).includes(s));
}

/**
 * Le `resource` (RFC 8707) devient l'audience du token : il doit désigner CE serveur.
 * Vide = on prendra notre propre ressource par défaut à l'émission.
 */
function resourceIsAllowed(resource: string, baseUrl: string): boolean {
  return !resource || resource === mcpResourceUrl(baseUrl);
}

function renderConsentPage(p: AuthorizeParams, clientName: string, opts: { error?: string } = {}): string {
  const hidden = (name: string, value: string) =>
    `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`;
  // ⚠ Le nom du client est choisi librement par celui qui s'enregistre (l'enregistrement
  // dynamique est ouvert) : il peut donc usurper « Lubin Investment ». Le domaine de
  // destination du code était le seul élément non falsifiable affiché à l'utilisateur ; son
  // retrait est un choix produit assumé (bandeau jugé trop intrusif). Cf. docs/mcp/WORKLOG.md.
  const errorBlock = opts.error
    ? `<p class="err">${escapeHtml(opts.error)}</p>`
    : '';
  // Les tokens ci-dessous sont RECOPIÉS de apps/web/src/styles/global.css (:root) afin que
  // cette page, rendue par l'API hors du bundle de la SPA, soit visuellement identique au
  // site. À resynchroniser si la palette de la marque évolue.
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<meta name="theme-color" content="#0b0d10" />
<title>Autoriser l'accès · Lubin Investment</title>
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  :root {
    color-scheme: light;
    --bg: oklch(0.985 0.004 270);
    --surface: oklch(1 0 0);
    --surface-2: oklch(0.984 0.004 270);
    --line: oklch(0.922 0.006 270);
    --border-strong: oklch(0.88 0.006 270);
    --ink: oklch(0.245 0.013 274);
    --ink-2: oklch(0.475 0.012 273);
    --ink-3: oklch(0.62 0.011 273);
    --brand: oklch(0.515 0.193 277);
    --brand-press: oklch(0.455 0.188 277);
    --brand-soft: oklch(0.95 0.035 277);
    --brand-ink: oklch(0.42 0.18 277);
    --brand-dim: oklch(0.515 0.193 277 / 0.18);
    --warn-bg: oklch(0.965 0.05 78);
    --warn-ink: oklch(0.55 0.12 64);
    --bad-bg: oklch(0.962 0.035 26);
    --bad-ink: oklch(0.52 0.19 27);
    --r-xs: 6px; --r-sm: 9px; --r-lg: 18px;
    --sh-sm: 0 1px 2px oklch(0.3 0.02 274 / 0.05), 0 2px 6px oklch(0.3 0.02 274 / 0.05);
    --sh-lg: 0 8px 18px oklch(0.3 0.02 274 / 0.07), 0 28px 60px oklch(0.3 0.02 274 / 0.13);
    --sans: "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: var(--sans); background: var(--bg); color: var(--ink);
    font-size: 14px; line-height: 1.5; letter-spacing: -0.01em;
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  }
  body { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
  .wrap { width: 100%; max-width: 440px; }
  .brand {
    display: flex; align-items: center; justify-content: center; gap: 9px;
    margin-bottom: 20px; font-weight: 800; font-size: 15px; letter-spacing: -0.02em;
  }
  .brand-mark {
    width: 26px; height: 26px; border-radius: var(--r-xs);
    background: var(--brand); color: #fff;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 800;
  }
  .card {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--r-lg); box-shadow: var(--sh-lg); padding: 32px 30px;
  }
  h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.025em; margin-bottom: 8px; }
  .sub { font-size: 14.5px; color: var(--ink-2); margin-bottom: 20px; }
  .client { font-weight: 700; color: var(--brand-ink); }
  .err {
    background: var(--bad-bg); color: var(--bad-ink); font-weight: 600;
    border-radius: var(--r-sm); padding: 10px 13px; font-size: 13px; margin-bottom: 16px;
  }
  label { display: block; font-size: 13px; font-weight: 600; color: var(--ink-2); margin-bottom: 6px; }
  .field { margin-bottom: 16px; }
  .input {
    width: 100%; background: var(--surface); border: 1px solid var(--border-strong);
    border-radius: var(--r-xs); padding: 12px 16px; font-size: 14px;
    font-family: inherit; color: var(--ink); outline: none;
    transition: border-color .15s, box-shadow .15s; box-shadow: var(--sh-sm);
  }
  .input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-dim); }
  /* L'ordre DOM des boutons est dicté par la touche Entrée (cf. commentaire dans le
     formulaire) ; la propriété order rétablit l'ordre visuel attendu : Refuser à gauche. */
  .actions { display: flex; gap: 10px; margin-top: 24px; }
  .act-deny { order: 1; }
  .act-allow { order: 2; }
  .btn {
    flex: 1; border-radius: var(--r-xs); padding: 12px 22px; font-size: 13px;
    font-weight: 600; font-family: inherit; cursor: pointer; transition: all .15s;
  }
  .btn-primary { background: var(--brand); color: #fff; border: none; }
  .btn-primary:hover { background: var(--brand-press); }
  .btn-secondary { background: var(--surface); color: var(--ink); border: 1px solid var(--border-strong); }
  .btn-secondary:hover { border-color: var(--brand); color: var(--brand); }
  @media (max-width: 480px) {
    .card { padding: 26px 20px; }
    h1 { font-size: 21px; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand"><span class="brand-mark">L</span>Lubin Investment</div>
    <div class="card">
      <h1>Autoriser l'accès</h1>
      <p class="sub"><span class="client">${escapeHtml(clientName || 'Une application')}</span> demande à accéder à ton compte Lubin Investment.</p>
      ${errorBlock}
      <form method="post" action="/api/oauth/authorize">
        ${hidden('client_id', p.clientId)}
        ${hidden('redirect_uri', p.redirectUri)}
        ${hidden('scope', p.scope)}
        ${hidden('state', p.state)}
        ${hidden('code_challenge', p.codeChallenge)}
        ${hidden('code_challenge_method', p.codeChallengeMethod)}
        ${hidden('resource', p.resource)}
        <div class="field">
          <label for="email">Email</label>
          <input class="input" id="email" type="email" name="email" autocomplete="username" autofocus required />
        </div>
        <div class="field">
          <label for="password">Mot de passe</label>
          <input class="input" id="password" type="password" name="password" autocomplete="current-password" required />
        </div>
        <div class="actions">
          <!-- ⚠ ORDRE DOM VOLONTAIRE : « Autoriser » est le PREMIER bouton submit du
               formulaire, car un navigateur qui soumet via la touche Entrée (réflexe après
               avoir tapé son mot de passe) déclenche le premier submit rencontré. Avec
               « Refuser » en premier, appuyer sur Entrée renvoyait access_denied.
               L'ordre VISUEL (Refuser à gauche) est rétabli par la propriété CSS order. -->
          <button class="btn btn-primary act-allow" type="submit" name="decision" value="allow">Autoriser</button>
          <button class="btn btn-secondary act-deny" type="submit" name="decision" value="deny">Refuser</button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>`;
}

oauthRouter.get('/authorize', asyncHandler(async (req: Request, res: Response) => {
  const p = readAuthorizeParams(req.query as Record<string, unknown>);
  const responseType = typeof req.query.response_type === 'string' ? req.query.response_type : '';

  // 1) Validation du client + redirect_uri AVANT toute redirection (sinon page d'erreur).
  if (!p.clientId) {
    res.status(400).type('html').send('<p>Paramètre client_id manquant.</p>');
    return;
  }
  const client = await prisma.oAuthClient.findUnique({ where: { id: p.clientId } });
  if (!client) {
    res.status(400).type('html').send('<p>Client OAuth inconnu.</p>');
    return;
  }
  if (!p.redirectUri || !redirectAllowed(client, p.redirectUri)) {
    res.status(400).type('html').send('<p>redirect_uri non autorisé pour ce client.</p>');
    return;
  }

  // 2) À partir d'ici, redirect_uri est sûr → on peut renvoyer les erreurs par redirection.
  const redirectError = (error: string, description?: string) => {
    const u = new URL(p.redirectUri);
    u.searchParams.set('error', error);
    if (description) u.searchParams.set('error_description', description);
    if (p.state) u.searchParams.set('state', p.state);
    res.redirect(u.toString());
  };

  if (responseType !== 'code') {
    redirectError('unsupported_response_type', 'Seul response_type=code est supporté.');
    return;
  }
  if (!p.codeChallenge) {
    redirectError('invalid_request', 'PKCE requis (code_challenge manquant).');
    return;
  }
  if (p.codeChallengeMethod !== 'S256') {
    redirectError('invalid_request', 'code_challenge_method doit être S256.');
    return;
  }
  if (!scopeIsAllowed(p.scope)) {
    redirectError('invalid_scope', `Scopes supportés : ${MCP_SCOPES.join(', ')}.`);
    return;
  }
  if (!resourceIsAllowed(p.resource, getBaseUrl(req))) {
    redirectError('invalid_target', 'resource ne désigne pas ce serveur MCP.');
    return;
  }

  consentSecurityHeaders(res);
  res.status(200).type('html').send(renderConsentPage(p, client.clientName ?? ''));
}));

// ─────────────────────────────────────────────────────────────────────────────
// POST /authorize — décision de l'utilisateur (login + consentement)
// ─────────────────────────────────────────────────────────────────────────────

// ⚠ authLimiter : ce handler vérifie un mot de passe. Sans lui, il offrirait un
// contournement du plafond anti-brute-force de POST /api/auth/login (10/min).
oauthRouter.post('/authorize', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const p = readAuthorizeParams(body);
  const decision = typeof body.decision === 'string' ? body.decision : '';
  const email = (typeof body.email === 'string' ? body.email : '').trim().toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  const client = await prisma.oAuthClient.findUnique({ where: { id: p.clientId } });
  if (!client || !p.redirectUri || !redirectAllowed(client, p.redirectUri)) {
    res.status(400).type('html').send('<p>Requête d\'autorisation invalide.</p>');
    return;
  }

  const redirectWith = (params: Record<string, string>) => {
    const u = new URL(p.redirectUri);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    if (p.state) u.searchParams.set('state', p.state);
    res.redirect(u.toString());
  };

  if (decision !== 'allow') {
    redirectWith({ error: 'access_denied' });
    return;
  }
  // Revalidation complète : ce POST est atteignable directement, sans passer par le GET.
  if (!p.codeChallenge || p.codeChallengeMethod !== 'S256') {
    redirectWith({ error: 'invalid_request', error_description: 'PKCE S256 requis.' });
    return;
  }
  if (!scopeIsAllowed(p.scope)) {
    redirectWith({ error: 'invalid_scope', error_description: `Scopes supportés : ${MCP_SCOPES.join(', ')}.` });
    return;
  }
  if (!resourceIsAllowed(p.resource, getBaseUrl(req))) {
    redirectWith({ error: 'invalid_target', error_description: 'resource ne désigne pas ce serveur MCP.' });
    return;
  }

  // Authentification : identifiants Lubin Investment (réutilise le bcrypt existant).
  // On compare TOUJOURS un hash, même si l'email est inconnu : sans ça, la réponse est
  // beaucoup plus rapide pour un email inexistant → énumération des comptes par timing.
  // Même parade que POST /api/auth/login.
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const hashToCompare = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalid.';
  const ok = await verifyPassword(password, hashToCompare);
  if (!user || !ok) {
    consentSecurityHeaders(res);
    res
      .status(401)
      .type('html')
      .send(renderConsentPage(p, client.clientName ?? '', { error: 'Email ou mot de passe incorrect.' }));
    return;
  }

  // Émission du code d'autorisation (usage unique, court).
  const code = randomToken(32);
  await prisma.oAuthAuthCode.create({
    data: {
      code,
      clientId: client.id,
      userId: user.id,
      redirectUri: p.redirectUri,
      scope: p.scope,
      codeChallenge: p.codeChallenge,
      codeChallengeMethod: 'S256',
      resource: p.resource || null,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SEC * 1000),
    },
  });

  redirectWith({ code });
}));

// ─────────────────────────────────────────────────────────────────────────────
// POST /token — échange code→tokens, et refresh→tokens
// ─────────────────────────────────────────────────────────────────────────────

oauthRouter.post('/token', oauthTokenLimiter, asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const grantType = str(body.grant_type);
  const baseUrl = getBaseUrl(req);

  if (grantType === 'authorization_code') {
    const code = str(body.code);
    const redirectUri = str(body.redirect_uri);
    const clientId = str(body.client_id);
    const codeVerifier = str(body.code_verifier);

    if (!code || !clientId || !codeVerifier) {
      oauthError(res, 400, 'invalid_request', 'code, client_id et code_verifier requis.');
      return;
    }

    const row = await prisma.oAuthAuthCode.findUnique({ where: { code } });
    if (!row || row.consumedAt || row.expiresAt.getTime() < Date.now()) {
      oauthError(res, 400, 'invalid_grant', 'Code invalide, expiré ou déjà utilisé.');
      return;
    }

    // On CONSOMME avant de valider : un échange raté (mauvais client, mauvais PKCE) est
    // le signe que le code a fuité. Le brûler immédiatement évite qu'il reste rejouable
    // pendant le reste de sa TTL. C'est aussi l'anti-double-spend atomique : deux lambdas
    // concurrentes ne peuvent pas gagner toutes les deux (UPDATE conditionnel).
    const claimed = await prisma.oAuthAuthCode.updateMany({
      where: { code, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) {
      oauthError(res, 400, 'invalid_grant', 'Code déjà utilisé.');
      return;
    }

    if (row.clientId !== clientId || row.redirectUri !== redirectUri) {
      oauthError(res, 400, 'invalid_grant', 'client_id ou redirect_uri ne correspond pas au code.');
      return;
    }
    if (!verifyPkceS256(codeVerifier, row.codeChallenge)) {
      oauthError(res, 400, 'invalid_grant', 'Échec de la vérification PKCE.');
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: row.userId }, select: { id: true, email: true } });
    if (!user) {
      oauthError(res, 400, 'invalid_grant', 'Utilisateur introuvable.');
      return;
    }

    const resource = row.resource || mcpResourceUrl(baseUrl);
    const scope = row.scope || DEFAULT_SCOPE;
    const accessToken = signMcpAccessToken({ sub: user.id, email: user.email, scope, aud: resource });
    const refresh = randomToken(48);
    await prisma.oAuthRefreshToken.create({
      data: {
        tokenHash: sha256(refresh),
        clientId: row.clientId,
        userId: user.id,
        scope,
        resource,
        expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
      },
    });

    res.status(200).setHeader('Cache-Control', 'no-store').json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: MCP_ACCESS_TTL_SEC,
      refresh_token: refresh,
      scope,
    });
    return;
  }

  if (grantType === 'refresh_token') {
    const refresh = str(body.refresh_token);
    const clientId = str(body.client_id);
    if (!refresh) {
      oauthError(res, 400, 'invalid_request', 'refresh_token requis.');
      return;
    }
    const row = await prisma.oAuthRefreshToken.findUnique({ where: { tokenHash: sha256(refresh) } });

    // Détection de rejeu : présenter un refresh DÉJÀ révoqué est le signal canonique
    // d'un vol (le voleur et le client légitime utilisent la même chaîne à tour de rôle).
    // On révoque alors TOUTE la famille (user × client) — sinon le voleur garde le jeton
    // successeur pendant 60 jours pendant que la victime se contente de se reconnecter.
    if (row?.revokedAt) {
      await prisma.oAuthRefreshToken.updateMany({
        where: { userId: row.userId, clientId: row.clientId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      console.warn(`[oauth] rejeu d'un refresh révoqué (user=${row.userId.slice(0, 8)}) → famille révoquée`);
      oauthError(res, 400, 'invalid_grant', 'Refresh token révoqué. Reconnecte-toi.');
      return;
    }
    if (!row || row.expiresAt.getTime() < Date.now()) {
      oauthError(res, 400, 'invalid_grant', 'Refresh token invalide ou expiré.');
      return;
    }
    if (clientId && row.clientId !== clientId) {
      oauthError(res, 400, 'invalid_grant', 'client_id ne correspond pas au refresh token.');
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: row.userId }, select: { id: true, email: true } });
    if (!user) {
      oauthError(res, 400, 'invalid_grant', 'Utilisateur introuvable.');
      return;
    }

    // Rotation : on révoque l'ancien refresh et on en émet un nouveau.
    const resource = row.resource || mcpResourceUrl(baseUrl);
    const scope = row.scope || DEFAULT_SCOPE;
    const newRefresh = randomToken(48);
    await prisma.$transaction([
      prisma.oAuthRefreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } }),
      prisma.oAuthRefreshToken.create({
        data: {
          tokenHash: sha256(newRefresh),
          clientId: row.clientId,
          userId: user.id,
          scope,
          resource,
          expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
        },
      }),
    ]);

    const accessToken = signMcpAccessToken({ sub: user.id, email: user.email, scope, aud: resource });
    res.status(200).setHeader('Cache-Control', 'no-store').json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: MCP_ACCESS_TTL_SEC,
      refresh_token: newRefresh,
      scope,
    });
    return;
  }

  oauthError(res, 400, 'unsupported_grant_type', `grant_type non supporté : ${grantType || '(vide)'}`);
}));

// ─────────────────────────────────────────────────────────────────────────────
// wellKnownRouter — métadonnées de découverte OAuth (monté à la RACINE)
// ─────────────────────────────────────────────────────────────────────────────

export const wellKnownRouter: Router = Router();

/** CORS public pour les métadonnées (lecture Bearer, jamais de cookie) — évite le couple invalide `*` + credentials. */
function corsPublic(res: Response): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.removeHeader('Access-Control-Allow-Credentials');
}

/**
 * RFC 8414 — métadonnées du serveur d'autorisation.
 *
 * ⚠ Servie au chemin racine ET aux variantes SUFFIXÉES par le chemin de la ressource
 * (`/.well-known/oauth-authorization-server/api/mcp`). Beaucoup de clients MCP tentent
 * d'abord la découverte « path-aware » avant de retomber sur la racine. Sans cette route,
 * la requête tombait dans le catch-all du SPA et renvoyait **200 avec du HTML** : un client
 * qui prend ce 200 pour une réponse valide échoue à parser le JSON et peut abandonner la
 * découverte au lieu d'essayer la racine. C'est un piège silencieux, d'où la couverture large.
 */
function authorizationServerMetadata(req: Request, res: Response): void {
  const base = getBaseUrl(req);
  corsPublic(res);
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/api/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    scopes_supported: [...MCP_SCOPES],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
  });
}
wellKnownRouter.get('/.well-known/oauth-authorization-server', authorizationServerMetadata);
wellKnownRouter.get('/.well-known/oauth-authorization-server/*', authorizationServerMetadata);
// Variante OpenID Connect : certains clients tentent ce chemin avant les autres.
wellKnownRouter.get('/.well-known/openid-configuration', authorizationServerMetadata);
wellKnownRouter.get('/.well-known/openid-configuration/*', authorizationServerMetadata);

// RFC 9728 — métadonnées de la protected resource (le endpoint MCP).
// Servie au chemin racine ET au variant suffixé par la resource, que certains clients tentent.
function protectedResourceMetadata(req: Request, res: Response): void {
  const base = getBaseUrl(req);
  corsPublic(res);
  res.json({
    resource: mcpResourceUrl(base),
    authorization_servers: [base],
    scopes_supported: [...MCP_SCOPES],
    bearer_methods_supported: ['header'],
  });
}
wellKnownRouter.get('/.well-known/oauth-protected-resource', protectedResourceMetadata);
wellKnownRouter.get('/.well-known/oauth-protected-resource/*', protectedResourceMetadata);
