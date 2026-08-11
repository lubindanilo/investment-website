/**
 * Tests des primitives partagées par les trois services de graphes des titres non-US
 * (séries-ratio, P/FCF, Cash ROCE) : somme glissante sur douze mois, et garde-fou de définition
 * contre la référence annuelle.
 *
 * Ces deux décisions sont structurantes : « ces N périodes forment-elles vraiment douze mois
 * contigus », et « cette série recomposée dit-elle la même chose que la carte ».
 */
import { describe, it, expect } from 'vitest';
import { rollingYearSum, seriesDeviation, agreesWithAnnual } from './intraYearStore.js';

describe('rollingYearSum', () => {
  it('somme 4 trimestres et date le point sur le dernier', () => {
    const q = [
      { date: '2025-03-31', value: 10 }, { date: '2025-06-30', value: 20 },
      { date: '2025-09-30', value: 30 }, { date: '2025-12-31', value: 40 },
    ];
    expect(rollingYearSum(q, 4)).toEqual([{ date: '2025-12-31', value: 100 }]);
  });

  /**
   * Émetteur SEMESTRIEL : deux semestres font douze mois. Contrôle sur les vrais flux de
   * trésorerie d'exploitation de Vinci — la somme glissante doit redonner À L'IDENTIQUE les
   * exercices que la société publie (11 714 M€ en 2024, 11 886 M€ en 2025), sinon la marge
   * tracée ne recouperait pas la carte.
   */
  it('somme 2 semestres et retrouve les exercices publiés', () => {
    const sem = [
      { date: '2024-06-30', value: 2_878 }, { date: '2024-12-31', value: 8_836 },
      { date: '2025-06-30', value: 2_408 }, { date: '2025-12-31', value: 9_478 },
    ];
    expect(rollingYearSum(sem, 2)).toEqual([
      { date: '2024-12-31', value: 11_714 }, // exercice 2024 publié
      { date: '2025-06-30', value: 11_244 }, // 12 mois glissants à cheval
      { date: '2025-12-31', value: 11_886 }, // exercice 2025 publié
    ]);
  });

  /** Un trou dans la série ne doit pas produire un « douze mois » de vingt-quatre mois. */
  it('n’émet pas de point pour une fenêtre à cheval sur un trou', () => {
    const hole = [
      { date: '2022-06-30', value: 1 }, { date: '2022-12-31', value: 2 },
      // 2023 entier manquant
      { date: '2024-06-30', value: 3 }, { date: '2024-12-31', value: 4 },
      { date: '2025-06-30', value: 5 },
    ];
    const out = rollingYearSum(hole, 2);
    expect(out.map(p => p.date)).toEqual(['2022-12-31', '2024-12-31', '2025-06-30']);
    // La fenêtre 2022-12-31 → 2024-06-30 (18 mois) est écartée, pas sommée à 5.
    expect(out.some(p => p.date === '2024-06-30')).toBe(false);
  });

  it('renvoie une série vide quand il n’y a pas assez de périodes', () => {
    expect(rollingYearSum([{ date: '2025-12-31', value: 1 }], 2)).toEqual([]);
    expect(rollingYearSum([], 4)).toEqual([]);
  });
});

/**
 * Garde-fou de DÉFINITION du chemin EU intra-annuel : « résultat opérationnel » ne désigne pas la
 * même ligne d'une source à l'autre, et l'écart n'est pas un facteur constant qu'on pourrait
 * recalibrer. Sans ce contrôle, le graphe d'un critère contredisait la valeur de sa propre carte.
 * Les chiffres ci-dessous sont ceux mesurés en production.
 */
describe('seriesDeviation', () => {
  const pts = (byYear: Record<string, number>) =>
    Object.entries(byYear).map(([y, v]) => ({ date: `${y}-12-31`, value: v }));

  /** Nestlé : carte 15,55 % contre 13,66 % sur la dernière barre — deux lignes différentes. */
  it('détecte une divergence de définition (marge opérationnelle Nestlé)', () => {
    const annual = pts({ 2022: 16.53, 2023: 16.79, 2024: 17.02, 2025: 15.55 });
    const intra = pts({ 2022: 13.00, 2023: 15.06, 2024: 16.05, 2025: 13.66 });
    expect(seriesDeviation(intra, annual)!).toBeCloseTo(0.1215, 3);
  });

  /** Le résultat net, lui, concorde : la profondeur est légitime. */
  it('laisse passer deux sources qui décrivent la même ligne (marge nette Vinci)', () => {
    const annual = pts({ 2024: 6.29, 2025: 6.48 });
    const intra = pts({ 2024: 6.31, 2025: 6.51 });
    expect(seriesDeviation(intra, annual)!).toBeLessThan(0.02);
  });

  /** Un seul exercice commun ne tranche rien (un retraitement isolé suffirait à condamner). */
  it('refuse de conclure sous deux exercices communs', () => {
    expect(seriesDeviation(pts({ 2025: 12 }), pts({ 2025: 11 }))).toBeNull();
    expect(seriesDeviation([], pts({ 2025: 11 }))).toBeNull();
  });

  /**
   * Comparaison sur la CLÔTURE : c'est le dernier point intra-annuel de l'année qui vaut
   * l'exercice. Prendre le S1 (12 mois glissants à cheval, ici volontairement aberrant)
   * ferait échouer des séries parfaitement cohérentes.
   */
  it('compare la clôture d’exercice, pas le premier point de l’année', () => {
    const annual = pts({ 2024: 11.79, 2025: 11.89 });
    const intra = [
      { date: '2024-06-30', value: 19.0 }, { date: '2024-12-31', value: 12.12 },
      { date: '2025-06-30', value: 20.0 }, { date: '2025-12-31', value: 12.42 },
    ];
    expect(seriesDeviation(intra, annual)!).toBeCloseTo(0.0446, 3);
  });
});

/**
 * La décision réellement câblée dans les trois services. Le cas « invérifiable » compte : c'est
 * lui qui décide si on parie sur une définition qu'on n'a pas pu recouper.
 */
describe('agreesWithAnnual', () => {
  const pts = (byYear: Record<string, number>) =>
    Object.entries(byYear).map(([y, v]) => ({ date: `${y}-12-31`, value: v }));

  it('accepte deux sources qui décrivent la même ligne', () => {
    expect(agreesWithAnnual(pts({ 2024: 6.31, 2025: 6.51 }), pts({ 2024: 6.29, 2025: 6.48 }))).toBe(true);
  });

  it('refuse une divergence de définition', () => {
    const annual = pts({ 2022: 16.53, 2023: 16.79, 2024: 17.02, 2025: 15.55 });
    const intra = pts({ 2022: 13.00, 2023: 15.06, 2024: 16.05, 2025: 13.66 });
    expect(agreesWithAnnual(intra, annual)).toBe(false);
  });

  /** Invérifiable + référence utilisable → on ne parie pas : la référence garde la main. */
  it('refuse quand le recoupement est impossible mais que l’annuel suffit', () => {
    const annual = pts({ 2023: 10, 2024: 11, 2025: 12 });
    expect(agreesWithAnnual(pts({ 2025: 12 }), annual)).toBe(false);
  });

  /** Invérifiable + référence trop courte pour être servie → l'intra-annuel est la seule option. */
  it('accepte quand le recoupement est impossible et que l’annuel ne suffit pas', () => {
    expect(agreesWithAnnual(pts({ 2025: 12 }), pts({ 2025: 11 }))).toBe(true);
    expect(agreesWithAnnual(pts({ 2024: 11, 2025: 12 }), [])).toBe(true);
  });
});
