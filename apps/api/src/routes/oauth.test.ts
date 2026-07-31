/**
 * Tests d'intégration du serveur d'autorisation OAuth 2.1 (connecteur MCP).
 *
 * Stratégie : Prisma mocké en mémoire (même approche que auth.test.ts) → aucune DB.
 * Couvre le parcours nominal (register → authorize → token → appel Bearer) ET les cas
 * d'attaque : PKCE invalide, rejeu de code, redirect_uri hors allowlist, refresh révoqué.
 *
 * ⚠ Les rate limiters sont désactivés en test (SKIP_IN_TESTS), donc le throttling
 * anti-brute-force n'est pas vérifiable ici — il l'est par lecture du câblage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

// ─── Mock Prisma (DOIT être défini AVANT l'import de server.js) ────────────
interface FakeUser { id: string; email: string; passwordHash: string; subscriptionStatus: string; subscriptionCurrentPeriodEnd: Date | null; dailyAnalysisCount: number; dailyAnalysisResetAt: Date }
interface FakeClient { id: string; clientSecret: string | null; clientName: string | null; redirectUris: string[]; grantTypes: string[]; responseTypes: string[]; tokenEndpointAuthMethod: string; scope: string | null; createdAt: Date }
interface FakeCode { code: string; clientId: string; userId: string; redirectUri: string; scope: string | null; codeChallenge: string; codeChallengeMethod: string; resource: string | null; expiresAt: Date; consumedAt: Date | null }
interface FakeRefresh { id: string; tokenHash: string; clientId: string; userId: string; scope: string | null; resource: string | null; expiresAt: Date; revokedAt: Date | null }

const users = new Map<string, FakeUser>();     // key = email
const usersById = new Map<string, FakeUser>();
const clients = new Map<string, FakeClient>();
const codes = new Map<string, FakeCode>();
const refreshes = new Map<string, FakeRefresh>(); // key = tokenHash
let seq = 1;

vi.mock('@prisma/client', () => ({
  PrismaClient: class FakePrisma {
    user = {
      findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) =>
        (where.email ? users.get(where.email) : where.id ? usersById.get(where.id) : null) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const u = usersById.get(where.id);
        if (u) Object.assign(u, data);
        return u ?? null;
      }),
    };
    oAuthClient = {
      create: vi.fn(async ({ data }: { data: Omit<FakeClient, 'id' | 'createdAt'> }) => {
        const c: FakeClient = { ...data, id: `client_${seq++}`, createdAt: new Date() };
        clients.set(c.id, c);
        return c;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => clients.get(where.id) ?? null),
    };
    oAuthAuthCode = {
      create: vi.fn(async ({ data }: { data: FakeCode }) => {
        codes.set(data.code, { ...data, consumedAt: data.consumedAt ?? null });
        return data;
      }),
      findUnique: vi.fn(async ({ where }: { where: { code: string } }) => codes.get(where.code) ?? null),
      updateMany: vi.fn(async ({ where, data }: { where: { code: string; consumedAt: null }; data: { consumedAt: Date } }) => {
        const c = codes.get(where.code);
        if (!c || c.consumedAt !== null) return { count: 0 };
        c.consumedAt = data.consumedAt;
        return { count: 1 };
      }),
    };
    oAuthRefreshToken = {
      create: vi.fn(async ({ data }: { data: Omit<FakeRefresh, 'id'> }) => {
        const r: FakeRefresh = { ...data, id: `rt_${seq++}`, revokedAt: data.revokedAt ?? null };
        refreshes.set(r.tokenHash, r);
        return r;
      }),
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => refreshes.get(where.tokenHash) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeRefresh> }) => {
        for (const r of refreshes.values()) if (r.id === where.id) { Object.assign(r, data); return r; }
        return null;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { userId: string; clientId?: string; revokedAt: null }; data: Partial<FakeRefresh> }) => {
        let count = 0;
        for (const r of refreshes.values()) {
          if (r.userId !== where.userId) continue;
          if (where.clientId !== undefined && r.clientId !== where.clientId) continue;
          if (r.revokedAt !== null) continue;
          Object.assign(r, data);
          count++;
        }
        return { count };
      }),
    };
    watchlistEntry = { findMany: vi.fn(async () => []), count: vi.fn(async () => 0), findUnique: vi.fn(async () => null), upsert: vi.fn(), deleteMany: vi.fn(async () => ({ count: 0 })) };
    // Les promesses sont déjà lancées par le fake → il suffit de les attendre.
    $transaction = vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops));
  },
}));

const { app } = await import('../server.js');

const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const PASSWORD = 'motdepasse-solide-123';
const VERIFIER = 'verifier-' + 'a'.repeat(60);
const CHALLENGE = crypto.createHash('sha256').update(VERIFIER).digest('base64url');

beforeEach(async () => {
  users.clear(); usersById.clear(); clients.clear(); codes.clear(); refreshes.clear();
  seq = 1;
  const u: FakeUser = {
    id: 'user_1', email: 'membre@example.com',
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    subscriptionStatus: 'free', subscriptionCurrentPeriodEnd: null,
    dailyAnalysisCount: 0, dailyAnalysisResetAt: new Date(),
  };
  users.set(u.email, u); usersById.set(u.id, u);
});

/** Enregistre un client et renvoie son client_id. */
async function registerClient(): Promise<string> {
  const res = await request(app).post('/api/oauth/register').send({ redirect_uris: [REDIRECT], client_name: 'Claude' });
  expect(res.status).toBe(201);
  return res.body.client_id as string;
}

/** Parcours complet jusqu'au code d'autorisation. */
async function getAuthCode(clientId: string): Promise<string> {
  const res = await request(app).post('/api/oauth/authorize').type('form').send({
    client_id: clientId, redirect_uri: REDIRECT, scope: 'mcp', state: 'xyz',
    code_challenge: CHALLENGE, code_challenge_method: 'S256',
    decision: 'allow', email: 'membre@example.com', password: PASSWORD,
  });
  expect(res.status).toBe(302);
  const url = new URL(res.headers.location as string);
  expect(url.searchParams.get('state')).toBe('xyz');
  const code = url.searchParams.get('code');
  expect(code).toBeTruthy();
  return code as string;
}

describe('OAuth — découverte', () => {
  it('expose les métadonnées du serveur d\'autorisation', async () => {
    const res = await request(app).get('/.well-known/oauth-authorization-server');
    expect(res.status).toBe(200);
    expect(res.body.code_challenge_methods_supported).toEqual(['S256']);
    expect(res.body.grant_types_supported).toContain('authorization_code');
    expect(res.body.authorization_endpoint).toMatch(/\/api\/oauth\/authorize$/);
    expect(res.body.registration_endpoint).toMatch(/\/api\/oauth\/register$/);
  });

  it('expose les métadonnées de la protected resource', async () => {
    const res = await request(app).get('/.well-known/oauth-protected-resource');
    expect(res.status).toBe(200);
    expect(res.body.resource).toMatch(/\/api\/mcp$/);
    expect(res.body.authorization_servers).toHaveLength(1);
  });
});

describe('OAuth — enregistrement dynamique', () => {
  it('enregistre un client public (sans secret)', async () => {
    const res = await request(app).post('/api/oauth/register').send({ redirect_uris: [REDIRECT] });
    expect(res.status).toBe(201);
    expect(res.body.client_id).toBeTruthy();
    expect(res.body.client_secret).toBeUndefined();
  });

  it('refuse un redirect_uri non https (hors localhost)', async () => {
    const res = await request(app).post('/api/oauth/register').send({ redirect_uris: ['http://evil.example.com/cb'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_redirect_uri');
  });

  it('refuse une requête sans redirect_uris', async () => {
    const res = await request(app).post('/api/oauth/register').send({ client_name: 'x' });
    expect(res.status).toBe(400);
  });

  it('borne le nombre et la taille des redirect_uris (anti-gonflement de la base)', async () => {
    const trop = await request(app).post('/api/oauth/register')
      .send({ redirect_uris: Array.from({ length: 50 }, (_, i) => `https://x.example.com/cb${i}`) });
    expect(trop.status).toBe(400);

    const tropLong = await request(app).post('/api/oauth/register')
      .send({ redirect_uris: [`https://x.example.com/${'a'.repeat(600)}`] });
    expect(tropLong.status).toBe(400);

    expect(clients.size).toBe(0);
  });
});

describe('OAuth — /authorize', () => {
  it('refuse un client inconnu sans rediriger', async () => {
    const res = await request(app).get('/api/oauth/authorize').query({
      response_type: 'code', client_id: 'client_inexistant', redirect_uri: REDIRECT,
      code_challenge: CHALLENGE, code_challenge_method: 'S256',
    });
    expect(res.status).toBe(400);
    expect(res.headers.location).toBeUndefined();
  });

  it('refuse un redirect_uri hors allowlist sans rediriger (anti open-redirect)', async () => {
    const clientId = await registerClient();
    const res = await request(app).get('/api/oauth/authorize').query({
      response_type: 'code', client_id: clientId, redirect_uri: 'https://evil.example.com/steal',
      code_challenge: CHALLENGE, code_challenge_method: 'S256',
    });
    expect(res.status).toBe(400);
    expect(res.headers.location).toBeUndefined();
  });

  it('refuse PKCE absent ou non-S256', async () => {
    const clientId = await registerClient();
    const sans = await request(app).get('/api/oauth/authorize').query({
      response_type: 'code', client_id: clientId, redirect_uri: REDIRECT,
    });
    expect(sans.status).toBe(302);
    expect(new URL(sans.headers.location as string).searchParams.get('error')).toBe('invalid_request');

    const plain = await request(app).get('/api/oauth/authorize').query({
      response_type: 'code', client_id: clientId, redirect_uri: REDIRECT,
      code_challenge: CHALLENGE, code_challenge_method: 'plain',
    });
    expect(new URL(plain.headers.location as string).searchParams.get('error')).toBe('invalid_request');
  });

  it('affiche la page de consentement quand les paramètres sont valides', async () => {
    const clientId = await registerClient();
    const res = await request(app).get('/api/oauth/authorize').query({
      response_type: 'code', client_id: clientId, redirect_uri: REDIRECT,
      code_challenge: CHALLENGE, code_challenge_method: 'S256', state: 'xyz',
    });
    expect(res.status).toBe(200);
    expect(res.text).toContain('Autoriser');
    expect(res.text).toContain('name="password"');
  });

  it('échappe le nom du client dans la page (anti-XSS)', async () => {
    const reg = await request(app).post('/api/oauth/register')
      .send({ redirect_uris: [REDIRECT], client_name: '<script>alert(1)</script>' });
    const res = await request(app).get('/api/oauth/authorize').query({
      response_type: 'code', client_id: reg.body.client_id, redirect_uri: REDIRECT,
      code_challenge: CHALLENGE, code_challenge_method: 'S256',
    });
    expect(res.text).not.toContain('<script>alert(1)</script>');
    expect(res.text).toContain('&lt;script&gt;');
  });

  it('refuse un mauvais mot de passe sans émettre de code', async () => {
    const clientId = await registerClient();
    const res = await request(app).post('/api/oauth/authorize').type('form').send({
      client_id: clientId, redirect_uri: REDIRECT, code_challenge: CHALLENGE,
      code_challenge_method: 'S256', decision: 'allow',
      email: 'membre@example.com', password: 'mauvais',
    });
    expect(res.status).toBe(401);
    expect(codes.size).toBe(0);
  });

  it('renvoie le même message générique pour un email inconnu (anti-énumération)', async () => {
    const clientId = await registerClient();
    const inconnu = await request(app).post('/api/oauth/authorize').type('form').send({
      client_id: clientId, redirect_uri: REDIRECT, code_challenge: CHALLENGE,
      code_challenge_method: 'S256', decision: 'allow',
      email: 'inconnu@example.com', password: PASSWORD,
    });
    expect(inconnu.status).toBe(401);
    expect(inconnu.text).toContain('Email ou mot de passe incorrect');
    expect(codes.size).toBe(0);
  });

  it('redirige avec access_denied si l\'utilisateur refuse', async () => {
    const clientId = await registerClient();
    const res = await request(app).post('/api/oauth/authorize').type('form').send({
      client_id: clientId, redirect_uri: REDIRECT, code_challenge: CHALLENGE,
      code_challenge_method: 'S256', decision: 'deny', state: 'xyz',
      email: 'membre@example.com', password: PASSWORD,
    });
    expect(res.status).toBe(302);
    expect(new URL(res.headers.location as string).searchParams.get('error')).toBe('access_denied');
    expect(codes.size).toBe(0);
  });
});

describe('OAuth — /token', () => {
  it('échange le code contre des tokens (parcours nominal)', async () => {
    const clientId = await registerClient();
    const code = await getAuthCode(clientId);
    const res = await request(app).post('/api/oauth/token').type('form').send({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT,
      client_id: clientId, code_verifier: VERIFIER,
    });
    expect(res.status).toBe(200);
    expect(res.body.token_type).toBe('Bearer');
    expect(res.body.access_token).toBeTruthy();
    expect(res.body.refresh_token).toBeTruthy();
    expect(res.headers['cache-control']).toContain('no-store');
    // Le refresh est stocké HASHÉ, jamais en clair.
    expect(refreshes.has(res.body.refresh_token)).toBe(false);
    expect(refreshes.size).toBe(1);
  });

  it('refuse un code_verifier invalide (PKCE)', async () => {
    const clientId = await registerClient();
    const code = await getAuthCode(clientId);
    const res = await request(app).post('/api/oauth/token').type('form').send({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT,
      client_id: clientId, code_verifier: 'mauvais-verifier-' + 'b'.repeat(50),
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_grant');
  });

  it('refuse le rejeu d\'un code déjà consommé', async () => {
    const clientId = await registerClient();
    const code = await getAuthCode(clientId);
    const body = { grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: clientId, code_verifier: VERIFIER };
    const first = await request(app).post('/api/oauth/token').type('form').send(body);
    expect(first.status).toBe(200);
    const replay = await request(app).post('/api/oauth/token').type('form').send(body);
    expect(replay.status).toBe(400);
    expect(replay.body.error).toBe('invalid_grant');
  });

  it('refuse un redirect_uri qui ne correspond pas au code', async () => {
    const clientId = await registerClient();
    const code = await getAuthCode(clientId);
    const res = await request(app).post('/api/oauth/token').type('form').send({
      grant_type: 'authorization_code', code, redirect_uri: 'https://claude.ai/autre',
      client_id: clientId, code_verifier: VERIFIER,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_grant');
  });

  it('fait tourner le refresh token et invalide l\'ancien', async () => {
    const clientId = await registerClient();
    const code = await getAuthCode(clientId);
    const first = await request(app).post('/api/oauth/token').type('form').send({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: clientId, code_verifier: VERIFIER,
    });
    const oldRefresh = first.body.refresh_token as string;

    const rotated = await request(app).post('/api/oauth/token').type('form')
      .send({ grant_type: 'refresh_token', refresh_token: oldRefresh, client_id: clientId });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refresh_token).not.toBe(oldRefresh);

    // L'ancien refresh ne doit plus fonctionner.
    const reuse = await request(app).post('/api/oauth/token').type('form')
      .send({ grant_type: 'refresh_token', refresh_token: oldRefresh, client_id: clientId });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error).toBe('invalid_grant');

    // Détection de vol : rejouer un refresh révoqué doit tuer TOUTE la famille, donc
    // le successeur légitime aussi (le voleur ne garde pas un accès de 60 jours).
    expect([...refreshes.values()].every(r => r.revokedAt !== null)).toBe(true);
    const successorDead = await request(app).post('/api/oauth/token').type('form')
      .send({ grant_type: 'refresh_token', refresh_token: rotated.body.refresh_token, client_id: clientId });
    expect(successorDead.status).toBe(400);
  });

  it('refuse un grant_type non supporté', async () => {
    const res = await request(app).post('/api/oauth/token').type('form')
      .send({ grant_type: 'password', username: 'a', password: 'b' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unsupported_grant_type');
  });
});

describe('MCP — accès protégé par Bearer', () => {
  it('refuse sans token et indique où s\'authentifier', async () => {
    const res = await request(app).get('/api/mcp/status');
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toContain('resource_metadata=');
  });

  it('refuse un token bidon', async () => {
    const res = await request(app).get('/api/mcp/status').set('Authorization', 'Bearer pas-un-jwt');
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toContain('invalid_token');
  });

  it('accepte un access token issu du flow complet', async () => {
    const clientId = await registerClient();
    const code = await getAuthCode(clientId);
    const tok = await request(app).post('/api/oauth/token').type('form').send({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: clientId, code_verifier: VERIFIER,
    });
    const res = await request(app).get('/api/mcp/status').set('Authorization', `Bearer ${tok.body.access_token}`);
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(res.body.userId).toBe('user_1');
    expect(res.body.plan).toBe('member');
  });

  it('refuse un cookie de session web présenté comme access token MCP (séparation de domaine)', async () => {
    const { signToken } = await import('../lib/auth.js');
    const webToken = signToken({ userId: 'user_1', email: 'membre@example.com' });
    const res = await request(app).get('/api/mcp/status').set('Authorization', `Bearer ${webToken}`);
    expect(res.status).toBe(401);
  });
});

// ─── Non-régression des correctifs de la passe sécurité ─────────────────────
describe('OAuth — durcissements', () => {
  // NOTE : le test « affiche la destination du code » a été retiré volontairement — le bandeau
  // qui exposait le domaine de redirection a été supprimé de la page (choix produit, cf.
  // docs/mcp/WORKLOG.md). Il reste donc possible qu'un client usurpe un nom connu ; le
  // garde-fou technique subsiste (redirect_uri en allowlist stricte par client enregistré).

  it('interdit l\'affichage de la page de consentement en iframe', async () => {
    const clientId = await registerClient();
    const res = await request(app).get('/api/oauth/authorize').query({
      response_type: 'code', client_id: clientId, redirect_uri: REDIRECT,
      code_challenge: CHALLENGE, code_challenge_method: 'S256',
    });
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it('refuse un scope inconnu (pas d\'auto-attribution de privilèges)', async () => {
    const clientId = await registerClient();
    const res = await request(app).get('/api/oauth/authorize').query({
      response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, scope: 'mcp admin',
      code_challenge: CHALLENGE, code_challenge_method: 'S256',
    });
    expect(res.status).toBe(302);
    expect(new URL(res.headers.location as string).searchParams.get('error')).toBe('invalid_scope');
  });

  it('refuse une resource qui ne désigne pas ce serveur', async () => {
    const clientId = await registerClient();
    const res = await request(app).get('/api/oauth/authorize').query({
      response_type: 'code', client_id: clientId, redirect_uri: REDIRECT,
      resource: 'https://evil.tld/mcp',
      code_challenge: CHALLENGE, code_challenge_method: 'S256',
    });
    expect(res.status).toBe(302);
    expect(new URL(res.headers.location as string).searchParams.get('error')).toBe('invalid_target');
  });

  it('brûle le code dès qu\'un échange échoue (un code qui a fuité ne reste pas rejouable)', async () => {
    const clientId = await registerClient();
    const code = await getAuthCode(clientId);

    const rate = await request(app).post('/api/oauth/token').type('form').send({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT,
      client_id: clientId, code_verifier: 'mauvais-verifier-' + 'c'.repeat(50),
    });
    expect(rate.status).toBe(400);

    // Même avec le BON verifier, le code ne doit plus être échangeable.
    const retry = await request(app).post('/api/oauth/token').type('form').send({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT,
      client_id: clientId, code_verifier: VERIFIER,
    });
    expect(retry.status).toBe(400);
    expect(retry.body.error).toBe('invalid_grant');
  });

  it('révoque les refresh tokens MCP quand le mot de passe est réinitialisé', async () => {
    const clientId = await registerClient();
    const code = await getAuthCode(clientId);
    const tok = await request(app).post('/api/oauth/token').type('form').send({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: clientId, code_verifier: VERIFIER,
    });
    const refresh = tok.body.refresh_token as string;

    // Reset du mot de passe : le token d'action est lié au hash courant (usage unique).
    const { signActionToken } = await import('../lib/auth.js');
    const user = usersById.get('user_1')!;
    const resetToken = signActionToken('reset', user.id, user.passwordHash);
    const reset = await request(app).post('/api/auth/reset-password')
      .send({ token: resetToken, password: 'nouveau-motdepasse-456' });
    expect(reset.status).toBe(200);

    // L'accès applicatif accordé avant le reset doit être coupé.
    const after = await request(app).post('/api/oauth/token').type('form')
      .send({ grant_type: 'refresh_token', refresh_token: refresh, client_id: clientId });
    expect(after.status).toBe(400);
    expect(after.body.error).toBe('invalid_grant');
  });
});
