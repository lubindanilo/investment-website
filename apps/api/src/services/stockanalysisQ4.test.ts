/**
 * T4 manquants des flux (émetteurs coréens) : T4 = exercice − (T1 + T2 + T3), même source.
 * Chiffres réels de SK Hynix (000660.KS, FCF en T₩, stockanalysis).
 */
import { describe, it, expect } from 'vitest';
import { deriveMissingQ4, q4GapCandidates } from './stockanalysisFundamentals.js';

const d = (date: string, value: number) => ({ date, value });
const FCF_Q = [
  d('2022-03-31', -0.096), d('2022-06-30', -0.259), d('2022-09-30', -0.923),
  d('2023-03-31', -5.158), d('2023-06-30', -0.622), d('2023-09-30', -0.494),
  d('2024-03-31', 2.254), d('2024-06-30', 3.596), d('2024-09-30', 4.253), d('2024-12-31', 3.748),
  d('2025-03-31', 2.569), d('2025-06-30', 4.545), d('2025-09-30', 9.064),
];
const FCF_A = [d('2021-12-31', 7.31), d('2022-12-31', -4.23), d('2023-12-31', -4.05), d('2024-12-31', 13.85)];

describe('deriveMissingQ4', () => {
  it('reconstitue T4 2022 et T4 2023, pas 2021 (pas de T1–T3) ni 2024 (déjà là)', () => {
    const out = deriveMissingQ4(FCF_Q, FCF_A);
    const q4 = (y: string) => out.find(p => p.date === `${y}-12-31`)?.value;
    expect(q4('2022')).toBeCloseTo(-4.23 - (-0.096 - 0.259 - 0.923), 6);
    expect(q4('2023')).toBeCloseTo(-4.05 - (-5.158 - 0.622 - 0.494), 6);
    expect(q4('2024')).toBe(3.748);
    expect(q4('2021')).toBeUndefined();
    expect(out).toHaveLength(FCF_Q.length + 2);
  });

  it("l'exercice en cours (T3 sans T4 publié, pas d'annuel) reste tel quel", () => {
    const out = deriveMissingQ4(FCF_Q, FCF_A);
    expect(out.at(-1)).toEqual(d('2025-09-30', 9.064));
  });

  it('ne dérive rien quand il manque un des trois premiers trimestres', () => {
    const holed = FCF_Q.filter(p => p.date !== '2022-06-30');
    expect(deriveMissingQ4(holed, FCF_A).some(p => p.date === '2022-12-31')).toBe(false);
  });
});

describe('q4GapCandidates', () => {
  it('repère les fins 2022 et 2023, pas le T3 2025 encore en cours', () => {
    const c = q4GapCandidates(FCF_Q).map(t => new Date(t).toISOString().slice(0, 7));
    expect(c).toEqual(['2022-12', '2023-12']);
  });

  it('série complète → aucun trou', () => {
    expect(q4GapCandidates(FCF_Q.slice(6))).toEqual([]);
  });
});
