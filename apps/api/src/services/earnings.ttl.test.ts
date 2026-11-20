import { describe, expect, it } from 'vitest';
import { ttlForPfcfSeries, ttlUntilNextEarnings } from './earnings.js';

const DAY = 24 * 60 * 60 * 1000;
const isoIn = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

describe('ttlForPfcfSeries', () => {
  it('plafonne a 24 h quand les prochains resultats sont loin (la courbe suit le cours)', () => {
    expect(ttlUntilNextEarnings(isoIn(90))).toBeGreaterThan(30 * DAY);
    expect(ttlForPfcfSeries(isoIn(90))).toBe(DAY);
  });

  it('reprend le TTL earnings quand il est plus court que 24 h', () => {
    const yesterday = isoIn(-1);
    expect(ttlForPfcfSeries(yesterday)).toBe(ttlUntilNextEarnings(yesterday));
    expect(ttlForPfcfSeries(yesterday)).toBeLessThan(DAY);
  });

  it('reste a 24 h sans date de resultats connue', () => {
    expect(ttlForPfcfSeries(null)).toBe(DAY);
  });
});
