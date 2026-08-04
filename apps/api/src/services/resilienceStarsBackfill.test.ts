import { describe, expect, it } from 'vitest';
import { pairScoresWithRows } from './resilienceStarsBackfill.js';
import type { CrossCheckedScore } from './resilienceStarsCrossCheck.js';
import type { CriterionKey, CriterionScore } from './resilienceStars.js';

const criteria: Record<CriterionKey, CriterionScore> = {
  besoin: { star: 1, justification: 'x' },
  controle: { star: 1, justification: 'x' },
  forces: { star: 1, justification: 'x' },
  adjacent: { star: 1, justification: 'x' },
  capture: { star: 1, justification: 'x' },
};

function score(name: string): CrossCheckedScore {
  return {
    name,
    criteria,
    total: 5,
    model: 'test',
    sonnetTotals: [5],
    v3Total: 5,
    verdict: 'agree',
  };
}

describe('pairScoresWithRows', () => {
  it('tolere un nom de score legerement different du nom en base', () => {
    const pairs = pairScoresWithRows(
      [{ ticker: 'LVMH.PA', name: 'LVMH Moët Hennessy', sector: null, marketCapUsd: 1 }],
      [score('LVMH Moet Hennessy')],
    );

    expect(pairs.map(pair => pair.row.ticker)).toEqual(['LVMH.PA']);
  });

  it('retombe sur la position du lot quand le nom est introuvable', () => {
    const pairs = pairScoresWithRows(
      [
        { ticker: 'AAPL', name: 'Apple', sector: null, marketCapUsd: 2 },
        { ticker: 'MSFT', name: 'Microsoft', sector: null, marketCapUsd: 1 },
      ],
      [score('Apple Inc.'), score('Microsoft Corporation')],
    );

    expect(pairs.map(pair => pair.row.ticker)).toEqual(['AAPL', 'MSFT']);
  });
});
