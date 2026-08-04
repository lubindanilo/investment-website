CREATE TABLE IF NOT EXISTS "ResilienceStarScore" (
  "ticker" TEXT NOT NULL,
  "name" TEXT,
  "total" DOUBLE PRECISION NOT NULL,
  "criteria" JSONB NOT NULL,
  "verdict" TEXT NOT NULL DEFAULT 'agree',
  "model" TEXT NOT NULL,
  "sonnetTotals" JSONB,
  "v3Total" DOUBLE PRECISION,
  "marketCapUsd" DOUBLE PRECISION,
  "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ResilienceStarScore_pkey" PRIMARY KEY ("ticker")
);

CREATE INDEX IF NOT EXISTS "ResilienceStarScore_total_idx" ON "ResilienceStarScore"("total");
CREATE INDEX IF NOT EXISTS "ResilienceStarScore_verdict_idx" ON "ResilienceStarScore"("verdict");
