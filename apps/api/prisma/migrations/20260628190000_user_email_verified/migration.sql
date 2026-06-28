-- Email vérifié (lien d'inscription). Non bloquant. Idempotent pour rejeu Vercel.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
