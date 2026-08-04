/**
 * Vérificateur public de visibilité IA — l'outil gratuit d'acquisition.
 *
 * Deux endpoints, tous deux SANS authentification (c'est le but : zéro friction) :
 *   POST /api/ai-visibility/check   { url }        → rapport complet
 *   GET  /api/ai-visibility?url=…                  → même rapport, appelable en lien direct
 *
 * Le GET existe pour deux raisons : il rend le résultat partageable par simple URL, et il
 * sert le pré-rendu Open Graph de la page de partage (routes/seoPrerender n'a pas à
 * dupliquer la logique).
 *
 * Cache : 10 minutes en CDN sur le GET. Un résultat partagé qui est consulté cent fois ne
 * doit pas déclencher cent paires de requêtes sortantes. Le POST n'est jamais caché : c'est
 * l'action volontaire de l'utilisateur, il veut la mesure du moment.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { aiVisibilityLimiter } from '../middleware/rateLimit.js';
import { CheckError, checkAiVisibility } from '../lib/aiVisibility.js';

export const aiVisibilityRouter: Router = Router();

const bodySchema = z.object({ url: z.string().min(1).max(2048) });

async function handle(rawUrl: string, res: Response, cacheSeconds: number): Promise<void> {
  try {
    const report = await checkAiVisibility(rawUrl);
    if (cacheSeconds > 0) {
      res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=60`);
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }
    res.json(report);
  } catch (e) {
    if (e instanceof CheckError) {
      // 422 et pas 500 : l'URL de l'utilisateur est en cause, pas notre service.
      res.status(422).json({ error: e.message, code: e.code });
      return;
    }
    console.error('[ai-visibility] échec inattendu', e);
    res.status(502).json({ error: 'La vérification a échoué.', code: 'check_failed' });
  }
}

aiVisibilityRouter.post(
  '/ai-visibility/check',
  aiVisibilityLimiter,
  async (req: Request, res: Response) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Indique une URL à vérifier.', code: 'invalid_body' });
      return;
    }
    await handle(parsed.data.url, res, 0);
  },
);

aiVisibilityRouter.get(
  '/ai-visibility',
  aiVisibilityLimiter,
  async (req: Request, res: Response) => {
    const url = typeof req.query.url === 'string' ? req.query.url : '';
    if (!url) {
      res.status(400).json({ error: 'Paramètre `url` requis.', code: 'invalid_query' });
      return;
    }
    await handle(url, res, 600);
  },
);
