/**
 * Test de l'instantané mémoire servi au pré-rendu bot.
 *
 * CE QUE ÇA VERROUILLE. Le module existe pour UNE raison : ne plus réveiller Neon à chaque page
 * crawlée, parce qu'un réveil isolé y coûte 5 minutes de compute facturé (mesure du 03/09/2026 :
 * 156 requêtes de robots par jour, presque toutes en cache=MISS, ≈ 13 h d'éveil sur les 20 h
 * facturées). Les deux premiers tests mesurent donc le NOMBRE DE LECTURES, pas le contenu : c'est
 * la seule chose qui décide de la facture. Le reste vérifie que les accesseurs reproduisent bien la
 * sémantique des requêtes Prisma qu'ils remplacent, et que la surface SEO survit à une base morte.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const findMany = vi.fn();
vi.mock('../db/client.js', () => ({ prisma: { screenerTicker: { findMany } } }));

const {
  getTickerRow, getRelatedBySector, getSectors, getBySector, getTopByScore, getByTickers,
  __resetSnapshotForTests,
} = await import('./seoTickerSnapshot.js');

type Row = Awaited<ReturnType<typeof getTickerRow>>;

function row(over: Partial<NonNullable<Row>> & { ticker: string }): NonNullable<Row> {
  return {
    name: `${over.ticker} Inc`, sector: 'Tech', scoreChiffres: 8, scoreChiffresMax: 10,
    pfcfTTM: 12, currency: 'USD', price: 100, opportunity: false, region: 'US',
    marketCap: 1e9, scoreRatio: 0.8, exchange: 'NASDAQ', status: 'scored',
    lastScoredAt: new Date('2026-09-01'), ...over,
  };
}

const UNIVERSE = [
  row({ ticker: 'AAA', scoreRatio: 0.9 }),
  row({ ticker: 'BBB', scoreRatio: 0.7 }),
  row({ ticker: 'CCC', scoreRatio: 0.5 }),
  row({ ticker: 'BANK1', sector: 'Banks', scoreRatio: 0.95 }),
  row({ ticker: 'BANK2', sector: 'Banks', scoreRatio: 0.6 }),
  row({ ticker: 'NOSEC', sector: null, scoreRatio: 0.99 }),
];

beforeEach(() => {
  __resetSnapshotForTests();
  findMany.mockReset();
  findMany.mockResolvedValue(UNIVERSE);
  process.env.SEO_SNAPSHOT_TTL_MS = '3600000';
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse('2026-09-03T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.SEO_SNAPSHOT_TTL_MS;
});

describe('nombre de réveils de la base', () => {
  it('sert une rafale de crawl entière avec UNE seule lecture', async () => {
    // Le cas mesuré dans les logs : ~50 fiches balayées en 6 min par la même instance.
    for (const t of ['AAA', 'BBB', 'CCC', 'BANK1', 'BANK2']) await getTickerRow(t);
    await getSectors();
    await getTopByScore(3);

    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('déduplique les chargements concurrents sur une instance froide', async () => {
    // Sans mutualisation de la promesse en vol, N requêtes simultanées lanceraient N lectures de
    // tout l'univers — exactement le pic qu'on cherche à supprimer.
    await Promise.all([getTickerRow('AAA'), getTickerRow('BBB'), getSectors(), getTopByScore(2)]);

    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('recharge une fois le TTL écoulé', async () => {
    await getTickerRow('AAA');
    vi.setSystemTime(Date.now() + 3_600_001);
    await getTickerRow('AAA');

    expect(findMany).toHaveBeenCalledTimes(2);
  });
});

describe('survie à une base injoignable', () => {
  it('re-sert l instantané précédent quand le rafraîchissement échoue', async () => {
    // Pendant la suspension Neon du 21/08 au 01/09, tout le catalogue renvoyait 503 aux crawlers.
    await getTickerRow('AAA');
    findMany.mockRejectedValue(new Error("Can't reach database server"));
    vi.setSystemTime(Date.now() + 3_600_001);

    await expect(getTickerRow('AAA')).resolves.toMatchObject({ ticker: 'AAA' });
  });

  it('propage l erreur quand il n y a aucun instantané à servir', async () => {
    // Première requête d'une instance froide avec la base morte : l'appelant doit rendre son 503.
    findMany.mockRejectedValue(new Error('cold'));

    await expect(getTickerRow('AAA')).rejects.toThrow('cold');
  });

  it('repart proprement au rafraîchissement suivant après un échec initial', async () => {
    findMany.mockRejectedValueOnce(new Error('cold'));
    await expect(getTickerRow('AAA')).rejects.toThrow('cold');

    await expect(getTickerRow('AAA')).resolves.toMatchObject({ ticker: 'AAA' });
  });
});

describe('accesseurs — même sémantique que les requêtes Prisma remplacées', () => {
  it('rend undefined pour un ticker inconnu ou pas encore noté', async () => {
    expect(await getTickerRow('ZZZ')).toBeUndefined();
  });

  it('classe le maillage sectoriel par note décroissante et exclut la fiche courante', async () => {
    expect((await getRelatedBySector('Banks', 'BANK1', 5)).map(r => r.ticker)).toEqual(['BANK2']);
    expect((await getRelatedBySector('Tech', 'BBB', 5)).map(r => r.ticker)).toEqual(['AAA', 'CCC']);
  });

  it('borne le maillage à la limite demandée', async () => {
    expect(await getRelatedBySector('Tech', 'ZZZ', 1)).toHaveLength(1);
  });

  it('ne retient que les secteurs non vides, sans doublon', async () => {
    expect([...(await getSectors())].sort()).toEqual(['Banks', 'Tech']);
  });

  it('classe un hub secteur par note décroissante', async () => {
    expect((await getBySector('Tech', 60)).map(r => r.ticker)).toEqual(['AAA', 'BBB', 'CCC']);
  });

  it('classe le palmarès global par note décroissante, secteur vide inclus', async () => {
    expect((await getTopByScore(3)).map(r => r.ticker)).toEqual(['NOSEC', 'BANK1', 'AAA']);
  });

  it('départage les ex æquo par ticker décroissant, comme le faisait Postgres', async () => {
    // Le cas qui compte vraiment : `scoreRatio` avance par pas de 0,1, donc 97 titres sont à 1,0 et
    // 504 à 0,9 en production. Sans départage explicite, quelles lignes entrent dans un palmarès de
    // 100 dépendait du plan Postgres. L'ordre retenu est celui qu'il rendait en pratique, pour que
    // la bascule vers l'instantané ne change AUCUNE page indexée (parité vérifiée sur la base).
    findMany.mockResolvedValue([
      row({ ticker: 'AAA', sector: 'Ties', scoreRatio: 0.9 }),
      row({ ticker: 'MMM', sector: 'Ties', scoreRatio: 0.9 }),
      row({ ticker: 'ZZZ', sector: 'Ties', scoreRatio: 0.9 }),
      row({ ticker: '4979.T', sector: 'Ties', scoreRatio: 0.9 }),
    ]);

    expect((await getBySector('Ties', 60)).map(r => r.ticker)).toEqual(['ZZZ', 'MMM', 'AAA', '4979.T']);
  });

  it('ne réordonne pas l univers en mémoire entre deux palmarès', async () => {
    // `sort` mute le tableau : trier `rows` en place casserait tout accesseur ultérieur.
    await getTopByScore(3);

    expect((await getBySector('Tech', 60)).map(r => r.ticker)).toEqual(['AAA', 'BBB', 'CCC']);
  });

  it('omet silencieusement les tickers absents de l instantané', async () => {
    expect((await getByTickers(['AAA', 'ZZZ', 'CCC'])).map(r => r.ticker)).toEqual(['AAA', 'CCC']);
  });
});
