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
import { hashPassword, verifyPassword, signToken, COOKIE_NAME, cookieOptions } from '../lib/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { parseLang, tt } from '../i18n/index.js';

export const authRouter: Router = Router();

const CredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email invalide').max(254),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum').max(200),
});

function publicUser(u: { id: string; email: string; createdAt: Date }) {
  return { id: u.id, email: u.email, createdAt: u.createdAt.toISOString() };
}

authRouter.post('/signup', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const lang = parseLang(req.headers['accept-language']);
  const parse = CredentialsSchema.safeParse(req.body);
  // Les messages de champ Zod (email/mdp) sont déjà filtrés côté front avant l'appel ;
  // on garde un fallback localisé générique si une validation serveur passe quand même.
  if (!parse.success) throw new ApiError(400, parse.error.issues[0]?.message ?? tt(lang, 'auth.invalidPayload'));
  const { email, password } = parse.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // 409 = conflict. Acceptable de révéler ici parce que signup, pas login.
    throw new ApiError(409, tt(lang, 'auth.emailTaken'));
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash } });

  const token = signToken({ userId: user.id, email: user.email });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.status(201).json(publicUser(user));
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
