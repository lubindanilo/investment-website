/**
 * Tests du garde-fou de DEVISE d'EDGAR.
 *
 * EDGAR ne sert ici qu'à combler les trous d'une série dont le reste (Finnhub, stockanalysis,
 * Yahoo) est libellé en devise de REPORTING. Pour un déposant 20-F étranger, le tableau `USD`
 * d'un concept XBRL n'est qu'une conversion de convenance : l'injecter mélange deux devises
 * dans la même série du store et fausse tout ratio croisant un poste de bilan avec un flux.
 *
 * On teste le helper pur, qui porte toute la décision. Le fetch réseau n'est pas testé.
 */
import { describe, it, expect } from 'vitest';
import { foreignReportingCurrency } from './secEdgar.js';

describe('foreignReportingCurrency', () => {
  /**
   * Les 29 déposants mesurés sur data.sec.gov (us-gaap/Assets) n'exposent que `USD`, qu'ils
   * soient américains (AAPL, MSFT, WMT, JPM, XOM…) ou étrangers mais reportant en USD
   * (SHOP, MELI, MNDY, FVRR, GLBE). Zéro faux positif attendu.
   */
  it('ne bloque rien quand la seule unité monétaire est USD', () => {
    expect(foreignReportingCurrency({ USD: [] })).toBeNull();
  });

  it('détecte la devise de reporting des déposants 20-F étrangers', () => {
    // Ratios de contamination mesurés en prod : ×6,99 (CNY), ×7,78 (HKD).
    expect(foreignReportingCurrency({ CNY: [], USD: [] })).toBe('CNY'); // TCOM, PDD, NTES, BILI…
    expect(foreignReportingCurrency({ HKD: [], USD: [] })).toBe('HKD'); // FUTU
    expect(foreignReportingCurrency({ JPY: [], USD: [] })).toBe('JPY'); // TM
  });

  /**
   * Un émetteur qui ne publie QUE sa devise native (ASML → EUR seul) était déjà écarté :
   * `units.USD` est absent. Le helper doit quand même le signaler, pour que le log dise
   * pourquoi plutôt que de laisser croire à un concept introuvable.
   */
  it('signale aussi une devise native sans colonne USD', () => {
    expect(foreignReportingCurrency({ EUR: [] })).toBe('EUR');
  });

  /**
   * Les unités non monétaires ne doivent jamais déclencher le garde-fou : `shares` est
   * l'unité normale du nombre d'actions, et XBRL émet aussi des unités composées.
   */
  it('ignore les unités non monétaires', () => {
    expect(foreignReportingCurrency({ shares: [] })).toBeNull();
    expect(foreignReportingCurrency({ USD: [], 'USD/shares': [], pure: [] })).toBeNull();
  });

  it('ne bloque rien sur un payload vide', () => {
    expect(foreignReportingCurrency({})).toBeNull();
  });
});

/**
 * Extraction ANNUELLE en devise native (profondeur des ADR 20-F).
 *
 * Contexte : chaque 20-F re-publie les exercices comparatifs → EDGAR détient 14-18 exercices
 * là où Yahoo plafonne à ~4 (mesuré sur TCOM). Ces deux extracteurs portent la sélection :
 * exercices PLEINS uniquement, formulaires annuels uniquement, restatements dernier-gagne.
 */
import { annualDurationPoints, annualInstantPoints } from './secEdgar.js';

describe('annualDurationPoints (flux annuels : CFO, capex, sbc, NI, revenue, shares)', () => {
  it('garde les exercices pleins des 20-F et écarte trimestres et semestres', () => {
    const pts = annualDurationPoints([
      { start: '2023-01-01', end: '2023-12-31', val: 100, form: '20-F' },   // FY → gardé
      { start: '2024-01-01', end: '2024-12-31', val: 120, form: '20-F' },   // FY → gardé
      { start: '2024-01-01', end: '2024-03-31', val: 25, form: '20-F' },    // trimestre → écarté
      { start: '2024-01-01', end: '2024-06-30', val: 55, form: '6-K' },     // semestre 6-K → écarté
    ]);
    expect(pts).toEqual([
      { date: '2023-12-31', value: 100 },
      { date: '2024-12-31', value: 120 },
    ]);
  });

  it('tolère les exercices 52/53 semaines et décalés (330-400 j)', () => {
    const pts = annualDurationPoints([
      { start: '2023-02-01', end: '2024-01-28', val: 42, form: '10-K' },    // ~361 j → gardé
    ]);
    expect(pts).toEqual([{ date: '2024-01-28', value: 42 }]);
  });

  it('applique le restatement : la re-publication comparative écrase la valeur d’origine', () => {
    const pts = annualDurationPoints([
      { start: '2023-01-01', end: '2023-12-31', val: 100, form: '20-F' },   // 20-F 2023 (original)
      { start: '2023-01-01', end: '2023-12-31', val: 98, form: '20-F' },    // comparatif du 20-F 2024 (restaté)
    ]);
    expect(pts).toEqual([{ date: '2023-12-31', value: 98 }]);
  });

  it('écarte les formulaires non annuels même sur une durée FY', () => {
    expect(annualDurationPoints([
      { start: '2023-01-01', end: '2023-12-31', val: 100, form: '6-K' },
    ])).toEqual([]);
  });
});

/**
 * Le CCC annuel des ADR (cccHistory.ts) dépend de ces 4 types : les retirer du périmètre
 * EDGAR ne casserait aucun type mais renverrait un CCC vide/court en silence pour TCOM & co.
 */
import { EDGAR_ANNUAL_TYPES } from './secEdgar.js';

describe('EDGAR_ANNUAL_TYPES', () => {
  it('couvre les 4 postes du CCC (DSO/DIO/DPO)', () => {
    for (const t of ['annualCostOfRevenue', 'annualAccountsReceivable', 'annualInventory', 'annualAccountsPayable']) {
      expect(EDGAR_ANNUAL_TYPES.has(t), t).toBe(true);
    }
  });
});

describe('annualInstantPoints (bilan : assets, curLiab, goodwill, equity)', () => {
  it('garde les instantanés de fin d’exercice des 20-F, écarte les 6-K intérimaires', () => {
    // Cas réel TCOM : Assets contient 16 entrées 20-F (fins d'exercice) + 2 entrées 6-K
    // à dates intérimaires (2015-09-30, 2016-06-30) qui polluaient la série « trimestrielle ».
    const pts = annualInstantPoints([
      { end: '2015-09-30', val: 7_749, form: '6-K' },
      { end: '2015-12-31', val: 18_346, form: '20-F' },
      { end: '2016-06-30', val: 16_885, form: '6-K/A' },
      { end: '2016-12-31', val: 20_800, form: '20-F' },
    ]);
    expect(pts).toEqual([
      { date: '2015-12-31', value: 18_346 },
      { date: '2016-12-31', value: 20_800 },
    ]);
  });

  it('ignore une entrée avec période (start) — un bilan est un instantané', () => {
    expect(annualInstantPoints([
      { start: '2023-01-01', end: '2023-12-31', val: 5, form: '20-F' },
    ])).toEqual([]);
  });
});
