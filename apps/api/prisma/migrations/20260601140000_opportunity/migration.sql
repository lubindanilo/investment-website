-- « Opportunité du moment » : flag + percentile P/FCF sur ScreenerTicker. Idempotent.
ALTER TABLE "ScreenerTicker" ADD COLUMN IF NOT EXISTS "opportunity" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ScreenerTicker" ADD COLUMN IF NOT EXISTS "pfcfPercentile" DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS "ScreenerTicker_opportunity_idx" ON "ScreenerTicker" ("opportunity");
