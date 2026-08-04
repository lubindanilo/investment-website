/**
 * Tests du lookup de taux à une date (`fxAt`), le helper pur du module `fx`.
 *
 * Ce que ça protège : les ratios de valorisation croisent un prix en devise de COTATION avec un
 * fondamental en devise de REPORTING. Pour un ADR (TCOM/CNY, FUTU/HKD, TM/JPY) les deux
 * diffèrent et l'omission de la conversion divisait le multiple par le taux de change. Mesuré
 * en prod avant correctif : PDD affiché 1,28× pour ~8,0× réel, ZTO 3,34× pour ~20,8×.
 *
 * Le fetch réseau n'est pas testé (Yahoo). Seule la sélection du taux l'est, et c'est elle qui
 * porte la décision « taux historique et pas taux du jour ».
 */
import { describe, it, expect } from 'vitest';
import { fxAt } from './fx.js';

// CNY→USD, quelques points mensuels réels (Yahoo CNYUSD=X).
const CNYUSD = [
  { date: '2020-08-01', value: 0.1467 },
  { date: '2022-08-01', value: 0.1480 },
  { date: '2024-08-01', value: 0.1400 },
  { date: '2026-08-01', value: 0.1481 },
];

describe('fxAt', () => {
  it('prend le dernier taux connu à la date du point (taux historique)', () => {
    expect(fxAt(CNYUSD, '2022-12-31')).toBe(0.1480);
    expect(fxAt(CNYUSD, '2024-12-31')).toBe(0.1400);
  });

  it('prend le taux exact quand la date coïncide', () => {
    expect(fxAt(CNYUSD, '2024-08-01')).toBe(0.1400);
  });

  it('prend le taux courant pour une date postérieure au dernier point', () => {
    expect(fxAt(CNYUSD, '2027-03-31')).toBe(0.1481);
  });

  /**
   * Un point de graphe plus ancien que la série FX (Yahoo n'expose ~10 ans) vaut mieux converti
   * au taux le plus proche que supprimé : le graphe garde son historique, avec une erreur bornée
   * au drift antérieur, plutôt qu'un trou.
   */
  it('retombe sur le plus ancien taux connu pour une date antérieure à la série', () => {
    expect(fxAt(CNYUSD, '2014-01-01')).toBe(0.1467);
  });

  /**
   * Série VIDE = même devise des deux côtés (cas de tous les titres US et de la plupart des
   * titres EU natifs) → identité, aucune conversion.
   */
  it('renvoie 1 quand les deux devises sont identiques', () => {
    expect(fxAt([], '2025-06-30')).toBe(1);
  });

  /**
   * Série NULL = paire indisponible. On renvoie null pour que l'appelant OMETTE le point : un
   * multiple mélangeant deux devises est faux d'un facteur 6 à 150 selon la devise, ce qui est
   * bien pire qu'un point manquant.
   */
  it('renvoie null quand le taux est inconnu, pour que le point soit omis', () => {
    expect(fxAt(null, '2025-06-30')).toBeNull();
  });
});
