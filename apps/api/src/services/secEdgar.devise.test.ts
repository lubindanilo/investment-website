/**
 * Devise de reporting SEC : celle des faits les PLUS RÉCENTS (YPF : ARS jusqu'en 2021, USD depuis).
 */
import { describe, it, expect } from 'vitest';
import { foreignReportingCurrency } from './secEdgar.js';

const f = (end: string) => ({ end, val: 1, form: '20-F' });

describe('foreignReportingCurrency', () => {
  it('USD seul → null (déposant en dollars)', () => {
    expect(foreignReportingCurrency({ USD: [f('2025-12-31')] })).toBeNull();
  });
  it('a basculé de ARS à USD → null (YPF)', () => {
    expect(foreignReportingCurrency({ ARS: [f('2020-12-31'), f('2021-12-31')], USD: [f('2024-12-31'), f('2025-12-31')] })).toBeNull();
  });
  it('devise native + traduction de convenance USD à la même date → native (TM, TCOM)', () => {
    expect(foreignReportingCurrency({ JPY: [f('2024-03-31'), f('2025-03-31')], USD: [f('2025-03-31')] })).toBe('JPY');
  });
  it('devise native seule → native (ASML)', () => {
    expect(foreignReportingCurrency({ EUR: [f('2025-12-31')] })).toBe('EUR');
  });
  it('ignore les unités non monétaires', () => {
    expect(foreignReportingCurrency({ USD: [f('2025-12-31')], shares: [f('2025-12-31')], 'USD/shares': [f('2025-12-31')] })).toBeNull();
  });
});
