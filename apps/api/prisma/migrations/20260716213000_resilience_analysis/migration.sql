-- Snapshot Resilience versionne et multilingue. Idempotent pour les redeploiements.
CREATE TABLE IF NOT EXISTS "ResilienceAnalysis" (
    "ticker" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "analysis" JSONB,
    "asOf" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResilienceAnalysis_pkey" PRIMARY KEY ("ticker", "version")
);

CREATE INDEX IF NOT EXISTS "ResilienceAnalysis_version_status_refreshedAt_idx"
  ON "ResilienceAnalysis"("version", "status", "refreshedAt");
