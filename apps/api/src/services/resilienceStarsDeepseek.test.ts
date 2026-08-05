import { describe, expect, it, vi } from 'vitest';
import { pairDeepseekScores } from './resilienceStarsDeepseek.js';
import type { CompanyBrief, CriterionKey, CriterionScore } from './resilienceStars.js';

function criteria(star: 0 | 0.5 | 1): Record<CriterionKey, CriterionScore> {
  return {
    besoin: { star, justification: 'x' },
    controle: { star, justification: 'x' },
    forces: { star, justification: 'x' },
    adjacent: { star, justification: 'x' },
    capture: { star, justification: 'x' },
  };
}

function brief(name: string): CompanyBrief {
  return { name, brief: 'x' };
}

describe('pairDeepseekScores', () => {
  it('apparie malgre une raison sociale reecrite par le modele', () => {
    const scores = pairDeepseekScores(
      [brief('HSBC Holdings plc'), brief('LVMH Moët Hennessy')],
      [{ nom: 'LVMH Moet Hennessy', criteria: criteria(1) }, { nom: 'HSBC', criteria: criteria(0.5) }],
      'deepseek-chat',
    );

    // HSBC ne tombe que par position, LVMH par nom canonique : les deux doivent sortir.
    expect(scores.map(s => s.name)).toEqual(['HSBC Holdings plc', 'LVMH Moët Hennessy']);
    expect(scores.map(s => s.total)).toEqual([2.5, 5]);
  });

  it('omet la ligne manquante au lieu de jeter tout le lot', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scores = pairDeepseekScores(
      [brief('Apple'), brief('Microsoft'), brief('Nvidia')],
      [{ nom: 'Apple', criteria: criteria(1) }, { nom: 'Nvidia', criteria: criteria(1) }],
      'deepseek-chat',
    );

    expect(scores.map(s => s.name)).toEqual(['Apple', 'Nvidia']);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('n attribue jamais deux fois le meme score rendu', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scores = pairDeepseekScores(
      [brief('Total'), brief('Total Energies')],
      [{ nom: 'Total', criteria: criteria(1) }],
      'deepseek-chat',
    );

    expect(scores).toHaveLength(1);
    expect(scores[0]!.name).toBe('Total');
    warn.mockRestore();
  });
});
