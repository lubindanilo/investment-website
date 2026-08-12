/**
 * Correspondance de noms de sociétés — le garde-fou qui autorise (ou pas) l'ingestion d'une
 * page US /stocks/ atteinte par heuristique de symbole. Les cas figés ici sont tous RÉELS :
 * accepter une cousine ou une homonyme attribuerait l'effectif d'une autre société au ticker.
 */
import { describe, it, expect } from 'vitest';
import { companyNamesMatch, normalizeCompanyTokens } from './usListingResolve.js';

describe('normalizeCompanyTokens', () => {
  it('retire accents, ponctuation et formes juridiques', () => {
    expect(normalizeCompanyTokens('Hermès International Société en commandite par actions'))
      .toEqual(['hermes', 'international']);
    expect(normalizeCompanyTokens('Novo Nordisk A/S')).toEqual(['novo', 'nordisk']);
    expect(normalizeCompanyTokens('TotalEnergies SE')).toEqual(['totalenergies']);
  });
});

describe('companyNamesMatch', () => {
  it('accepte la même société sous des graphies différentes', () => {
    expect(companyNamesMatch('TotalEnergies SE', 'TotalEnergies SE')).toBe(true);
    expect(companyNamesMatch('Hermes International', 'Hermès International Société en commandite par actions')).toBe(true);
    expect(companyNamesMatch(
      'LVMH Moët Hennessy - Louis Vuitton, Société Européenne',
      'LVMH Moet Hennessy Louis Vuitton SE',
    )).toBe(true);
    expect(companyNamesMatch('Novo Nordisk A/S', 'NOVO NORDISK A S')).toBe(true);
  });

  it('rejette l\'homonyme de symbole (cas réel /stocks/mc)', () => {
    expect(companyNamesMatch('Moelis & Company', 'LVMH Moët Hennessy - Louis Vuitton, Société Européenne')).toBe(false);
  });

  it('rejette les sociétés cousines', () => {
    expect(companyNamesMatch('Siemens AG', 'Siemens Energy AG')).toBe(false);
    expect(companyNamesMatch('Orange', 'Orange County Bancorp')).toBe(false);
  });

  it('rejette les noms vides après normalisation', () => {
    expect(companyNamesMatch('SA', 'SA')).toBe(false);
  });
});
