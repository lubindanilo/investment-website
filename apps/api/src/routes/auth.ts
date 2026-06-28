/**
 * Routes d'authentification :
 *   POST /api/auth/signup   → crée user + login
 *   POST /api/auth/login    → vérifie credentials + set cookie
 *   POST /api/auth/logout   → clear cookie
 *   GET  /api/auth/me       → renvoie user courant (ou 401 si pas auth)
 *
 * Sécurité :
 *   - Password min 8 chars
 *   - Email lowercase + trim
 *   - Erreur générique "Email ou mot de passe invalide" (ne révèle PAS si l'email existe)
 *   - Hash bcrypt cost 12 (≈ 200ms par check, frein anti brute-force)
 *   - Rate limit hérité du middleware global apiLimiter
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { hashPassword, verifyPassword, signToken, COOKIE_NAME, cookieOptions,
  signActionToken, verifyActionToken, peekActionUserId } from '../lib/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { parseLang, tt, type Lang } from '../i18n/index.js';
import { sendEmail, verifyEmailContent, resetEmailContent } from '../lib/email.js';

const SITE_URL = process.env.SITE_URL || 'https://lubin-investment.com';
/** Lien d'action localisé (en/es portent ?lng pour que la page s'ouvre dans la bonne langue). */
function actionLink(path: string, token: string, lang: Lang): string {
  const lq = lang === 'fr' ? '' : `&lng=${lang}`;
  return `${SITE_URL}${path}?token=${encodeURIComponent(token)}${lq}`;
}
/** Envoie l'email de vérification (best-effort, ne bloque jamais le flux appelant). */
async function sendVerifyEmail(user: { id: string; email: string }, lang: Lang): Promise<void> {
  const link = actionLink('/verify', signActionToken('verify', user.id), lang);
  const { subject, html } = verifyEmailContent(lang, link);
  await sendEmail({ to: user.email, subject, html });
}

export const authRouter: Router = Router();

const CredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email invalide').max(254),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum').max(200),
});

const NameSchema = z.string().trim().min(1, 'Champ requis').max(80);
const SignupSchema = CredentialsSchema.extend({
  firstName: NameSchema,
  lastName: NameSchema,
});

function publicUser(u: { id: string; email: string; firstName: string | null; lastName: string | null; emailVerified: boolean; createdAt: Date }) {
  return { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, emailVerified: u.emailVerified, createdAt: u.createdAt.toISOString() };
}

const PasswordSchema = z.string().min(8, 'Mot de passe : 8 caractères minimum').max(200);
const EmailOnlySchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const ResetSchema = z.object({ token: z.string().min(1).max(2000), password: PasswordSchema });
const TokenSchema = z.object({ token: z.string().min(1).max(2000) });

authRouter.post('/signup', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const lang = parseLang(req.headers['accept-language']);
  const parse = SignupSchema.safeParse(req.body);
  // Les messages de champ Zod (email/mdp/nom) sont déjà filtrés côté front avant l'appel ;
  // on garde un fallback localisé générique si une validation serveur passe quand même.
  if (!parse.success) throw new ApiError(400, parse.error.issues[0]?.message ?? tt(lang, 'auth.invalidPayload'));
  const { email, password, firstName, lastName } = parse.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // 409 = conflict. Acceptable de révéler ici parce que signup, pas login.
    throw new ApiError(409, tt(lang, 'auth.emailTaken'));
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash, firstName, lastName } });

  const token = signToken({ userId: user.id, email: user.email });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.status(201).json(publicUser(user));

  // Email de vérification (best-effort, après la réponse : ne ralentit pas le signup).
  sendVerifyEmail(user, lang).catch((e) => console.error('[auth] verify email signup', e));
}));

authRouter.post('/login', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const lang = parseLang(req.headers['accept-language']);
  const parse = CredentialsSchema.safeParse(req.body);
  if (!parse.success) throw new ApiError(400, tt(lang, 'auth.invalidCredentials'));
  const { email, password } = parse.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Toujours faire un compare bcrypt même si user inexistant, pour éviter le timing-attack
  // qui permet d'énumérer les emails.
  const hashToCompare = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalid.';
  const ok = await verifyPassword(password, hashToCompare);
  if (!user || !ok) throw new ApiError(401, tt(lang, 'auth.invalidCredentials'));

  const token = signToken({ userId: user.id, email: user.email });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json(publicUser(user));
}));

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, cookieOptions({ clear: true }));
  res.json({ ok: true });
});

authRouter.get('/me', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  // Endpoint d'ÉTAT (suis-je connecté ?) : anonyme => 200 + null, PAS 401. Évite une
  // erreur console "401" sur chaque page pour les visiteurs non connectés.
  if (!req.user) { res.json(null); return; }
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user) {
    // Cas rare : le cookie est valide mais le user a été supprimé entre-temps
    res.clearCookie(COOKIE_NAME, cookieOptions({ clear: true }));
    res.json(null);
    return;
  }
  res.json(publicUser(user));
}));

// ─── Vérification email ───────────────────────────────────────────────────────
authRouter.post('/verify-email', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const lang = parseLang(req.headers['accept-language']);
  const parse = TokenSchema.safeParse(req.body);
  if (!parse.success) throw new ApiError(400, tt(lang, 'auth.tokenInvalid'));
  const userId = peekActionUserId(parse.data.token);
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  if (!user || verifyActionToken('verify', parse.data.token) !== user.id) {
    throw new ApiError(400, tt(lang, 'auth.tokenInvalid'));
  }
  if (!user.emailVerified) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  }
  res.json({ ok: true });
}));

// Renvoie un email de vérification à l'utilisateur connecté (no-op si déjà vérifié).
authRouter.post('/resend-verification', authLimiter, requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const lang = parseLang(req.headers['accept-language']);
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (user && !user.emailVerified) {
    await sendVerifyEmail(user, lang).catch((e) => console.error('[auth] resend verify', e));
  }
  res.json({ ok: true });
}));

// ─── Mot de passe oublié / reset ──────────────────────────────────────────────
// Réponse 200 systématique (anti-énumération) : on ne révèle pas si l'email existe.
authRouter.post('/forgot-password', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const lang = parseLang(req.headers['accept-language']);
  const parse = EmailOnlySchema.safeParse(req.body);
  if (parse.success) {
    const user = await prisma.user.findUnique({ where: { email: parse.data.email } });
    if (user) {
      // bindHash = passwordHash courant → le lien devient invalide dès que le mdp change (usage unique).
      const link = actionLink('/reset', signActionToken('reset', user.id, user.passwordHash), lang);
      const { subject, html } = resetEmailContent(lang, link);
      await sendEmail({ to: user.email, subject, html }).catch((e) => console.error('[auth] reset email', e));
    }
  }
  res.json({ ok: true });
}));

authRouter.post('/reset-password', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const lang = parseLang(req.headers['accept-language']);
  const parse = ResetSchema.safeParse(req.body);
  if (!parse.success) throw new ApiError(400, parse.error.issues[0]?.message ?? tt(lang, 'auth.resetLinkInvalid'));
  const { token, password } = parse.data;
  const userId = peekActionUserId(token);
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  // La signature inclut le passwordHash courant → un lien déjà utilisé (mdp changé) échoue ici.
  if (!user || verifyActionToken('reset', token, user.passwordHash) !== user.id) {
    throw new ApiError(400, tt(lang, 'auth.resetLinkInvalid'));
  }
  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  // Connecte l'utilisateur dans la foulée (UX : pas besoin de re-login après reset).
  const authToken = signToken({ userId: user.id, email: user.email });
  res.cookie(COOKIE_NAME, authToken, cookieOptions());
  res.json({ ok: true });
}));
