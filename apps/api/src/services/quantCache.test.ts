/**
 * Tests de la garde anti-dégradation du cache (isQualityDegradation).
 *
 * Objectif produit : la note affichée aux clients ne doit JAMAIS bouger sur un échec
 * transitoire de données (rate-limit Finnhub, /financials-reported qui flanche). Elle ne
 * change que sur un vrai changement de fondamentaux (recompute de qualité ≥ au cache).
 */
import { describe, it, expect } from 'vitest';
import { isQualityDegradation, computeLivePfcf, type CachedQuantSnapshot } from './quantCache.js';
import type { DerivedMetrics } from '@lubin/shared';

const QUALITY_KEYS = [
  'netMargin', 'revenueCagr', 'fcfPerShareCagr', 'shareCagr', 'fcfMargin',
  'operatingLeverage', 'cashROCE', 'netDebtFcf', 'ccr', 'nwcCurrentRatio',
] as const;

/** Construit un snapshot minimal avec `computable` des 10 métriques qualité non-null. */
function snap(opts: { source: 'finnhub' | 'yahoo' | null; available?: boolean; computable?: number }): CachedQuantSnapshot {
  const n = opts.computable ?? 10;
  const m: Record<string, unknown> = {};
  QUALITY_KEYS.forEach((k, i) => { m[k] = i < n ? (k === 'operatingLeverage' ? true : 1) : null; });
  return {
    ticker: 'X', company: 'X', currency: 'USD',
    fundamentalsSource: opts.source,
    fundamentalsAvailable: opts.available ?? true,
    metrics: m as unknown as DerivedMetrics,
    chiffres: [],
    scoreChiffres: 0, scoreChiffresMax: 0,
    adjFcfTtm: null, sharesOutstanding: null,
  };
}

describe('isQualityDegradation (garde anti-note-qui-bouge)', () => {
  it('finnhub → yahoo = dégradation (change dénominateur du score → cache conservé)', () => {
    expect(isQualityDegradation(snap({ source: 'finnhub' }), snap({ source: 'yahoo' }))).toBe(true);
  });

  it('yahoo → finnhub = amélioration, PAS bloqué', () => {
    expect(isQualityDegradation(snap({ source: 'yahoo' }), snap({ source: 'finnhub' }))).toBe(false);
  });

  it('perte des fondamentaux (available → indisponible) = dégradation', () => {
    expect(isQualityDegradation(
      snap({ source: 'finnhub', available: true }),
      snap({ source: 'finnhub', available: false }),
    )).toBe(true);
  });

  it('moins de critères calculables (régression tombée) = dégradation', () => {
    expect(isQualityDegradation(
      snap({ source: 'finnhub', computable: 10 }),
      snap({ source: 'finnhub', computable: 6 }),
    )).toBe(true);
  });

  it('même qualité = PAS bloqué (un vrai changement de fondamentaux passe)', () => {
    expect(isQualityDegradation(
      snap({ source: 'finnhub', computable: 10 }),
      snap({ source: 'finnhub', computable: 10 }),
    )).toBe(false);
  });

  it('plus de critères calculables = amélioration, PAS bloqué', () => {
    expect(isQualityDegradation(
      snap({ source: 'finnhub', computable: 8 }),
      snap({ source: 'finnhub', computable: 10 }),
    )).toBe(false);
  });
});

/**
 * `computeLivePfcf` est la formule du P/FCF « live », recalculée à CINQ endroits (chemin rapide
 * d'analyze, percentile d'opportunité, watchlist, screener ×2). La cohérence entre eux est le
 * principe fondateur de ce cache — un percentile sur une base différente de l'historique
 * bascule les cas limites — donc elle vit dans un seul helper, testé ici.
 *
 * Le paramètre de change est ce qui a corrigé le bug des ADR : le prix est en devise de
 * COTATION, le FCF en devise de REPORTING. Avant, PDD affichait 1,28× pour ~8,0× réel.
 */
describe('computeLivePfcf', () => {
  it('calcule capitalisation ÷ FCF quand les deux devises coïncident', () => {
    // 100 $ × 10 M d'actions = 1 Md$ de capi, FCF 50 M$ → 20×
    expect(computeLivePfcf(100, 10_000_000, 50_000_000, 1)).toBeCloseTo(20, 6);
  });

  it('traite un facteur absent ou null comme 1 (comportement historique préservé)', () => {
    expect(computeLivePfcf(100, 10_000_000, 50_000_000)).toBeCloseTo(20, 6);
    expect(computeLivePfcf(100, 10_000_000, 50_000_000, null)).toBeCloseTo(20, 6);
  });

  /**
   * Cas PDD reconstitué : capitalisation 125,17 Md$ et FCF 105,79 Md CNY. Sans conversion le
   * site affichait 1,18× ; au taux CNY→USD de ~0,1484 on retrouve les ~8× réels.
   */
  it('convertit le FCF dans la devise du prix (cas ADR chinois)', () => {
    const sansFx = computeLivePfcf(91.03, 1_374_858_000, 105.79e9, 1)!;
    const avecFx = computeLivePfcf(91.03, 1_374_858_000, 105.79e9, 0.14836)!;
    expect(sansFx).toBeLessThan(2);
    expect(avecFx).toBeGreaterThan(7);
    expect(avecFx).toBeLessThan(9);
    expect(avecFx / sansFx).toBeCloseTo(1 / 0.14836, 3);
  });

  it('refuse de produire un multiple sur une entrée absente ou dégénérée', () => {
    expect(computeLivePfcf(null, 10, 50, 1)).toBeNull();
    expect(computeLivePfcf(0, 10, 50, 1)).toBeNull();
    expect(computeLivePfcf(100, null, 50, 1)).toBeNull();
    expect(computeLivePfcf(100, 0, 50, 1)).toBeNull();
    expect(computeLivePfcf(100, 10, null, 1)).toBeNull();
    expect(computeLivePfcf(100, 10, 0, 1)).toBeNull();
  });

  it('renvoie null sur un FCF négatif (le multiple n’a pas de sens)', () => {
    expect(computeLivePfcf(100, 10_000_000, -50_000_000, 1)).toBeNull();
  });
});
