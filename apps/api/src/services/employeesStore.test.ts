/**
 * CA par employé — parsing du payload employees stockanalysis, appariement effectif ↔ CA,
 * régression de croissance, et bascule du critère n°5 (CA/employé OU repli fcfMargin).
 *
 * Le point produit critique : un titre SANS historique d'effectifs ne doit PAS gagner un
 * warn gratuit (0,5 pt) — la grille retombe sur l'ancien critère de profitabilité cash.
 */
import { describe, it, expect } from 'vitest';
import { parseEmployeesPayload, parseRevenuePayload, parseSaCompanyName } from './stockanalysisFundamentals.js';
import { buildRevenuePerEmployeePoints, computeRevenuePerEmployeeGrowth, applyRevenuePerEmployee, extendWithDeepRevenue } from './employeesStore.js';
import { appendOnlyMerge } from './fundamentalsStore.js';
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

describe('parseSaCompanyName', () => {
  it('extrait le nom de société du nœud info (vérification anti-homonyme)', () => {
    const payload = JSON.stringify({
      nodes: [
        { type: 'data', data: [{ info: 1 }, { nameFull: 2, name: 3, ticker: 4 }, 'TotalEnergies SE', 'TotalEnergies', 'TTE'] },
      ],
    });
    expect(parseSaCompanyName(payload)).toBe('TotalEnergies SE');
    expect(parseSaCompanyName('{"nodes":[]}')).toBeNull();
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

// ─── Durabilité : l'historique survit à l'extinction de la source ────────────
//
// L'effectif n'existe QUE chez stockanalysis : si la page disparaît, change de format ou
// passe derrière un paywall, l'historique déjà accumulé doit rester exploitable. C'est le
// contrat append-only du store, vérifié ici sur les trois modes de panne réels.

describe('durabilité de l\'historique d\'effectifs', () => {
  const stock = [
    emp('2023-12-31', 42000),
    emp('2024-12-31', 43000),
    emp('2025-12-31', 44500),
  ];

  it('conserve le stock quand la source ne renvoie plus rien (404, parser cassé)', () => {
    expect(appendOnlyMerge(stock, [])).toEqual(stock);
  });

  it('conserve la profondeur quand la source tronque son historique (paywall)', () => {
    expect(appendOnlyMerge(stock, [emp('2025-12-31', 44500)])).toEqual(stock);
  });

  it('ne réécrit pas une valeur passée révisée par la source (stabilité point-in-time)', () => {
    expect(appendOnlyMerge(stock, [emp('2024-12-31', 99999)])).toEqual(stock);
  });

  it('ajoute le nouvel exercice sans toucher aux précédents', () => {
    const merged = appendOnlyMerge(stock, [emp('2026-12-31', 46000)]);
    expect(merged).toEqual([...stock, emp('2026-12-31', 46000)]);
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
  it('valide uniquement quand CA et CA/employé atteignent chacun 10 %/an', () => {
    const chiffres = buildQuantitativeCriteria(baseMetrics({ revenueCagr: 0.10, revenuePerEmployeeCagr: 0.10, fcfMargin: 0.02 }));
    const c5 = chiffres[4]!;
    expect(c5.key).toBe('revenuePerEmployeeGrowth5y');
    expect(c5.statut).toBe('pass');
    expect(chiffres).toHaveLength(10);
    expect(chiffres.some(c => c.key === 'fcfMargin')).toBe(false);
  });

  it('reste partiel si le CA/employé atteint 10 % mais pas le CA total', () => {
    expect(buildQuantitativeCriteria(baseMetrics({ revenueCagr: 0.0999, revenuePerEmployeeCagr: 0.10 }))[4]!.statut).toBe('warn');
  });

  it('reste partiel si le CA atteint 10 % et le CA/employé est entre 5 % inclus et 10 % exclus', () => {
    expect(buildQuantitativeCriteria(baseMetrics({ revenueCagr: 0.10, revenuePerEmployeeCagr: 0.05 }))[4]!.statut).toBe('warn');
    expect(buildQuantitativeCriteria(baseMetrics({ revenueCagr: 0.20, revenuePerEmployeeCagr: 0.0999 }))[4]!.statut).toBe('warn');
  });

  it('note Non tous les autres couples de croissance', () => {
    expect(buildQuantitativeCriteria(baseMetrics({ revenueCagr: 0.0999, revenuePerEmployeeCagr: 0.0999 }))[4]!.statut).toBe('fail');
    expect(buildQuantitativeCriteria(baseMetrics({ revenueCagr: 0.10, revenuePerEmployeeCagr: 0.0499 }))[4]!.statut).toBe('fail');
    expect(buildQuantitativeCriteria(baseMetrics({ revenueCagr: -0.02, revenuePerEmployeeCagr: -0.02 }))[4]!.statut).toBe('fail');
  });

  it('respecte la monotonie aux frontières 5 % et 10 %', () => {
    const statusAt = (revenuePerEmployeeCagr: number) => buildQuantitativeCriteria(baseMetrics({ revenueCagr: 0.10, revenuePerEmployeeCagr }))[4]!.statut;
    expect([statusAt(0.0499), statusAt(0.05), statusAt(0.10)]).toEqual(['fail', 'warn', 'pass']);
  });

  it('ne transforme pas un CA total manquant en faiblesse quand le CA/employé est fort', () => {
    expect(buildQuantitativeCriteria(baseMetrics({ revenueCagr: null, revenuePerEmployeeCagr: 0.10 }))[4]!.statut).toBe('warn');
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

describe('libellé de marge nette', () => {
  it.each([
    ['fr', '> 5 % de marge nette'],
    ['en', '> 5 % net margin'],
    ['es', '> 5 % de margen neto'],
  ] as const)('affiche le vrai seuil de validation en %s', (lang, cible) => {
    expect(buildQuantitativeCriteria(baseMetrics({ netMargin: 0.06 }), lang)[0]!.cible).toBe(cible);
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

// ─── CA annuel profond (page /revenue/, jusqu'à 2005) ────────────────────────

/** Payload minimal reproduisant la page /revenue/ (SPGI, 12/08/2026) : le nœud porte
 *  `data` → { annual: [{date, revenue, …}] }, une entrée invalide à ignorer. */
const REVENUE_PAYLOAD = JSON.stringify({
  type: 'data',
  nodes: [
    { type: 'data', data: [{ session: 1 }, 'x'] },
    {
      type: 'data',
      data: [
        { data: 1, meta: 8 },
        { annual: 2 },
        [3, 6, 9],                              // annual : 3 lignes
        { date: 4, revenue: 5 },
        '2025-12-31', 15_336_000_000,
        { date: 7, revenue: 8 },                // revenue pointe une string → ignorée
        '2024-12-31', 'meta',
        { date: 10, revenue: 11 },
        '2005-12-31', 6_003_642_000,
      ],
    },
  ],
});

describe('parseRevenuePayload', () => {
  it('décode la série annuelle et la trie en ordre chronologique', () => {
    expect(parseRevenuePayload(REVENUE_PAYLOAD)).toEqual([
      { date: '2005-12-31', value: 6_003_642_000 },
      { date: '2025-12-31', value: 15_336_000_000 },
    ]);
  });

  it('renvoie null sur un payload sans série annual', () => {
    expect(parseRevenuePayload('{"nodes":[{"data":[{"info":1},"x"]}]}')).toBeNull();
    expect(parseRevenuePayload('pas du json')).toBeNull();
  });
});

describe('extendWithDeepRevenue', () => {
  const primary = [emp('2023-12-31', 12.5e9), emp('2024-12-31', 14.2e9), emp('2025-12-31', 15.3e9)];

  it('étend vers le passé quand les exercices communs concordent', () => {
    const deep = [emp('2005-12-31', 6.0e9), emp('2023-12-31', 12.4e9), emp('2025-12-31', 15.3e9)];
    const out = extendWithDeepRevenue(primary, deep);
    expect(out.map(p => p.date.slice(0, 4))).toEqual(['2005', '2023', '2024', '2025']);
    // Jamais d'écrasement : sur 2023, la référence (12,5) gagne sur la profondeur (12,4).
    expect(out[1]!.value).toBe(12.5e9);
  });

  it('refuse la profondeur quand la convention diverge (ADR : USD vs devise de reporting)', () => {
    // Cas PDD-like : page /revenue/ en USD, store annuel en CNY → ratio ~1/7 sur les communs.
    const deepUsd = [emp('2005-12-31', 0.9e9), emp('2024-12-31', 2.0e9), emp('2025-12-31', 2.2e9)];
    expect(extendWithDeepRevenue(primary, deepUsd)).toEqual(primary);
  });

  it('refuse la profondeur sans exercice commun (convention invérifiable)', () => {
    const deep = [emp('2005-12-31', 6.0e9), emp('2006-12-31', 6.2e9)];
    expect(extendWithDeepRevenue(primary, deep)).toEqual(primary);
  });

  it('accepte la profondeur seule quand aucune référence n\'existe (US natif sans store annuel)', () => {
    const deep = [emp('2006-12-31', 6.2e9), emp('2005-12-31', 6.0e9)];
    expect(extendWithDeepRevenue([], deep).map(p => p.date.slice(0, 4))).toEqual(['2005', '2006']);
  });
});

describe('buildRevenuePerEmployeePoints avec CA profond', () => {
  it('produit les points anciens que le CA ordinaire ne couvre pas', () => {
    const employees = [emp('2005-12-31', 20000), emp('2024-12-31', 43000), emp('2025-12-31', 44500)];
    const annual = [emp('2024-12-31', 14.2e9), emp('2025-12-31', 15.3e9)];
    const deep = [emp('2005-12-31', 6.0e9), emp('2024-12-31', 14.2e9)];
    const pts = buildRevenuePerEmployeePoints(employees, annual, [], deep);
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ date: '2005-12-31', value: 6.0e9 / 20000 });
  });
});
