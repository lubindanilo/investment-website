/**
 * Tests de la garde anti-dégradation du cache (isQualityDegradation).
 *
 * Objectif produit : la note affichée aux clients ne doit JAMAIS bouger sur un échec
 * transitoire de données (rate-limit Finnhub, /financials-reported qui flanche). Elle ne
 * change que sur un vrai changement de fondamentaux (recompute de qualité ≥ au cache).
 */
import { describe, it, expect } from 'vitest';
import { isQualityDegradation, computeLivePfcf, extractLivePfcfInputs, type CachedQuantSnapshot } from './quantCache.js';
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

/**
 * `extractLivePfcfInputs` alimente le contrat de `computeLivePfcf` : `adjFcfTtm` en devise de
 * REPORTING. Sur le chemin Yahoo, `metrics.pfcfTTM` inclut DÉJÀ la conversion, donc la
 * rétro-dérivation doit REdiviser par le facteur — sinon fx est appliqué deux fois et le
 * P/FCF live d'un ADR chinois sort ~7× trop cher (régression de la génération 1 du snapshot).
 * L'invariant testé : computeLivePfcf(extraction) == metrics.pfcfTTM au même prix.
 */
describe('extractLivePfcfInputs', () => {
  const yahooQuant = (opts: { marketCap: number; price: number; pfcfTTM: number; fx: number | null }) => ({
    fundamentalsSource: 'yahoo' as const,
    metrics: { marketCap: opts.marketCap, price: opts.price, pfcfTTM: opts.pfcfTTM },
    rawFhFcfAdj: null,
    rawFhCapEmp: null,
    fcfFxToQuote: opts.fx,
  });

  it('chemin Finnhub : passe-plat des valeurs /financials-reported (devise de reporting)', () => {
    const out = extractLivePfcfInputs({
      fundamentalsSource: 'finnhub',
      metrics: { marketCap: 1e6, price: 100, pfcfTTM: 20 },
      rawFhFcfAdj: { ttmFcfAdj: 5e9 },
      rawFhCapEmp: { sharesLatest: 1e9 },
      fcfFxToQuote: 1,
    });
    expect(out.adjFcfTtm).toBe(5e9);
    expect(out.sharesOutstanding).toBe(1e9);
  });

  it('chemin Yahoo fx=1 : rétro-dérivation inchangée (comportement historique)', () => {
    // capi 1 Md, prix 100 → 10 M d'actions ; P/FCF 20× → FCF 50 M
    const out = extractLivePfcfInputs(yahooQuant({ marketCap: 1e9, price: 100, pfcfTTM: 20, fx: 1 }));
    expect(out.sharesOutstanding).toBeCloseTo(1e7, 3);
    expect(out.adjFcfTtm).toBeCloseTo(5e7, 3);
  });

  /**
   * Cas ADR chinois (PDD-like) : capi 125,17 Md$ à 84,44 $, FCF publié 105,79 Md CNY,
   * fx CNY→USD 0,1484. metrics.pfcfTTM (déjà converti) ≈ 7,97×.
   */
  it('chemin Yahoo ADR : adjFcfTtm retombe en devise de REPORTING (pas de double conversion)', () => {
    const fx = 0.1484;
    const marketCap = 125.17e9;
    const fcfCny = 105.79e9;
    const pfcfTTM = marketCap / (fcfCny * fx);              // ce que stocke yahooFundamentals
    const out = extractLivePfcfInputs(yahooQuant({ marketCap, price: 84.44, pfcfTTM, fx }));
    expect(out.adjFcfTtm! / 1e9).toBeCloseTo(105.79, 1);    // CNY, pas USD

    // Invariant de cohérence : le recompute live au MÊME prix redonne le pfcfTTM du snapshot.
    const live = computeLivePfcf(84.44, out.sharesOutstanding, out.adjFcfTtm, fx)!;
    expect(live).toBeCloseTo(pfcfTTM, 6);
  });

  it('fx null ou dégénéré est traité comme 1 (et l\'invariant tient toujours)', () => {
    const out = extractLivePfcfInputs(yahooQuant({ marketCap: 1e9, price: 100, pfcfTTM: 20, fx: null }));
    expect(out.adjFcfTtm).toBeCloseTo(5e7, 3);
    const live = computeLivePfcf(100, out.sharesOutstanding, out.adjFcfTtm, null)!;
    expect(live).toBeCloseTo(20, 6);
  });

  it('source inconnue ou métriques absentes : rien à recomputer', () => {
    expect(extractLivePfcfInputs({
      fundamentalsSource: null,
      metrics: { marketCap: null, price: null, pfcfTTM: null },
      rawFhFcfAdj: null, rawFhCapEmp: null, fcfFxToQuote: null,
    })).toEqual({ adjFcfTtm: null, sharesOutstanding: null });
    expect(extractLivePfcfInputs(yahooQuant({ marketCap: 1e9, price: 100, pfcfTTM: 0 as number, fx: 1 })).adjFcfTtm).toBeNull();
  });
});
