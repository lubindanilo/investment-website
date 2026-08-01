/**
 * Smoke test du serveur MCP (Phase 1) — vérifie le câblage SDK + la validité des
 * schémas zod des tools SANS toucher la base : `tools/list` n'appelle aucun handler.
 */
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildMcpServer } from './server.js';

async function connect(isPro = false) {
  const server = buildMcpServer({ userId: 'test-user', email: 'test@example.com', isPro, baseUrl: 'https://lubin-investment.com' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

describe('MCP server', () => {
  it('expose les tools lecture + watchlist via tools/list', async () => {
    const { server, client } = await connect();

    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual([
      'add_to_watchlist',
      'analyze_stock',
      'analyze_watchlist',
      'compare_stocks',
      'fundamentals_trend',
      'get_resilience',
      'get_watchlist',
      'remove_from_watchlist',
      'screen_stocks',
      'search_ticker',
    ]);
    // Les schémas d'entrée ont été convertis en JSON Schema par le SDK (sinon registerTool aurait jeté).
    for (const t of tools) expect(t.inputSchema).toBeTruthy();

    await client.close();
    await server.close();
  });

  it('marque les tools d\'écriture comme non read-only', async () => {
    const { server, client } = await connect();
    const { tools } = await client.listTools();
    const byName = new Map(tools.map(t => [t.name, t]));

    // Les mutations de watchlist doivent être signalées comme telles au client MCP.
    expect(byName.get('add_to_watchlist')?.annotations?.readOnlyHint).toBe(false);
    expect(byName.get('remove_from_watchlist')?.annotations?.readOnlyHint).toBe(false);
    expect(byName.get('remove_from_watchlist')?.annotations?.destructiveHint).toBe(true);
    // Tout le reste est en lecture pure.
    for (const name of ['analyze_stock', 'screen_stocks', 'get_watchlist', 'analyze_watchlist']) {
      expect(byName.get(name)?.annotations?.readOnlyHint, name).toBe(true);
    }

    await client.close();
    await server.close();
  });

  // Le plafond est vérifié AVANT tout accès aux données → testable sans base.
  it('refuse la comparaison au-delà du plafond gratuit et propose l\'abonnement', async () => {
    const { server, client } = await connect(false);

    const res = await client.callTool({
      name: 'compare_stocks',
      arguments: { tickers: ['AAPL', 'MSFT', 'NVDA'] },
    });
    expect(res.isError).toBe(true);
    const payload = JSON.parse((res.content as Array<{ text: string }>)[0]!.text);
    expect(payload.code).toBe('PRO_REQUIRED');
    expect(payload.limit).toBe(2);
    // L'upsell doit porter un lien actionnable, pas juste un refus.
    expect(payload.upgradeUrl).toBe('https://lubin-investment.com/pricing');

    await client.close();
    await server.close();
  });

  it('expose le niveau de détail de analyze_watchlist, compact par défaut', async () => {
    // La sortie complète sur une grosse watchlist sature le contexte : le mode compact
    // doit être le défaut, et le mode complet rester accessible explicitement.
    const { server, client } = await connect();
    const { tools } = await client.listTools();
    const schema = tools.find(t => t.name === 'analyze_watchlist')?.inputSchema as
      | { properties?: Record<string, { enum?: string[]; default?: string }> }
      | undefined;
    const detail = schema?.properties?.detail;
    expect(detail).toBeTruthy();
    expect(detail?.enum).toEqual(['compact', 'complet']);
    expect(detail?.default).toBe('compact');
    await client.close();
    await server.close();
  });

  it('laisse un abonné Pro comparer au-delà du plafond gratuit', async () => {
    const { server, client } = await connect(true);
    const { tools } = await client.listTools();
    // Le plafond Pro (5) est bien celui annoncé dans la description du tool.
    expect(tools.find(t => t.name === 'compare_stocks')?.description).toContain('Pro : 5');
    await client.close();
    await server.close();
  });
});
