import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock('../db/client.js', () => ({
  prisma: {
    screenerTicker: {
      findMany: mocks.findMany,
      count: mocks.count,
    },
  },
}));

vi.mock('./resilienceSummary.js', () => ({
  getPublishedResilienceSummaries: vi.fn(async () => new Map()),
  resilienceAllowsOpportunity: vi.fn(() => true),
}));

vi.mock('./resilienceStars.js', () => ({
  getResilienceStars: vi.fn(async () => new Map()),
}));

import {
  decodeScreenerCursor,
  encodeScreenerCursor,
  getTopPage,
} from './screener.js';

function row(ticker: string, scoreChiffres: number) {
  return {
    ticker,
    name: ticker,
    scoreChiffres,
    scoreChiffresMax: 10,
    pfcfTTM: 10,
    currency: 'USD',
    nextEarningsDate: null,
    sector: 'Software',
    price: 100,
    dayChangePct: 0,
    spark: null,
    opportunity: false,
    pfcfPercentile: null,
    marketCap: 1e9,
  };
}

describe('pagination du screener', () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    mocks.count.mockReset();
  });

  it('produit un curseur opaque valide et rejette les charges invalides', () => {
    const cursor = encodeScreenerCursor('MSFT');
    expect(cursor).not.toContain('MSFT');
    expect(decodeScreenerCursor(cursor)).toBe('MSFT');
    expect(decodeScreenerCursor('pas-un-curseur')).toBeNull();
    expect(decodeScreenerCursor(Buffer.from(JSON.stringify({ v: 2, ticker: 'MSFT' })).toString('base64url'))).toBeNull();
  });

  it('filtre la Resilience avant take et utilise take + 1 pour detecter la suite', async () => {
    mocks.findMany.mockResolvedValue([row('AAA', 10), row('BBB', 9), row('CCC', 8)]);
    mocks.count.mockResolvedValue(123);

    const page = await getTopPage({ limit: 2, resilienceBands: ['fragile'] });

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 3,
      orderBy: [
        { scoreRatio: { sort: 'desc', nulls: 'last' } },
        { scoreChiffresMax: 'desc' },
        { ticker: 'asc' },
      ],
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          { resilienceStarScore: { is: { OR: [{ total: { gte: 0, lt: 2.5 } }] } } },
        ]),
      }),
    }));
    expect(page.rows.map(r => r.ticker)).toEqual(['AAA', 'BBB']);
    expect(decodeScreenerCursor(page.nextCursor!)).toBe('BBB');
    expect(page.total).toBe(123);
  });

  it('reprend apres le curseur sans recalculer le total', async () => {
    mocks.findMany.mockResolvedValue([row('CCC', 8)]);
    const cursor = encodeScreenerCursor('BBB');

    const page = await getTopPage({ limit: 2, cursor });

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      cursor: { ticker: 'BBB' },
      skip: 1,
      take: 3,
    }));
    expect(mocks.count).not.toHaveBeenCalled();
    expect(page.rows.map(r => r.ticker)).toEqual(['CCC']);
    expect(page.nextCursor).toBeNull();
    expect(page.total).toBeNull();
  });
});
