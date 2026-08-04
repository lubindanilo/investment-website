import { describe, it, expect } from 'vitest';
import { median, classifyVerdict } from './resilienceStarsCrossCheck.js';

describe('median', () => {
  it('mediane impaire = valeur du milieu', () => {
    expect(median([4.5, 3, 4])).toBe(4);
  });
  it('mediane paire = moyenne des deux du milieu', () => {
    expect(median([3, 4])).toBe(3.5);
  });
  it('un seul element', () => {
    expect(median([2.5])).toBe(2.5);
  });
});

describe('classifyVerdict', () => {
  const t = 0.5;
  it('agree quand Sonnet(1) et V3 concordent', () => {
    expect(classifyVerdict(4, 4, 3.5, t)).toBe('agree');
    expect(classifyVerdict(4, 4, 4, t)).toBe('agree');
  });
  it('resolved quand la mediane Sonnet rejoint V3 apres desaccord', () => {
    // base 4.5 s'ecarte de V3 3 (>0,5), mais mediane 3 rejoint V3
    expect(classifyVerdict(4.5, 3, 3, t)).toBe('resolved');
  });
  it('flagged quand le desaccord persiste', () => {
    expect(classifyVerdict(4.5, 4.5, 3, t)).toBe('flagged');
  });
  it('flagged quand V3 manque', () => {
    expect(classifyVerdict(4, 4, null, t)).toBe('flagged');
  });
});
