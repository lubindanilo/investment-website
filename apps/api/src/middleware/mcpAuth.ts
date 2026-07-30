/**
 * Middleware d'authentification MCP — valide le header `Authorization: Bearer <jwt>`
 * (access token MCP émis par /api/oauth/token) et attache req.user + req.mcpScope.
 *
 * En cas d'échec, renvoie un 401 avec un header `WWW-Authenticate` qui pointe vers
 * les métadonnées de la protected resource → le client MCP (claude.ai) sait alors
 * où lancer/relancer le flow OAuth.
 */
import type { Request, Response, NextFunction } from 'express';
import { verifyMcpAccessToken, getBaseUrl, mcpResourceUrl, hasTrustedBaseUrl } from '../lib/oauth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Scope OAuth de l'access token MCP présenté. */
      mcpScope?: string;
    }
  }
}

export function requireMcpAuth(req: Request, res: Response, next: NextFunction): void {
  const resourceMeta = `${getBaseUrl(req)}/.well-known/oauth-protected-resource`;
  const header = req.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1];

  if (!token) {
    res
      .setHeader('WWW-Authenticate', `Bearer resource_metadata="${resourceMeta}"`)
      .status(401)
      .json({ error: 'invalid_token', error_description: 'Access token Bearer requis.' });
    return;
  }

  const claims = verifyMcpAccessToken(token);
  if (!claims) {
    res
      .setHeader('WWW-Authenticate', `Bearer error="invalid_token", resource_metadata="${resourceMeta}"`)
      .status(401)
      .json({ error: 'invalid_token', error_description: 'Access token invalide ou expiré.' });
    return;
  }

  // Audience (RFC 8707) : le token doit avoir été émis POUR cette ressource. On ne
  // l'exige que si la base URL vient d'une source de confiance — en dev local elle
  // dérive de l'hôte de la requête, qui varie (port éphémère) et rendrait le test
  // arbitrairement faux.
  if (hasTrustedBaseUrl() && claims.aud !== mcpResourceUrl(getBaseUrl(req))) {
    res
      .setHeader('WWW-Authenticate', `Bearer error="invalid_token", resource_metadata="${resourceMeta}"`)
      .status(401)
      .json({ error: 'invalid_token', error_description: 'Token émis pour une autre ressource.' });
    return;
  }

  req.user = { userId: claims.sub, email: claims.email };
  req.mcpScope = claims.scope;
  next();
}
