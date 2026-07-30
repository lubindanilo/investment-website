-- marketCapUsd : market cap normalisé en USD (table de change statique, cf. marketTiers.ts).
-- Pilote les tiers de cadence de re-scoring du cron (large/mid/small) de façon comparable entre
-- bourses. Additive + nullable → aucun backfill requis (se remplit au re-scoring). Idempotent.
ALTER TABLE "ScreenerTicker" ADD COLUMN IF NOT EXISTS "marketCapUsd" DOUBLE PRECISION;
