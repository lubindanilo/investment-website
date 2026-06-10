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

/** `true` si la config Stripe est complète et le service peut fonctionner. */
export function isStripeConfigured(): boolean {
  return !!(SECRET && PRICE_MONTHLY && PRICE_YEARLY);
}

export interface CheckoutOptions {
  userId: string;
  email: string;
  /** Existant ? On le réutilise pour ne pas créer un doublon côté Stripe. */
  stripeCustomerId?: string | null;
  plan: 'monthly' | 'yearly';
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
  const priceId = plan === 'monthly' ? PRICE_MONTHLY : PRICE_YEARLY;
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
    cancel_url: `${SITE_URL}/pricing?checkout=cancel`,
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

/** Source de vérité pour le gate Pro côté API : statut actif ET période non expirée. */
export function isProActive(user: {
  subscriptionStatus: string;
  subscriptionCurrentPeriodEnd: Date | null;
}): boolean {
  if (user.subscriptionStatus !== 'active' && user.subscriptionStatus !== 'past_due') return false;
  if (!user.subscriptionCurrentPeriodEnd) return false;
  return user.subscriptionCurrentPeriodEnd.getTime() > Date.now();
}
