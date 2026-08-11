import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { groupRowsByCompany, runBackfill } from './resilienceStarsBackfill.js';
import { scoreWithCrossCheck } from './resilienceStarsCrossCheck.js';
import type { CrossCheckedScore } from './resilienceStarsCrossCheck.js';
import type { CriterionKey, CriterionScore } from './resilienceStars.js';

vi.mock('./resilienceStarsCrossCheck.js', () => ({ scoreWithCrossCheck: vi.fn() }));

const row = (ticker: string, name: string | null, marketCapUsd = 1) => ({
  ticker,
  name,
  sector: null,
  marketCapUsd,
});

describe('groupRowsByCompany', () => {
  it('regroupe les doubles cotations d une meme societe', () => {
    const groups = groupRowsByCompany([
      row('BRK.B', 'Berkshire Hathaway Inc', 3),
      row('AAPL', 'Apple Inc.', 2),
      row('BRK.A', 'Berkshire Hathaway Inc', 1),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]!.rows.map(r => r.ticker)).toEqual(['BRK.B', 'BRK.A']);
    expect(groups[1]!.rows.map(r => r.ticker)).toEqual(['AAPL']);
  });

  it('regroupe les trois lignes HSBC malgre les accents et la ponctuation', () => {
    const groups = groupRowsByCompany([
      row('0005.HK', 'HSBC Holdings plc'),
      row('HSBA.L', 'HSBC  Holdings, plc'),
      row('HSBC', 'HSBC Holdings PLC'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.rows.map(r => r.ticker)).toEqual(['0005.HK', 'HSBA.L', 'HSBC']);
  });

  it('note la societe sous le nom de sa plus grosse ligne, et n en perd aucune', () => {
    const rows = [row('9988.HK', 'Alibaba Group Holding Limited', 2), row('BABA', 'Alibaba Group Holding Limited', 1)];
    const groups = groupRowsByCompany(rows);

    expect(groups[0]!.brief.name).toBe('Alibaba Group Holding Limited');
    expect(groups.flatMap(g => g.rows)).toHaveLength(rows.length);
  });

  it('retombe sur le ticker quand le nom manque, sans fusionner les anonymes', () => {
    const groups = groupRowsByCompany([row('AAA', null), row('BBB', null)]);

    expect(groups).toHaveLength(2);
  });

  it('ne fusionne pas deux societes sans rapport sous un nom canonique identique', () => {
    // Merck KGaA (outils de life science) contre Merck & Co (pharma US) : la seule cle canonique les
    // avait fusionnees, et MRK.DE a porte en prod la note de MRK, Keytruda compris.
    const groups = groupRowsByCompany([
      row('MRK', 'Merck & Co Inc', 3),
      row('MRK.DE', 'Merck KGaA', 2),
      row('TITAN.NS', 'Titan Company Limited', 4),
      row('TITC.BR', 'Titan S.A.', 1),
      row('TITC.AT', 'Titan S.A.', 1),
    ]);

    expect(groups.map(g => g.rows.map(r => r.ticker))).toEqual([
      ['MRK'], ['MRK.DE'], ['TITAN.NS'], ['TITC.BR', 'TITC.AT'],
    ]);
  });
});

const criteria: Record<CriterionKey, CriterionScore> = {
  besoin: { star: 1, justification: 'x' },
  controle: { star: 1, justification: 'x' },
  forces: { star: 1, justification: 'x' },
  adjacent: { star: 0.5, justification: 'x' },
  capture: { star: 0.5, justification: 'x' },
};

function crossChecked(name: string): CrossCheckedScore {
  return { name, criteria, total: 4, model: 'sonnet', sonnetTotals: [4], v3Total: 4, verdict: 'agree' };
}

interface StoredRow {
  /** L'index d'identite compare des LIGNES : sans ticker, on ne peut pas trancher un homonyme. */
  ticker: string;
  name: string;
  total: number;
  criteria: unknown;
  verdict: string;
  model: string;
  sonnetTotals: unknown;
  v3Total: number | null;
}

/** Prisma de test : juste ce que runBackfill appelle, plus la trace des ecritures. */
function fakePrisma(due: ReturnType<typeof row>[], stored: StoredRow[]) {
  const upserted: string[] = [];
  const prisma = {
    $queryRaw: async (parts: unknown) => {
      const sql = Array.isArray(parts) ? parts.join(' ') : String(parts);
      if (sql.includes('SELECT 1')) return [{ ok: 1 }];
      if (sql.includes('COUNT(*)')) return [{ n: BigInt(due.length) }];
      return due;
    },
    screenerTicker: { count: async () => due.length },
    resilienceStarScore: {
      // L'index des notes existantes est charge en entier, une fois par run.
      findMany: async () => stored,
      upsert: async ({ where }: { where: { ticker: string } }) => {
        upserted.push(where.ticker);
        return {};
      },
    },
  };
  return { prisma: prisma as unknown as PrismaClient, upserted };
}

describe('runBackfill', () => {
  const scorer = vi.mocked(scoreWithCrossCheck);
  beforeEach(() => scorer.mockReset());

  it('recopie la note d un homonyme deja note sans rappeler les modeles', async () => {
    const { prisma, upserted } = fakePrisma(
      [row('9988.HK', 'Alibaba Group Holding Limited'), row('AAPL', 'Apple Inc.')],
      [
        {
          ticker: 'BABA',
          name: 'Alibaba Group Holding Limited',
          total: 3.5,
          criteria,
          verdict: 'agree',
          model: 'sonnet',
          sonnetTotals: [3.5],
          v3Total: 3,
        },
      ],
    );
    scorer.mockResolvedValue([crossChecked('Apple Inc.')]);

    const result = await runBackfill({ dailyCap: 2, prisma });

    // Seule Apple est passee devant les modeles ; Alibaba a ete recopiee.
    expect(scorer.mock.calls[0]![0].map(brief => brief.name)).toEqual(['Apple Inc.']);
    expect(upserted).toEqual(['9988.HK', 'AAPL']);
    expect(result.copiedFromHomonym).toBe(1);
    expect(result.scored).toBe(2);
  });

  it('recopie malgre une raison sociale ecrite differemment par les deux fournisseurs', async () => {
    const { prisma, upserted } = fakePrisma(
      [row('TD.TO', 'The Toronto-Dominion Bank')],
      [
        {
          ticker: 'TD',
          name: 'Toronto-Dominion Bank',
          total: 4,
          criteria,
          verdict: 'agree',
          model: 'sonnet',
          sonnetTotals: [4],
          v3Total: 4,
        },
      ],
    );
    scorer.mockResolvedValue([]);

    const result = await runBackfill({ dailyCap: 1, prisma });

    expect(upserted).toEqual(['TD.TO']);
    expect(result.copiedFromHomonym).toBe(1);
    // Rien a noter : la recopie a tout couvert, les modeles recoivent un lot vide.
    expect(scorer.mock.calls[0]![0]).toEqual([]);
  });

  it('ne recopie PAS la note d une societe qui partage seulement le nom canonique', async () => {
    // Le vrai chemin du bug MRK.DE : la ligne supprimee le 07/08 est bien repiochee, mais le panier
    // « merck » ne contenait que Merck & Co et la note a ete recopiee sans appeler un modele.
    const { prisma, upserted } = fakePrisma(
      [row('MRK.DE', 'Merck KGaA')],
      [
        {
          ticker: 'MRK',
          name: 'Merck & Co Inc',
          total: 1.5,
          criteria,
          verdict: 'agree',
          model: 'sonnet',
          sonnetTotals: [1.5],
          v3Total: 1.5,
        },
      ],
    );
    scorer.mockResolvedValue([crossChecked('Merck KGaA')]);

    const result = await runBackfill({ dailyCap: 1, prisma });

    expect(scorer.mock.calls[0]![0].map(brief => brief.name)).toEqual(['Merck KGaA']);
    expect(upserted).toEqual(['MRK.DE']);
    expect(result.copiedFromHomonym).toBe(0);
  });

  it('note separement deux homonymes du meme lot au lieu de leur donner la meme note', async () => {
    const { prisma, upserted } = fakePrisma(
      [row('AGX', 'Argan Inc', 2), row('ARG.PA', 'Argan SA', 1)],
      [],
    );
    scorer.mockResolvedValue([crossChecked('Argan Inc'), crossChecked('Argan SA')]);

    const result = await runBackfill({ dailyCap: 2, prisma });

    // Deux briefs partis aux modeles, deux lignes ecrites, aucune recopie.
    expect(scorer.mock.calls[0]![0].map(brief => brief.name)).toEqual(['Argan Inc', 'Argan SA']);
    expect(upserted).toEqual(['AGX', 'ARG.PA']);
    expect(result.copiedFromHomonym).toBe(0);
    expect(result.scored).toBe(2);
  });

  it('ecarte les vehicules non operants sans consommer d appel aux modeles', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { prisma, upserted } = fakePrisma(
      [row('CXII', 'Churchill Capital Corp XII Acquisition Corp'), row('AAPL', 'Apple Inc.')],
      [],
    );
    scorer.mockResolvedValue([crossChecked('Apple Inc.')]);

    const result = await runBackfill({ dailyCap: 2, prisma });

    expect(scorer.mock.calls[0]![0].map(brief => brief.name)).toEqual(['Apple Inc.']);
    expect(upserted).toEqual(['AAPL']);
    expect(result.scored).toBe(1);
    warn.mockRestore();
  });

  it('une societe sans note ne fait pas tomber les autres du run', async () => {
    const { prisma, upserted } = fakePrisma(
      [row('AAPL', 'Apple Inc.'), row('MSFT', 'Microsoft Corporation'), row('NVDA', 'Nvidia Corporation')],
      [],
    );
    // Le lot revient INCOMPLET : Microsoft manque (lot Sonnet ou DeepSeek perdu).
    scorer.mockResolvedValue([crossChecked('Apple Inc.'), crossChecked('Nvidia Corporation')]);

    const result = await runBackfill({ dailyCap: 3, prisma });

    expect(upserted).toEqual(['AAPL', 'NVDA']);
    expect(result.scored).toBe(2);
    expect(result.skippedNoCrossCheck).toBe(1);
    expect(result.failedBatches).toBe(0);
  });

  it('une tranche qui explose garde le travail des tranches precedentes', async () => {
    const { prisma, upserted } = fakePrisma(
      [row('AAPL', 'Apple Inc.'), row('MSFT', 'Microsoft Corporation')],
      [],
    );
    scorer
      .mockResolvedValueOnce([crossChecked('Apple Inc.')])
      .mockRejectedValueOnce(new Error('DeepSeek 500'));

    const result = await runBackfill({ dailyCap: 2, prisma, batchSize: 1 });

    expect(upserted).toEqual(['AAPL']);
    expect(result.scored).toBe(1);
    expect(result.failedBatches).toBe(1);
  });
});
