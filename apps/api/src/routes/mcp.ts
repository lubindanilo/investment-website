/**
 * /api/mcp — endpoint du serveur MCP (Model Context Protocol) de Lubin Investment.
 *
 * Transport : Streamable HTTP **stateless** (une instance McpServer + transport par
 * requête, réponse JSON, pas de session serveur → adapté au mono-lambda Vercel).
 * Auth : Bearer OAuth (requireMcpAuth) sur toutes les méthodes. L'instance serveur est
 * liée à l'utilisateur → le gating membre/Pro s'applique dans les handlers de tools.
 *
 * CORS permissif : appelé par le host MCP (claude.ai) avec un Bearer, sans cookie.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { asyncHandler } from '../middleware/error.js';
import { requireMcpAuth } from '../middleware/mcpAuth.js';
import { mcpLimiter } from '../middleware/rateLimit.js';
import { getBaseUrl } from '../lib/oauth.js';
import { loadMcpContext } from '../mcp/gating.js';
import { buildMcpServer } from '../mcp/server.js';

export const mcpRouter: Router = Router();

mcpRouter.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.removeHeader('Access-Control-Allow-Credentials');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Protocol-Version, Mcp-Session-Id');
  res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate, Mcp-Session-Id');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

/**
 * GET /api/mcp/status — sonde authentifiée (diagnostic, non-MCP) pour tester le flow
 * OAuth sans client MCP.
 */
mcpRouter.get('/status', mcpLimiter, requireMcpAuth, asyncHandler(async (req: Request, res: Response) => {
  const ctx = await loadMcpContext(req.user!, getBaseUrl(req));
  res.json({ ok: true, authenticated: true, userId: ctx.userId, plan: ctx.isPro ? 'pro' : 'member', scope: req.mcpScope });
}));

/**
 * POST /api/mcp — requêtes JSON-RPC MCP (initialize, tools/list, tools/call…).
 * On instancie un serveur MCP lié à l'utilisateur, on branche le transport stateless,
 * et on nettoie à la fermeture de la réponse.
 */
mcpRouter.post('/', mcpLimiter, requireMcpAuth, asyncHandler(async (req: Request, res: Response) => {
  const ctx = await loadMcpContext(req.user!, getBaseUrl(req));
  const server = buildMcpServer(ctx);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless : pas de session serveur
    enableJsonResponse: true, // réponse JSON unique (pas de flux SSE)
  });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}));

/** Mode stateless : ni flux SSE ni session → GET/DELETE non supportés. */
mcpRouter.all('/', requireMcpAuth, (_req: Request, res: Response) => {
  res.setHeader('Allow', 'POST');
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Méthode non supportée (MCP stateless : POST uniquement).' },
    id: null,
  });
});
