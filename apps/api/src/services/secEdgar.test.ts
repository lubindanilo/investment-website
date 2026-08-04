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
