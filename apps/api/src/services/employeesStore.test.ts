/**
 * CA par employé — parsing du payload employees stockanalysis, appariement effectif ↔ CA,
 * régression de croissance, et bascule du critère n°5 (CA/employé OU repli fcfMargin).
 *
 * Le point produit critique : un titre SANS historique d'effectifs ne doit PAS gagner un
 * warn gratuit (0,5 pt) — la grille retombe sur l'ancien critère de profitabilité cash.
 */
import { describe, it, expect } from 'vitest';
import { parseEmployeesPayload } from './stockanalysisFundamentals.js';
import { buildRevenuePerEmployeePoints, computeRevenuePerEmployeeGrowth, applyRevenuePerEmployee } from './employeesStore.js';
import { buildQuantitativeCriteria } from './derivedMetrics.js';
import type { DerivedMetrics, TimeseriesPoint } from '@lubin/shared';

const NOW = Date.parse('2026-08-12T00:00:00Z');

// ─── parseEmployeesPayload (format devalue de SvelteKit) ─────────────────────

/** Payload minimal reproduisant l'encodage observé (AAPL, 12/08/2026) : chaque objet
 *  référence ses valeurs par INDEX dans `data`, une colonne « TTM » non-ISO à ignorer. */
const DEVALUE_PAYLOAD = JSON.stringify({
  type: 'data',
  nodes: [
    { type: 'data', data: [{ session: 1 }, 'x'] },
    null,
    {
      type: 'data',
      data: [
        { stats: 1, historical: 2, historical_annual: 2 },
        { current: 3 },
        [4, 7, 10],                     // historical_annual : 3 lignes
        166000,
        { date: 5, count: 6 },          // ligne 1
        '2025-09-27', 166000,
        { date: 8, count: 9 },          // ligne 2
        '2024-09-28', 164000,
        { date: 11, count: 12 },        // ligne invalide (date non-ISO) → ignorée
        'TTM', 170000,
      ],
    },
  ],
});

describe('parseEmployeesPayload', () => {
  it('décode l\'historique annuel et le trie en ordre chronologique', () => {
    const pts = parseEmployeesPayload(DEVALUE_PAYLOAD);
    expect(pts).toEqual([
      { date: '2024-09-28', value: 164000 },
      { date: '2025-09-27', value: 166000 },
    ]);
  });

  it('renvoie null sur un payload sans historique ou illisible', () => {
    expect(parseEmployeesPayload('{"nodes":[{"data":[{"intro":1},"x"]}]}')).toBeNull();
    expect(parseEmployeesPayload('pas du json')).toBeNull();
  });
});

// ─── Appariement effectif ↔ CA ───────────────────────────────────────────────

const emp = (date: string, value: number): TimeseriesPoint => ({ date, value });

describe('buildRevenuePerEmployeePoints', () => {
  it('apparie l\'effectif au CA annuel par date de fin d\'exercice (±45 j)', () => {
    const employees = [emp('2024-09-28', 164000), emp('2025-09-27', 166000)];
    // Dates d'exercice légèrement différentes (dérive de calendrier fiscal) → quand même appariées.
    const annual = [emp('2024-09-30', 391_035e6), emp('2025-09-30', 466_823e6)];
    const pts = buildRevenuePerEmployeePoints(employees, annual, []);
    expect(pts).toHaveLength(2);
    expect(pts[1]!.value).toBeCloseTo(466_823e6 / 166000, 0);
  });

  it('recompose l\'exercice depuis 4 trimestres contigus quand l\'annuel manque', () => {
    const employees = [emp('2025-12-31', 1000)];
    const quarters = [
      emp('2025-03-31', 100), emp('2025-06-30', 110), emp('2025-09-30', 120), emp('2025-12-31', 130),
    ];
    const pts = buildRevenuePerEmployeePoints(employees, [], quarters);
    expect(pts).toEqual([{ date: '2025-12-31', value: (100 + 110 + 120 + 130) / 1000 }]);
  });

  it('recompose 2 semestres pour les émetteurs EU sans Q1/Q3', () => {
    const employees = [emp('2025-12-31', 500)];
    const halves = [emp('2024-12-31', 400), emp('2025-06-30', 450), emp('2025-12-31', 500)];
    const pts = buildRevenuePerEmployeePoints(employees, [], halves);
    expect(pts).toEqual([{ date: '2025-12-31', value: (450 + 500) / 500 }]);
  });

  it('refuse une série intra-annuelle trouée (pas un exercice complet)', () => {
    const employees = [emp('2025-12-31', 1000)];
    // Q2 manquant : la somme des 4 « derniers » points couvrirait plus d'un an.
    const quarters = [emp('2024-12-31', 90), emp('2025-03-31', 100), emp('2025-09-30', 120), emp('2025-12-31', 130)];
    expect(buildRevenuePerEmployeePoints(employees, [], quarters)).toEqual([]);
  });

  it('écarte les effectifs sous le plancher (ratio non significatif)', () => {
    const employees = [emp('2025-12-31', 5)];
    const annual = [emp('2025-12-31', 1_000_000)];
    expect(buildRevenuePerEmployeePoints(employees, annual, [])).toEqual([]);
  });
});

// ─── Croissance (régression log-linéaire, fenêtre 5,5 ans) ───────────────────

describe('computeRevenuePerEmployeeGrowth', () => {
  it('retrouve une croissance régulière de ~8 %/an', () => {
    const pts = [0, 1, 2, 3, 4].map(i =>
      emp(`${2021 + i}-12-31`, 100 * Math.pow(1.08, i)));
    const g = computeRevenuePerEmployeeGrowth(pts, NOW);
    expect(g.value).not.toBeNull();
    expect(g.value!).toBeCloseTo(0.08, 2);
  });

  it('exige au moins 3 exercices étalés sur 2 ans', () => {
    expect(computeRevenuePerEmployeeGrowth([emp('2024-12-31', 100), emp('2025-12-31', 110)], NOW).value).toBeNull();
    expect(computeRevenuePerEmployeeGrowth([], NOW).reason).toMatch(/insuffisant/);
  });

  it('ignore les points hors fenêtre 5,5 ans (même définition « 5 ans » que les autres critères)', () => {
    // 3 points dont un seul dans la fenêtre → non calculable, l'historique ancien ne compte pas.
    const pts = [emp('2015-12-31', 50), emp('2016-12-31', 60), emp('2025-12-31', 200)];
    expect(computeRevenuePerEmployeeGrowth(pts, NOW).value).toBeNull();
  });

  it('nullifie une « croissance » > 100 %/an (variation d\'effectif structurelle)', () => {
    const pts = [emp('2022-12-31', 10), emp('2023-12-31', 60), emp('2024-12-31', 400), emp('2025-12-31', 2500)];
    const g = computeRevenuePerEmployeeGrowth(pts, NOW);
    expect(g.value).toBeNull();
    expect(g.reason).toMatch(/dégénérée/);
  });
});

// ─── Bascule du critère n°5 dans la grille ───────────────────────────────────

const baseMetrics = (over: Partial<DerivedMetrics>): DerivedMetrics => ({
  netMargin: null, revenueCagr: null, fcfPerShareCagr: null, shareCagr: null, shareCagrSource: null,
  fcfMargin: null, operatingLeverage: null, cashROCE: null, netDebtFcf: null, ccr: null,
  nwc: null, nwcCurrentRatio: null, ccc: null, cccDso: null, cccDio: null, cccDpo: null,
  cccSlopeDaysPerYear: null, cccApproximated: null, pfcfTTM: null, marketCap: null, price: null,
  sbcShareOfFcf: null, floatShareOfCfo: null,
  ...over,
});

describe('critère n°5 : CA/employé avec repli fcfMargin', () => {
  it('utilise le CA/employé quand la croissance est calculable', () => {
    const chiffres = buildQuantitativeCriteria(baseMetrics({ revenuePerEmployeeCagr: 0.08, fcfMargin: 0.02 }));
    const c5 = chiffres[4]!;
    expect(c5.key).toBe('revenuePerEmployeeGrowth5y');
    expect(c5.statut).toBe('pass');
    expect(chiffres).toHaveLength(10);
    expect(chiffres.some(c => c.key === 'fcfMargin')).toBe(false);
  });

  it('note warn entre 0 et 5 %/an, fail sous 0', () => {
    expect(buildQuantitativeCriteria(baseMetrics({ revenuePerEmployeeCagr: 0.03 }))[4]!.statut).toBe('warn');
    expect(buildQuantitativeCriteria(baseMetrics({ revenuePerEmployeeCagr: -0.02 }))[4]!.statut).toBe('fail');
  });

  it('retombe sur fcfMargin quand l\'historique d\'effectifs manque', () => {
    const chiffres = buildQuantitativeCriteria(baseMetrics({ revenuePerEmployeeCagr: null, fcfMargin: 0.15 }));
    const c5 = chiffres[4]!;
    expect(c5.key).toBe('fcfMargin');
    expect(c5.statut).toBe('pass');
    expect(chiffres).toHaveLength(10);
  });

  it('retombe aussi sur fcfMargin quand le champ est absent (snapshot antérieur au critère)', () => {
    const chiffres = buildQuantitativeCriteria(baseMetrics({ fcfMargin: 0.07 }));
    expect(chiffres[4]!.key).toBe('fcfMargin');
    expect(chiffres[4]!.statut).toBe('warn');
  });
});

describe('applyRevenuePerEmployee', () => {
  it('pose la métrique et la raison de non-calcul', () => {
    const m = baseMetrics({});
    applyRevenuePerEmployee(m, { cagr: null, latest: null, employeesLatest: 120, points: [], reason: 'Effectif indisponible pour ce titre' });
    expect(m.revenuePerEmployeeCagr).toBeNull();
    expect(m.notCalculableReasons?.revenuePerEmployeeCagr).toBe('Effectif indisponible pour ce titre');

    const m2 = baseMetrics({});
    applyRevenuePerEmployee(m2, { cagr: 0.06, latest: 2_800_000, employeesLatest: 166000, points: [emp('2025-09-27', 2_800_000)] });
    expect(m2.revenuePerEmployeeCagr).toBeCloseTo(0.06, 6);
    expect(m2.employees).toBe(166000);
    expect(m2.notCalculableReasons?.revenuePerEmployeeCagr).toBeUndefined();
  });
});
