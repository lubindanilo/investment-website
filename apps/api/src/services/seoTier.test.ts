/**
 * Tests du palier SEO — c'est le chemin de facturation. Une erreur ici donne le produit
 * gratuitement, ou bloque un client qui paie. Les deux coûtent cher, donc on le teste
 * plutôt que de le supposer.
 *
 * Les price IDs sont lus depuis l'environnement au chargement du module, donc on les pose
 * AVANT l'import dynamique.
 */
import { describe, it, expect, beforeAll } from 'vitest';

type StripeMod = typeof import('./stripe.js');
let mod: StripeMod;

beforeAll(async () => {
  process.env.STRIPE_PRICE_SEO_SOLO = 'price_seo_solo';
  process.env.STRIPE_PRICE_SEO_STUDIO = 'price_seo_studio';
  process.env.STRIPE_PRICE_SEO_AGENCY = 'price_seo_agency';
  process.env.STRIPE_PRICE_MONTHLY = 'price_invest_monthly';
  mod = await import('./stripe.js');
});

const future = new Date(Date.now() + 30 * 24 * 3600_000);
const past = new Date(Date.now() - 24 * 3600_000);

describe('seoTierFromPriceId', () => {
  it('mappe chaque price SEO sur son palier', () => {
    expect(mod.seoTierFromPriceId('price_seo_solo')).toBe('solo');
    expect(mod.seoTierFromPriceId('price_seo_studio')).toBe('studio');
    expect(mod.seoTierFromPriceId('price_seo_agency')).toBe('agency');
  });

  it('renvoie null pour un price NON-SEO, pour que le webhook laisse le palier intact', () => {
    // Le point important : un abonné à l'offre « investissement » qui change de formule ne
    // doit PAS voir son abonnement SEO remis à zéro. Le null est ce qui protège ça.
    expect(mod.seoTierFromPriceId('price_invest_monthly')).toBeNull();
    expect(mod.seoTierFromPriceId(null)).toBeNull();
    expect(mod.seoTierFromPriceId(undefined)).toBeNull();
    expect(mod.seoTierFromPriceId('price_inconnu')).toBeNull();
  });
});

describe('effectiveSeoTier', () => {
  it('rend le palier payé quand l’abonnement est honoré', () => {
    expect(mod.effectiveSeoTier({
      seoTier: 'studio', subscriptionStatus: 'active', subscriptionCurrentPeriodEnd: future,
    })).toBe('studio');
  });

  it('tolère past_due jusqu’à la fin de période payée', () => {
    // Un incident de paiement ne doit pas couper l'accès le jour même : Stripe réessaie.
    expect(mod.effectiveSeoTier({
      seoTier: 'solo', subscriptionStatus: 'past_due', subscriptionCurrentPeriodEnd: future,
    })).toBe('solo');
  });

  it('retombe à free dès que la période est expirée', () => {
    expect(mod.effectiveSeoTier({
      seoTier: 'agency', subscriptionStatus: 'active', subscriptionCurrentPeriodEnd: past,
    })).toBe('free');
  });

  it('retombe à free sur un abonnement annulé, même avec un palier en base', () => {
    expect(mod.effectiveSeoTier({
      seoTier: 'agency', subscriptionStatus: 'canceled', subscriptionCurrentPeriodEnd: future,
    })).toBe('free');
  });

  it('retombe à free sans date de fin de période', () => {
    expect(mod.effectiveSeoTier({
      seoTier: 'studio', subscriptionStatus: 'active', subscriptionCurrentPeriodEnd: null,
    })).toBe('free');
  });

  it('ignore une valeur de palier inconnue en base plutôt que de la propager', () => {
    expect(mod.effectiveSeoTier({
      seoTier: 'enterprise_v2', subscriptionStatus: 'active', subscriptionCurrentPeriodEnd: future,
    })).toBe('free');
  });
});

describe('plafonds par palier', () => {
  it('le test de visibilité IA n’est jamais rationné : aucun palier ne le plafonne', async () => {
    const gating = await import('../mcp/gating.js');
    // Le seul quota est celui des audits. Si un plafond de visibilité IA apparaissait un jour
    // dans gating.ts, ce test devrait échouer — c'est volontaire, c'est l'hameçon du produit.
    expect(Object.keys(gating.AUDITS_PER_MONTH).sort()).toEqual(['agency', 'free', 'solo', 'studio']);
    expect(gating.AUDITS_PER_MONTH.free).toBe(1);
    expect(gating.AUDITS_PER_MONTH.solo).toBeNull();
  });

  it('les plafonds de crawl sont strictement croissants', async () => {
    const { CRAWL_PAGE_CAP } = await import('../mcp/gating.js');
    expect(CRAWL_PAGE_CAP.free).toBeLessThan(CRAWL_PAGE_CAP.solo);
    expect(CRAWL_PAGE_CAP.solo).toBeLessThan(CRAWL_PAGE_CAP.studio);
    expect(CRAWL_PAGE_CAP.studio).toBeLessThan(CRAWL_PAGE_CAP.agency);
    expect(CRAWL_PAGE_CAP.free).toBe(25);
    expect(CRAWL_PAGE_CAP.agency).toBe(50_000);
  });

  it('l’historique et le comparatif s’ouvrent au bon palier', async () => {
    const { HAS_HISTORY, HAS_BENCHMARK, HAS_WHITE_LABEL } = await import('../mcp/gating.js');
    expect(HAS_HISTORY).toMatchObject({ free: false, solo: true });
    expect(HAS_BENCHMARK).toMatchObject({ solo: false, studio: true });
    expect(HAS_WHITE_LABEL).toMatchObject({ studio: false, agency: true });
  });
});
