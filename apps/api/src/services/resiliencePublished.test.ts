import { describe, expect, it } from 'vitest';
import {
  isPublishedResilienceAnalysis,
  PUBLISHED_RESILIENCE_VERSION,
} from './resiliencePublished.js';

const localized = { fr: 'Texte', en: 'Text', es: 'Texto' };

function validAnalysis() {
  const definitions = [
    ['moat', 3],
    ['disruption_resilience', 3],
    ['residual_dependencies', 2],
    ['structural_demand_capture', 2],
    ['economic_persistence', 2],
    ['recurrence_balance', 2],
  ] as const;
  return {
    version: PUBLISHED_RESILIENCE_VERSION,
    asOf: '2026-07-21T00:00:00.000Z',
    status: 'scored',
    rawScore: 79,
    finalScore: 79,
    grade: 'B',
    verdict: localized,
    confidence: 'high',
    gates: [],
    criteria: definitions.map(([id, maxScore]) => ({
      id,
      score: maxScore,
      maxScore,
      status: 'scored',
      summary: localized,
      evidence: [],
      watchpoints: [localized],
      audit: { checked: true },
    })),
  };
}

describe('published resilience snapshots', () => {
  it('accepts the complete UI contract and rejects incomplete criteria', () => {
    const analysis = validAnalysis();
    expect(isPublishedResilienceAnalysis(analysis)).toBe(true);

    analysis.criteria[0]!.watchpoints = [];
    expect(isPublishedResilienceAnalysis(analysis)).toBe(false);
  });
});
