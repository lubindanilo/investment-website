/**
 * Construit une instance McpServer liée à un utilisateur authentifié (stateless :
 * une instance par requête). Enregistre les tools LECTURE de la Phase 1 et applique
 * le gating membre/Pro au moment de l'appel (quota d'analyses, plafond de comparaison).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Lang } from '../i18n/index.js';
import * as tools from './tools.js';
import { consumeAnalysisQuota, FREE_MAX_COMPARE, MAX_COMPARE, type McpContext } from './gating.js';
import { FREE_WATCHLIST_LIMIT } from '../services/watchlistSnapshot.js';

const LangSchema = z.enum(['fr', 'en', 'es']).default('en');
const TickerSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9.\-]{1,15}$/, 'ticker invalide');

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };
function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}
function fail(message: string, extra?: Record<string, unknown>): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ error: message, ...extra }) }], isError: true };
}

/**
 * Refus lié à l'offre (plafond Free atteint, fonctionnalité Pro). On renvoie le lien
 * d'abonnement pour que l'assistant puisse le proposer, plutôt qu'un simple « non ».
 */
function upsell(ctx: McpContext, message: string, extra?: Record<string, unknown>): ToolResult {
  return fail(message, { code: 'PRO_REQUIRED', upgradeUrl: `${ctx.baseUrl}/pricing`, ...extra });
}

const INSTRUCTIONS = `Lubin Investment — analyse fondamentale d'actions (screener quantitatif, valorisation, résilience du modèle économique).
Données INFORMATIVES, pas un conseil d'investissement personnalisé. Les notes sont calculées à partir des chiffres uniquement (jamais de génération GPT).
Flux typique : search_ticker pour trouver un symbole, analyze_stock pour la note /10 + la valorisation, screen_stocks pour filtrer l'univers, get_resilience pour la solidité du modèle, fundamentals_trend pour l'évolution des fondamentaux, compare_stocks pour un face-à-face.
Watchlist de l'utilisateur connecté : get_watchlist pour la lister, analyze_watchlist pour la passer en revue (maillons faibles, fondamentaux en dégradation, titres au-dessus du juste prix), add_to_watchlist / remove_from_watchlist pour la modifier.`;

/** Tool de lecture pure : n'écrit rien, interroge des données externes au modèle. */
const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

export function buildMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer(
    { name: 'lubin-investment', version: '0.1.0' },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool('search_ticker', {
    title: 'Rechercher un ticker',
    description: "Autocomplétion sur l'univers couvert (ticker ou nom d'entreprise). Jusqu'à 8 correspondances avec la note chiffres.",
    inputSchema: { query: z.string().min(1).max(40) },
    annotations: READ_ONLY,
  }, async ({ query }) => ok(await tools.searchTicker(query)));

  server.registerTool('analyze_stock', {
    title: 'Analyser un titre',
    description: "Analyse quantitative compacte : note /10, 10 critères qualité (pass/warn/fail), P/FCF, prix d'achat « juste » (Buffett), percentile de valorisation, flag opportunité et grade de résilience.",
    inputSchema: { ticker: TickerSchema, lang: LangSchema },
    annotations: READ_ONLY,
  }, async ({ ticker, lang }) => {
    if (!ctx.isPro) {
      const q = await consumeAnalysisQuota(ctx.userId);
      if (!q.ok) {
        return upsell(ctx, `Quota gratuit atteint (${q.limit ?? 10} analyses / 24 h). Passe Pro pour un accès illimité.`, {
          code: 'QUOTA_EXCEEDED',
          resetInMinutes: q.resetInMinutes,
        });
      }
    }
    const r = await tools.analyzeStock(ticker, lang as Lang);
    return r ? ok(r) : fail(`Ticker ${ticker} non couvert ou non scoré.`, { code: 'NOT_FOUND' });
  });

  server.registerTool('screen_stocks', {
    title: 'Filtrer le screener',
    description: "Meilleures notes de l'univers, filtrables : note mini (ratio 0-1), P/FCF maxi, secteurs, tranches de capi (small/mid/large), zones (pea/us/intl), opportunités uniquement. Tri par ratio de note décroissant.",
    inputSchema: {
      minRatio: z.number().min(0).max(1).optional(),
      maxPfcf: z.number().positive().optional(),
      minMax: z.number().int().min(1).max(10).optional(),
      limit: z.number().int().min(1).max(100).default(25),
      opportunities: z.boolean().optional(),
      sectors: z.array(z.string()).optional(),
      caps: z.array(z.enum(['small', 'mid', 'large'])).optional(),
      zones: z.array(z.enum(['pea', 'us', 'intl'])).optional(),
    },
    annotations: READ_ONLY,
  }, async ({ minRatio, maxPfcf, minMax, limit, opportunities, sectors, caps, zones }) =>
    ok(await tools.screenStocks({ minRatio, maxPfcf, minMax, limit, onlyOpportunities: opportunities, sectors, caps, zones })));

  server.registerTool('get_resilience', {
    title: 'Résilience du modèle',
    description: "Analyse de résilience publiée : grade A-E, score /100, verdict et 6 critères (moat, résistance à la disruption, dépendances résiduelles, captation de demande, persistance économique, équilibre de récurrence) avec points de vigilance.",
    inputSchema: { ticker: TickerSchema, lang: LangSchema },
    annotations: READ_ONLY,
  }, async ({ ticker, lang }) => {
    const r = await tools.getResilience(ticker, lang as Lang);
    return r ? ok(r) : fail(`Pas d'analyse de résilience publiée pour ${ticker}.`, { code: 'NOT_FOUND' });
  });

  server.registerTool('fundamentals_trend', {
    title: 'Tendance des fondamentaux',
    description: "Signaux de tendance déjà calculés (croissance CA et FCF/action, dilution, marges, ROCE cash, dette/FCF, cycle de conversion) pour juger si les fondamentaux s'améliorent ou se dégradent.",
    inputSchema: { ticker: TickerSchema },
    annotations: READ_ONLY,
  }, async ({ ticker }) => {
    const r = await tools.fundamentalsTrend(ticker);
    return r ? ok(r) : fail(`Ticker ${ticker} non couvert.`, { code: 'NOT_FOUND' });
  });

  server.registerTool('compare_stocks', {
    title: 'Comparer des titres',
    description: `Comparaison compacte de 2 à ${MAX_COMPARE} titres (note /10, critères, valorisation, résilience). Membre gratuit : ${FREE_MAX_COMPARE} max ; Pro : ${MAX_COMPARE}.`,
    inputSchema: { tickers: z.array(TickerSchema).min(2).max(MAX_COMPARE), lang: LangSchema },
    annotations: READ_ONLY,
  }, async ({ tickers, lang }) => {
    const unique = [...new Set(tickers)];
    const cap = ctx.isPro ? MAX_COMPARE : FREE_MAX_COMPARE;
    if (unique.length > cap) {
      // Pro qui dépasse le plafond absolu : ce n'est pas un problème d'offre, pas d'upsell.
      return ctx.isPro
        ? fail(`Maximum ${MAX_COMPARE} titres à comparer.`, { code: 'TOO_MANY', limit: cap })
        : upsell(ctx, `Comparaison de plus de ${FREE_MAX_COMPARE} titres réservée aux abonnés Pro.`, { limit: cap });
    }
    return ok(await tools.compareStocks(unique, lang as Lang));
  });

  // ─── Watchlist de l'utilisateur connecté (user-scoped) ─────────────────────

  server.registerTool('get_watchlist', {
    title: 'Lister la watchlist',
    description: "Watchlist de l'utilisateur connecté : note /10, résilience et prochaine date de résultats par ligne. Valeurs issues du dernier calcul (pas du cours en direct).",
    inputSchema: {},
    annotations: READ_ONLY,
  }, async () => ok(await tools.getWatchlist(ctx.userId)));

  server.registerTool('analyze_watchlist', {
    title: 'Analyser la watchlist',
    description: "Passe en revue toute la watchlist et synthétise : note moyenne, maillons faibles (note basse ou résilience fragile), titres dont les fondamentaux se dégradent, titres au-dessus du prix d'achat « juste », opportunités. Les seuils utilisés sont renvoyés avec le résultat.",
    inputSchema: { lang: LangSchema },
    annotations: READ_ONLY,
  }, async ({ lang }) => ok(await tools.analyzeWatchlist(ctx.userId, lang as Lang)));

  server.registerTool('add_to_watchlist', {
    title: 'Ajouter à la watchlist',
    description: `Ajoute un titre à la watchlist de l'utilisateur. Membre gratuit : ${FREE_WATCHLIST_LIMIT} titres max ; Pro : illimité. Ré-ajouter un titre déjà présent ne crée pas de doublon.`,
    inputSchema: { ticker: TickerSchema },
    // Écriture, mais idempotente (upsert) et non destructrice.
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ ticker }) => {
    const r = await tools.addToWatchlist(ctx.userId, ticker, ctx.isPro);
    return r.ok ? ok(r) : upsell(ctx, r.message, { limit: r.limit, current: r.current });
  });

  server.registerTool('remove_from_watchlist', {
    title: 'Retirer de la watchlist',
    description: "Retire un titre de la watchlist de l'utilisateur. Sans effet si le titre n'y est pas.",
    inputSchema: { ticker: TickerSchema },
    // Supprime une ligne user (réversible via add_to_watchlist), donc destructiveHint.
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  }, async ({ ticker }) => ok(await tools.removeFromWatchlist(ctx.userId, ticker)));

  return server;
}
