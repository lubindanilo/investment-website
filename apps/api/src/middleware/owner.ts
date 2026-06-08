/**
 * Garde « propriétaire » — réserve une route au seul compte propriétaire (page « Stratégie
 * portefeuille », privée). À chaîner APRÈS requireAuth (qui pose req.user). 403 sinon.
 */
import type { Request, Response, NextFunction } from 'express';
import { ApiError } from './error.js';

/** Email du propriétaire (seul autorisé à voir/éditer le portefeuille suivi). */
export const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? 'lubindanilo2@gmail.com').toLowerCase();

export function requireOwner(req: Request, _res: Response, next: NextFunction): void {
  if ((req.user?.email ?? '').toLowerCase() !== OWNER_EMAIL) {
    next(new ApiError(403, 'Accès réservé'));
    return;
  }
  next();
}
