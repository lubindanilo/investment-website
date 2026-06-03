/**
 * Tests de la garde anti-dégradation du cache (isQualityDegradation).
 *
 * Objectif produit : la note affichée aux clients ne doit JAMAIS bouger sur un échec
 * transitoire de données (rate-limit Finnhub, /financials-reported qui flanche). Elle ne
 * change que sur un vrai changement de fondamentaux (recompute de qualité ≥ au cache).
 */
import { describe, it, expect } from 'vitest';
import { isQualityDegradation, type CachedQuantSnapshot } from './quantCache.js';
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
