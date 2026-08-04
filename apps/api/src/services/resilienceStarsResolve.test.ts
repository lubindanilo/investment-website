import { describe, it, expect } from 'vitest';
import { detectStable } from './resilienceStarsResolve.js';
import type { ResilienceStarScore } from './resilienceStars.js';

function score(name: string, total: number): ResilienceStarScore {
  // Les criteres exacts importent peu pour detectStable (base sur le total).
  return {
    name,
    total,
    model: 'test',
    criteria: {
      besoin: { star: 1, justification: 'x' },
      controle: { star: 0.5, justification: 'x' },
      forces: { star: 0.5, justification: 'x' },
      adjacent: { star: 0.5, justification: 'x' },
      capture: { star: 0.5, justification: 'x' },
    },
  };
}

describe('detectStable', () => {
  it('marque stable une entreprise dont les totaux concordent', () => {
    const runs = [[score('Apple', 4)], [score('Apple', 4)]];
    expect(detectStable(runs).get('Apple')?.stable).toBe(true);
  });

  it('marque litigieuse une entreprise dont les totaux divergent', () => {
    const runs = [[score('Alphabet', 4.5)], [score('Alphabet', 3)]];
    const info = detectStable(runs).get('Alphabet');
    expect(info?.stable).toBe(false);
    expect(info?.totals).toEqual([4.5, 3]);
  });

  it('gere plusieurs entreprises et plusieurs passages', () => {
    const runs = [
      [score('A', 4), score('B', 2)],
      [score('A', 4), score('B', 2.5)],
      [score('A', 4), score('B', 2)],
    ];
    const map = detectStable(runs);
    expect(map.get('A')?.stable).toBe(true);
    expect(map.get('B')?.stable).toBe(false);
  });
});
