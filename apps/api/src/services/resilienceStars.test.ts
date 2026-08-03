import { describe, it, expect } from 'vitest';
import { aggregateTotal, parseScores, CRITERION_KEYS, type CriterionKey, type CriterionScore } from './resilienceStars.js';

const sample = `[
  {"nom":"Acme","besoin":{"s":1,"r":"demande croit"},"controle":{"s":0.5,"r":"conteste"},"forces":{"s":0,"r":"absorbee"},"adjacent":{"s":0.5,"r":"partiel"},"capture":{"s":1,"r":"durable"}}
]`;

function criteria(values: Record<CriterionKey, number>): Record<CriterionKey, CriterionScore> {
  return Object.fromEntries(
    CRITERION_KEYS.map(k => [k, { star: values[k] as 0 | 0.5 | 1, justification: 'x' }]),
  ) as Record<CriterionKey, CriterionScore>;
}

describe('aggregateTotal', () => {
  it('somme les 5 etoiles', () => {
    expect(aggregateTotal(criteria({ besoin: 1, controle: 0.5, forces: 0, adjacent: 0.5, capture: 1 }))).toBe(3);
  });
  it('rend 0 quand tout est 0', () => {
    expect(aggregateTotal(criteria({ besoin: 0, controle: 0, forces: 0, adjacent: 0, capture: 0 }))).toBe(0);
  });
  it('rend 5 quand tout est 1', () => {
    expect(aggregateTotal(criteria({ besoin: 1, controle: 1, forces: 1, adjacent: 1, capture: 1 }))).toBe(5);
  });
});

describe('parseScores', () => {
  it('parse un tableau JSON valide', () => {
    const [row] = parseScores(sample);
    expect(row.nom).toBe('Acme');
    expect(row.criteria.besoin.star).toBe(1);
    expect(row.criteria.capture.justification).toBe('durable');
    expect(aggregateTotal(row.criteria)).toBe(3);
  });

  it('tolere un fencing markdown ```json', () => {
    const [row] = parseScores('```json\n' + sample + '\n```');
    expect(row.criteria.forces.star).toBe(0);
  });

  it('rejette une note hors de {0, 0.5, 1}', () => {
    const bad = sample.replace('"s":1', '"s":0.75');
    expect(() => parseScores(bad)).toThrow();
  });

  it('rejette une justification vide', () => {
    const bad = sample.replace('"r":"demande croit"', '"r":""');
    expect(() => parseScores(bad)).toThrow();
  });
});
