/**
 * Webhook Stripe — reçoit les évènements de Stripe et met à jour l'état d'abonnement
 * en base. Sécurité critique :
 *   - Signature vérifiée avec STRIPE_WEBHOOK_SECRET (refus si invalide)
 *   - Le body doit être le RAW Buffer (pas express.json()) sinon la signature ne matche pas
 *   - Idempotent : Stripe peut retenter, on accepte les events vus plusieurs fois sans
 *     corrompre la DB (on met à jour basé sur subscription.id qui est stable)
 *
 * Évènements traités :
 *   - checkout.session.completed         : 1er paiement OK → on lie customer_id à l'user
 *   - customer.subscription.created      : abonnement créé → on enregistre statut + période
 *   - customer.subscription.updated      : changement (upgrade, renouvellement…)
 *   - customer.subscription.deleted      : annulation effective → free
 *   - invoice.payment_failed             : passage en past_due
 */
import express, { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../db/client.js';
import { getStripe, planFromPriceId, verifyWebhookSignature } from '../services/stripe.js';

export const stripeWebhookRouter: Router = Router();

// IMPORTANT : raw body — sans ça la signature Stripe ne sera jamais valide.
// Le router est monté AVANT express.json() global côté server.ts.
stripeWebhookRouter.post(
  '/stripe-webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req: Request, res: Response) => {
    if (!getStripe()) {
      // Stripe non configuré sur cet environnement → on renvoie 200 pour que Stripe
      // ne réessaie pas en boucle (la config est probablement intentionnelle en preview).
      res.status(200).send('Stripe non configuré, event ignoré');
      return;
    }

    let event: Stripe.Event;
    try {
      const sig = req.headers['stripe-signature'];
      event = verifyWebhookSignature(req.body as Buffer, typeof sig === 'string' ? sig : undefined);
    } catch (err) {
      console.error('[stripe-webhook] signature invalide:', (err as Error).message);
      res.status(400).send(`Webhook signature invalide: ${(err as Error).message}`);
      return;
    }

    try {
      await handleEvent(event);
      res.json({ received: true });
    } catch (err) {
      // 500 → Stripe va retenter. C'est ce qu'on veut pour une vraie erreur transitoire.
      console.error(`[stripe-webhook] erreur sur ${event.type}:`, (err as Error).message);
      res.status(500).send(`Erreur de traitement: ${(err as Error).message}`);
    }
  },
);

// ─── Dispatch ────────────────────────────────────────────────────────────────
async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await onSubscriptionUpsert(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      await onSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.payment_failed':
      await onPaymentFailed(event.data.object as Stripe.Invoice);
      break;
    default:
      // On ne logge pas les events non gérés (Stripe en envoie beaucoup par défaut).
      break;
  }
}

// ─── checkout.session.completed ──────────────────────────────────────────────
// 1er moment où on lie le customer_id Stripe à l'user — soit via metadata.userId
// (qu'on a passée à la création), soit via le customer_email en fallback.
async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId;
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  if (!userId || !customerId) {
    console.warn('[stripe-webhook] checkout.session.completed sans userId/customerId');
    return;
  }
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customerId },
  });
}

// ─── customer.subscription.{created,updated} ─────────────────────────────────
// Source de vérité du statut d'abonnement. Stripe nous redonne tout dans subscription.
async function onSubscriptionUpsert(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  // On retrouve l'user via le stripeCustomerId déjà mémorisé (posé par onCheckoutCompleted).
  // Si pas trouvé, on essaye la metadata posée à la création (cas où l'event subscription.created
  // arrive avant checkout.session.completed — rare mais possible).
  let user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user && sub.metadata?.userId) {
    user = await prisma.user.findUnique({ where: { id: sub.metadata.userId } });
    if (user) {
      // Backfill du customerId au passage.
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }
  }
  if (!user) {
    console.warn(`[stripe-webhook] subscription ${sub.id} : utilisateur introuvable pour customer ${customerId}`);
    return;
  }

  // Récupère le price ID du 1er item (un abonnement = un price dans notre cas)
  const priceId = sub.items.data[0]?.price.id ?? null;
  const plan = planFromPriceId(priceId);
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,           // 'active' | 'past_due' | 'canceled' | ...
      subscriptionPlan: plan,
      subscriptionCurrentPeriodEnd: typeof periodEnd === 'number'
        ? new Date(periodEnd * 1000)
        : null,
    },
  });
}

// ─── customer.subscription.deleted ───────────────────────────────────────────
// Stripe envoie ça à la fin de la période payée APRÈS annulation par l'user (ou
// après plusieurs paiements ratés). On repasse l'user en free.
async function onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) return;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: 'canceled',
      subscriptionPlan: null,
      stripeSubscriptionId: null,
      // On NE remet PAS subscriptionCurrentPeriodEnd à null — on garde la date pour
      // info, mais le gate isProActive va déjà retourner false car status != active.
    },
  });
}

// ─── invoice.payment_failed ──────────────────────────────────────────────────
// CB expirée, fonds insuffisants… Stripe va retenter, mais on flag l'user en past_due
// pour pouvoir afficher un bandeau "votre paiement a échoué, mettez à jour votre CB".
async function onPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  if (!user) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: 'past_due' },
  });
}
