-- Abonnement Stripe + quota d'analyses sur User. Idempotent : `IF NOT EXISTS` partout
-- pour pouvoir relancer la migration sans crasher (la prod Vercel peut rejouer le déploiement).

-- Stripe customer / subscription
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCustomerId"             TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionStatus"           TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionPlan"             TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionCurrentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId"         TEXT;

-- Index uniques (créés UNIQUEMENT s'ils n'existent pas — Postgres ne supporte pas IF NOT EXISTS
-- sur CREATE UNIQUE INDEX directement, on passe par DO block).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'User_stripeCustomerId_key') THEN
    CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'User_stripeSubscriptionId_key') THEN
    CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");
  END IF;
END $$;

-- Quota d'analyses gratuites (10/jour pour les non-Pro)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dailyAnalysisCount"   INTEGER         NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dailyAnalysisResetAt" TIMESTAMP(3)    NOT NULL DEFAULT now();
