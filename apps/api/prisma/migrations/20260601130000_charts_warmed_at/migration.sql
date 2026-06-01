-- Suivi du préremplissage des graphiques par la veille. Idempotent.
ALTER TABLE "ScreenerTicker" ADD COLUMN IF NOT EXISTS "chartsWarmedAt" TIMESTAMP(3);
