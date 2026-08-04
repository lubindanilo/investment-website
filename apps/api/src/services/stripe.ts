/**
 * Service Stripe — initialise le SDK et expose des helpers pour le checkout, le portail
 * de gestion d'abonnement et le webhook.
 *
 * Variables d'environnement requises :
 *   STRIPE_SECRET_KEY        — sk_test_… ou sk_live_…
 *   STRIPE_WEBHOOK_SECRET    — whsec_…   (signature des events Stripe → côté webhook)
 *   STRIPE_PRICE_MONTHLY     — price_…   (Price ID Pro mensuel 19 €)
 *   STRIPE_PRICE_YEARLY      — price_…   (Price ID Pro annuel 159 €)
 *
 * Si STRIPE_SECRET_KEY est absente (dev local sans Stripe configuré), les endpoints
 * /api/billing/* renvoient 503 ; tout le reste de l'app continue de fonctionner.
 */
import Stripe from 'stripe';

const SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY;
const PRICE_YEARLY = process.env.STRIPE_PRICE_YEARLY;
// Offre SEO — un price ID par palier, mensuel. Facultatifs : tant qu'ils ne sont pas
// définis, tout le monde reste en `free` et l'offre SEO est simplement inactive.
const PRICE_SEO_SOLO = process.env.STRIPE_PRICE_SEO_SOLO;
const PRICE_SEO_STUDIO = process.env.STRIPE_PRICE_SEO_STUDIO;
const PRICE_SEO_AGENCY = process.env.STRIPE_PRICE_SEO_AGENCY;
const SITE_URL = (process.env.SITE_URL || 'https://lubin-investment.com').replace(/\/$/, '');

let _stripe: Stripe | null = null;

/** Lazy-init du client Stripe. Renvoie null si la clé n'est pas configurée. */
export function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  if (!SECRET) return null;
  _stripe = new Stripe(SECRET, {
    // L'API version est figée pour éviter des breaking changes silencieux
    // quand Stripe sort une nouvelle version. À mettre à jour explicitement
    // après lecture du changelog Stripe.
    apiVersion: '2026-05-27.dahlia',
    typescript: true,
  });
  return _stripe;
}

/** `true` si la config Stripe de l'offre « investissement » est complète. */
export function isStripeConfigured(): boolean {
  return !!(SECRET && PRICE_MONTHLY && PRICE_YEARLY);
}

/**
 * `true` si le plan demandé est réellement achetable.
 *
 * Distinct de `isStripeConfigured` : celle-ci exige les prix de l'offre investissement, et
 * s'en servir pour un checkout SEO renverrait 503 alors que le prix SEO est bien configuré.
 * Chaque offre a ses propres prix, donc son propre état de disponibilité.
 */
export function isPlanPurchasable(plan: CheckoutPlan): boolean {
  return !!(SECRET && priceIdForPlan(plan));
}

export interface CheckoutOptions {
  userId: string;
  email: string;
  /** Existant ? On le réutilise pour ne pas créer un doublon côté Stripe. */
  stripeCustomerId?: string | null;
  /**
   * Deux offres distinctes derrière un même endpoint :
   *   `monthly` / `yearly`            → abonnement Pro « investissement »
   *   `seo_solo` / `seo_studio` / `seo_agency` → paliers de l'offre SEO
   * Les mélanger ici est volontaire : c'est le même tunnel Stripe, le même customer, et
   * le webhook sait déjà distinguer les deux par le price ID.
   */
  plan: CheckoutPlan;
}

export type CheckoutPlan = 'monthly' | 'yearly' | 'seo_solo' | 'seo_studio' | 'seo_agency';

/** Price ID correspondant à un plan de checkout, toutes offres confondues. */
function priceIdForPlan(plan: CheckoutPlan): string | undefined {
  switch (plan) {
    case 'monthly': return PRICE_MONTHLY;
    case 'yearly': return PRICE_YEARLY;
    case 'seo_solo': return PRICE_SEO_SOLO;
    case 'seo_studio': return PRICE_SEO_STUDIO;
    case 'seo_agency': return PRICE_SEO_AGENCY;
  }
}

/**
 * Crée une Checkout Session pour l'abonnement Pro.
 * Renvoie l'URL Stripe vers laquelle rediriger l'utilisateur.
 */
export async function createCheckoutSession({
  userId,
  email,
  stripeCustomerId,
  plan,
}: CheckoutOptions): Promise<{ url: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe non configuré (STRIPE_SECRET_KEY manquante)');
  const priceId = priceIdForPlan(plan);
  if (!priceId) throw new Error(`Stripe price ID manquant pour plan=${plan}`);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    // Si on a déjà un customer Stripe pour cet user, on le réutilise → garde tout l'historique
    // d'achat lié au même customer côté Stripe. Sinon, customer_email pré-remplit le champ et
    // Stripe crée le customer après le 1er paiement (on capture l'ID via le webhook).
    ...(stripeCustomerId ? { customer: stripeCustomerId } : { customer_email: email }),
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${SITE_URL}/compte?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: plan.startsWith('seo_')
      ? `${SITE_URL}/audit-seo/tarifs?checkout=cancel`
      : `${SITE_URL}/pricing?checkout=cancel`,
    // metadata récupérée par le webhook pour matcher la session à l'user en DB
    metadata: { userId, plan },
    // Important : conformité TVA française. Stripe gère la "facturation TVA" si on l'active
    // dans le dashboard ; en micro-entrepreneur sous franchise (293 B), on laisse off.
    subscription_data: {
      metadata: { userId, plan },
    },
    // Permet à Stripe de pré-collecter le nom et l'adresse de facturation
    billing_address_collection: 'auto',
    locale: 'fr',
    allow_promotion_codes: true,
  });

  if (!session.url) throw new Error('Stripe n\'a pas renvoyé d\'URL de checkout');
  return { url: session.url };
}

/**
 * Crée une session du Customer Portal Stripe : l'utilisateur peut changer de plan, mettre à
 * jour sa CB, annuler, voir ses factures. Tout est géré par Stripe — zéro UI à écrire.
 */
export async function createPortalSession({
  stripeCustomerId,
}: {
  stripeCustomerId: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe non configuré');

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${SITE_URL}/compte`,
    locale: 'fr',
  });
  return { url: session.url };
}

/**
 * Vérifie la signature d'un webhook Stripe (sécurité critique). Refus si le secret
 * n'est pas configuré ou si la signature ne matche pas.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string | undefined,
): Stripe.Event {
  if (!WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET manquant');
  if (!signature) throw new Error('Signature Stripe absente du header');
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe non configuré');
  return stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
}

/** Plan déduit d'un Price ID Stripe. Permet de stocker `monthly` / `yearly` côté DB. */
export function planFromPriceId(priceId: string | null | undefined): 'monthly' | 'yearly' | null {
  if (!priceId) return null;
  if (priceId === PRICE_MONTHLY) return 'monthly';
  if (priceId === PRICE_YEARLY) return 'yearly';
  return null;
}

/** Les quatre paliers de l'offre SEO, du moins au plus large. L'ordre est significatif. */
export const SEO_TIERS = ['free', 'solo', 'studio', 'agency'] as const;
export type SeoTier = (typeof SEO_TIERS)[number];

/** Vrai si `value` est un palier connu — garde d'entrée pour la valeur lue en base. */
export function isSeoTier(value: string | null | undefined): value is SeoTier {
  return !!value && (SEO_TIERS as readonly string[]).includes(value);
}

/**
 * Palier SEO correspondant à un price ID Stripe.
 *
 * Renvoie `null` quand le price ID n'est pas un price SEO — cas normal : un abonné à
 * l'offre « investissement » (mensuel/annuel) n'est pas client de l'offre SEO. Le webhook
 * doit alors laisser `seoTier` inchangé plutôt que de le remettre à `free`, sinon un
 * changement d'abonnement investissement écraserait un abonnement SEO valide.
 */
export function seoTierFromPriceId(priceId: string | null | undefined): SeoTier | null {
  if (!priceId) return null;
  if (PRICE_SEO_SOLO && priceId === PRICE_SEO_SOLO) return 'solo';
  if (PRICE_SEO_STUDIO && priceId === PRICE_SEO_STUDIO) return 'studio';
  if (PRICE_SEO_AGENCY && priceId === PRICE_SEO_AGENCY) return 'agency';
  return null;
}

/** Vrai si au moins un price SEO est configuré — sinon l'offre SEO n'est pas ouverte. */
export function isSeoBillingConfigured(): boolean {
  return !!(SECRET && (PRICE_SEO_SOLO || PRICE_SEO_STUDIO || PRICE_SEO_AGENCY));
}

/**
 * Palier SEO effectif d'un utilisateur : ce qu'il a payé, MAIS ramené à `free` dès que
 * l'abonnement n'est plus honoré. Même règle de validité que `isProActive` — statut actif
 * et période non expirée — pour qu'un impayé ne laisse pas un palier ouvert indéfiniment.
 */
export function effectiveSeoTier(user: {
  seoTier: string;
  subscriptionStatus: string;
  subscriptionCurrentPeriodEnd: Date | null;
}): SeoTier {
  if (!isSeoTier(user.seoTier) || user.seoTier === 'free') return 'free';
  return isProActive(user) ? user.seoTier : 'free';
}

/** Source de vérité pour le gate Pro côté API : statut actif ET période non expirée. */
export function isProActive(user: {
  subscriptionStatus: string;
  subscriptionCurrentPeriodEnd: Date | null;
}): boolean {
  if (user.subscriptionStatus !== 'active' && user.subscriptionStatus !== 'past_due') return false;
  if (!user.subscriptionCurrentPeriodEnd) return false;
  return user.subscriptionCurrentPeriodEnd.getTime() > Date.now();
}
