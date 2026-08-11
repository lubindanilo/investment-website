/**
 * Verrouille le CONTRAT des en-têtes de cache publics, pas leur formatage.
 *
 * L'invariant qui compte : chaque TTL CDN doit rester très au-dessus de la fenêtre de suspension
 * Neon (5 min). Un TTL de 60 s aurait l'air correct, passerait en revue, et ramènerait exactement
 * la panne du 10/08/2026 — base éveillée 23,5 h/j, quota gratuit épuisé en trois semaines.
 */
import { describe, it, expect } from 'vitest';
import { CDN_TTL, publicCacheControl } from './publicCache.js';

/** Délai de suspension du compute Neon. En dessous, la base ne se rendort jamais. */
const NEON_AUTOSUSPEND_S = 300;

describe('CDN_TTL', () => {
  it('garde chaque TTL au moins 5× au-dessus de la fenêtre de suspension Neon', () => {
    for (const [nature, ttl] of Object.entries(CDN_TTL)) {
      expect(ttl, `TTL « ${nature} » trop court pour laisser Neon se rendormir`)
        .toBeGreaterThanOrEqual(NEON_AUTOSUSPEND_S * 5);
    }
  });

  it('ordonne les TTL du plus volatil au plus figé', () => {
    expect(CDN_TTL.quotes).toBeLessThan(CDN_TTL.ranking);
    expect(CDN_TTL.ranking).toBeLessThan(CDN_TTL.nightly);
  });
});

describe('publicCacheControl', () => {
  it('porte l économie sur s-maxage (cache partagé) et garde le navigateur court', () => {
    const h = publicCacheControl(CDN_TTL.quotes);

    expect(h).toContain('s-maxage=1800');
    expect(h).toContain('max-age=60');
    expect(h).toContain('public');
  });

  it('sert en périmé pendant la revalidation, sinon monter les TTL dégraderait la latence', () => {
    expect(publicCacheControl(CDN_TTL.nightly)).toMatch(/stale-while-revalidate=\d+/);
  });

  it('ne pose jamais no-store ni private, qui neutraliseraient le cache partagé', () => {
    const all = Object.values(CDN_TTL).map(ttl => publicCacheControl(ttl));

    for (const h of all) {
      expect(h).not.toContain('no-store');
      expect(h).not.toContain('private');
      expect(h).not.toContain('must-revalidate');
    }
  });
});
