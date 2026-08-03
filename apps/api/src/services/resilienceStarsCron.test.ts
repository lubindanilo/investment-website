import { describe, it, expect } from 'vitest';
import { selectDue, type UniverseEntry, type ScoreStore, type StoredScore } from './resilienceStarsCron.js';

const universe: UniverseEntry[] = [
  { ticker: 'SMALL', name: 'Small', marketCapUsd: 1e9, brief: 'x' },
  { ticker: 'BIG', name: 'Big', marketCapUsd: 3e12, brief: 'x' },
  { ticker: 'MID', name: 'Mid', marketCapUsd: 5e11, brief: 'x' },
];

function stored(ticker: string, scoredAt: string): StoredScore {
  return {
    ticker,
    name: ticker,
    marketCapUsd: 1,
    total: 3,
    model: 'test',
    scoredAt,
    criteria: {
      besoin: { star: 1, justification: 'x' },
      controle: { star: 0.5, justification: 'x' },
      forces: { star: 0.5, justification: 'x' },
      adjacent: { star: 0.5, justification: 'x' },
      capture: { star: 0.5, justification: 'x' },
    },
  };
}

describe('selectDue', () => {
  it('ordonne par capitalisation decroissante', () => {
    const due = selectDue(universe, {}, { dailyCap: 3, now: '2026-07-23T00:00:00Z' });
    expect(due.map(d => d.ticker)).toEqual(['BIG', 'MID', 'SMALL']);
  });

  it('respecte le plafond quotidien', () => {
    const due = selectDue(universe, {}, { dailyCap: 2, now: '2026-07-23T00:00:00Z' });
    expect(due.map(d => d.ticker)).toEqual(['BIG', 'MID']);
  });

  it('saute les entreprises deja scorees', () => {
    const store: ScoreStore = { BIG: stored('BIG', '2026-07-23T00:00:00Z') };
    const due = selectDue(universe, store, { dailyCap: 2, now: '2026-07-23T00:00:00Z' });
    expect(due.map(d => d.ticker)).toEqual(['MID', 'SMALL']);
  });

  it('ne re-score pas si staleDays=0', () => {
    const store: ScoreStore = {
      BIG: stored('BIG', '2020-01-01T00:00:00Z'),
      MID: stored('MID', '2020-01-01T00:00:00Z'),
      SMALL: stored('SMALL', '2020-01-01T00:00:00Z'),
    };
    const due = selectDue(universe, store, { dailyCap: 10, now: '2026-07-23T00:00:00Z', staleDays: 0 });
    expect(due).toHaveLength(0);
  });

  it('re-score une entree perimee (staleDays)', () => {
    const store: ScoreStore = { BIG: stored('BIG', '2026-01-01T00:00:00Z') };
    const due = selectDue(universe, store, { dailyCap: 10, now: '2026-07-23T00:00:00Z', staleDays: 90 });
    expect(due.map(d => d.ticker)).toContain('BIG');
  });
});
