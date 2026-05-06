/**
 * Error handler central : transforme toute exception en réponse JSON propre.
 * Capture également vers Sentry si initialisé.
 */
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../lib/retry.js';
import { captureException } from '../lib/sentry.js';

/** Exception métier projetable directement vers le client. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Wrapper pour les handlers async qui propage les exceptions vers Express
 * (Express 4 ne gère pas nativement les rejets de Promise dans les handlers).
 */
export function asyncHandler<R extends RequestHandler>(fn: R): RequestHandler {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // ApiError : message custom, status custom
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  // HttpError remonté d'un service externe — on garde le status pour debug
  if (err instanceof HttpError) {
    captureException(err, { path: req.path, method: req.method });
    res.status(502).json({
      error: 'Service externe indisponible',
      details: `Upstream returned HTTP ${err.status}`,
    });
    return;
  }
  // Inconnu : log + Sentry + 500
  console.error('[unhandled]', err);
  captureException(err, { path: req.path, method: req.method });
  res.status(500).json({
    error: 'Erreur serveur',
    details: err instanceof Error ? err.message : String(err),
  });
};
