import { describe, expect, it } from 'vitest';
import { reconcileWithEdgar } from './edgarQuarterReconcile.js';

const B = 1e9;
const pts = (rows: [string, number][]) => rows.map(([date, v]) => ({ date, value: v * B }));
const fy = (rows: [string, ...number[]][]) => new Map(rows.map(([end, ...v]) => [end, v.map(x => x * B)]));

describe('reconcileWithEdgar', () => {
  it('corrige un T4 derive trop haut quand EDGAR boucle le 10-K (cas CRM FY26)', () => {
    const stored = pts([['2025-04-30', 9.83], ['2025-07-31', 10.24], ['2025-10-31', 10.26], ['2026-01-31', 13.62]]);
    const edgar = pts([['2025-04-30', 9.83], ['2025-07-31', 10.24], ['2025-10-31', 10.26], ['2026-01-31', 11.2]]);
    const { points, corrections } = reconcileWithEdgar(stored, edgar, fy([['2026-01-31', 41.53]]));
    expect(corrections).toEqual([{ date: '2026-01-31', from: 13.62 * B, to: 11.2 * B, fiscalYearEnd: '2026-01-31' }]);
    expect(points.map(p => p.value / B)).toEqual([9.83, 10.24, 10.26, 11.2]);
  });

  it('corrige un T2 reste en cumul semestriel (cas BX 06/2024)', () => {
    const stored = pts([['2024-03-31', 3.69], ['2024-06-30', 6.48], ['2024-09-30', 3.66], ['2024-12-31', 3.08]]);
    const edgar = pts([['2024-03-31', 3.69], ['2024-06-30', 2.8], ['2024-09-30', 3.66], ['2024-12-31', 3.08]]);
    expect(reconcileWithEdgar(stored, edgar, fy([['2024-12-31', 13.23]])).corrections.map(c => c.date)).toEqual(['2024-06-30']);
  });

  it("refuse une valeur EDGAR aberrante qui ne boucle pas l'exercice (cas A : CA negatif)", () => {
    const stored = pts([['2013-01-31', 1.7], ['2013-04-30', 1.75], ['2013-07-31', 1.72], ['2013-10-31', 1.718]]);
    const edgar = pts([['2013-01-31', 1.7], ['2013-04-30', 1.75], ['2013-07-31', 1.72], ['2013-10-31', -1.056]]);
    expect(reconcileWithEdgar(stored, edgar, fy([['2013-10-31', 6.78]])).corrections).toEqual([]);
  });

  it("refuse quand l'exercice boucle deja (cas AAP : EDGAR a 0,47 Md$, stocke a 2,47 et juste)", () => {
    const stored = pts([['2022-04-23', 3.37], ['2022-07-16', 2.65], ['2022-10-08', 2.62], ['2022-12-31', 2.474]]);
    const edgar = pts([['2022-04-23', 3.37], ['2022-07-16', 2.65], ['2022-10-08', 2.62], ['2022-12-31', 0.468]]);
    expect(reconcileWithEdgar(stored, edgar, fy([['2022-12-31', 11.15]])).corrections).toEqual([]);
  });

  it("ne touche a rien quand les definitions divergent (banque : agregat different d'EDGAR)", () => {
    const stored = pts([['2024-03-31', 20], ['2024-06-30', 21], ['2024-09-30', 20.5], ['2024-12-31', 21.2]]);
    const edgar = pts([['2024-03-31', 3.9], ['2024-06-30', 4.1], ['2024-09-30', 3.8], ['2024-12-31', 4]]);
    const { points, corrections } = reconcileWithEdgar(stored, edgar, fy([['2024-12-31', 15.8]]));
    expect(corrections).toEqual([]);
    expect(points).toBe(stored);
  });

  it("ne corrige pas un exercice incomplet (moins de 4 trimestres stockes)", () => {
    const stored = pts([['2024-09-30', 1.2], ['2024-12-31', 2.5]]);
    const edgar = pts([['2024-09-30', 1.2], ['2024-12-31', 1.3]]);
    expect(reconcileWithEdgar(stored, edgar, fy([['2024-12-31', 4.8]])).corrections).toEqual([]);
  });

  it('laisse une vraie saisonnalite intacte (Intuit FY25 : pic du trimestre clos fin avril)', () => {
    const stored = pts([['2024-10-31', 3.28], ['2025-01-31', 3.96], ['2025-04-30', 7.75], ['2025-07-31', 3.83]]);
    expect(reconcileWithEdgar(stored, stored.map(p => ({ ...p })), fy([['2025-07-31', 18.83]])).corrections).toEqual([]);
  });

  it('retient la variante annuelle qui boucle quand le 10-K porte plusieurs tags', () => {
    const stored = pts([['2024-03-31', 1], ['2024-06-30', 1.1], ['2024-09-30', 1.2], ['2024-12-31', 2.5]]);
    const edgar = pts([['2024-03-31', 1], ['2024-06-30', 1.1], ['2024-09-30', 1.2], ['2024-12-31', 1.3]]);
    expect(reconcileWithEdgar(stored, edgar, fy([['2024-12-31', 3.9, 4.6]])).corrections).toHaveLength(1);
  });
});

describe('reconcileWithEdgar — garde-fou de signe', () => {
  it("refuse une correction negative pour une grandeur positive (cas GEN 2014 : 1,05 Md$ -> -0,87)", () => {
    const stored = pts([['2013-06-28', 1.65], ['2013-09-27', 1.62], ['2013-12-27', 1.7], ['2014-03-28', 1.05]]);
    const edgar = pts([['2013-06-28', 1.65], ['2013-09-27', 1.62], ['2013-12-27', 1.7], ['2014-03-28', -0.868]]);
    const annual = fy([['2014-03-28', 4.102]]);
    expect(reconcileWithEdgar(stored, edgar, annual).corrections).toHaveLength(1);
    expect(reconcileWithEdgar(stored, edgar, annual, { nonNegative: true }).corrections).toEqual([]);
  });
});
