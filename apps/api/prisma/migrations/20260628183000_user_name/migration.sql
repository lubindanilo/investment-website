-- Prénom / nom sur User (saisis à l'inscription). Nullable : les comptes existants
-- restent valides (NULL), les initiales du menu sont alors dérivées de l'email.
-- Idempotent (IF NOT EXISTS) : la prod Vercel peut rejouer le déploiement.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastName"  TEXT;
