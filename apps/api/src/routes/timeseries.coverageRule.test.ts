/**
 * Arbitrage intra-annuel / annuel de la branche EU de /api/timeseries.
 *
 * La question n'est pas « quelle série est la plus fine » mais « laquelle couvre le mieux la
 * fenêtre demandée ». Les cas ci-dessous sont les états RÉELS mesurés en production sur Vinci
 * (DG.PA) après le backfill : chaque métrique y a sa propre profondeur, ce qui rend l'arbitrage
 * visible métrique par métrique.
 */
import { describe, it, expect } from 'vitest';
import { preferIntraYear } from './timeseries.js';
import type { TimeseriesPoint } from '@lubin/shared';

/** Série factice bornée à ses dates de début et de fin — seul le premier point compte ici. */
const series = (start: string, n: number): TimeseriesPoint[] =>
  Array.from({ length: n }, (_, i) => ({ date: `${Number(start.slice(0, 4)) + i}-12-31`, value: 1 }));

describe('preferIntraYear', () => {
  describe('fenêtre courte (le client demande du trimestriel)', () => {
    it('sert le détail intra-annuel à couverture égale', () => {
      // CA de Vinci sur 5Y : 10 semestres depuis 2021 contre 5 exercices depuis 2021.
      expect(preferIntraYear(series('2021', 10), series('2021', 5), 'quarterly')).toBe(true);
    });

    it('sert le détail quand l’annuel démarre même un peu plus tôt', () => {
      // Nombre d'actions de Vinci : semestres depuis 2021, exercices depuis 2022 — l'écart joue
      // ici EN FAVEUR de l'intra-annuel, mais le cas inverse à moins d'un an doit passer aussi.
      expect(preferIntraYear(series('2022', 9), series('2021', 5), 'quarterly')).toBe(true);
    });

    /** Le défaut corrigé : la fenêtre étroite était moins remplie que la large. */
    it('rend la main à l’annuel quand l’intra-annuel couvre des années de moins', () => {
      // Dette de Vinci sur 5Y : 4 semestres accumulés depuis fin 2024 (deux ans) contre
      // 5 exercices depuis 2021.
      expect(preferIntraYear(series('2024', 4), series('2021', 5), 'quarterly')).toBe(false);
    });
  });

  describe('fenêtre longue (le client demande de l’annuel)', () => {
    it('sert l’intra-annuel quand il remonte plus loin', () => {
      // FCF de Vinci sur 10Y : 20 semestres depuis 2016 contre 5 exercices depuis 2021.
      expect(preferIntraYear(series('2016', 20), series('2021', 5), 'annual')).toBe(true);
    });

    it('garde l’annuel à égalité, ses barres étant plus lisibles', () => {
      expect(preferIntraYear(series('2021', 10), series('2021', 5), 'annual')).toBe(false);
    });

    it('garde l’annuel quand il remonte plus loin', () => {
      expect(preferIntraYear(series('2024', 4), series('2021', 5), 'annual')).toBe(false);
    });
  });

  describe('cas dégénérés', () => {
    it('refuse un intra-annuel trop court pour être tracé', () => {
      expect(preferIntraYear(series('2025', 2), series('2021', 5), 'quarterly')).toBe(false);
    });

    it('sert l’intra-annuel quand l’annuel est inexploitable, plutôt que « pas de données »', () => {
      expect(preferIntraYear(series('2024', 4), series('2025', 1), 'quarterly')).toBe(true);
      expect(preferIntraYear(series('2024', 4), [], 'annual')).toBe(true);
    });
  });
});
