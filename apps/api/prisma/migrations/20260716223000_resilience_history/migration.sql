-- Historique immuable des adjudications publiees.
CREATE TABLE IF NOT EXISTS "ResilienceAnalysisHistory" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "analysis" JSONB NOT NULL,
    "diff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResilienceAnalysisHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ResilienceAnalysisHistory_ticker_version_asOf_key"
  ON "ResilienceAnalysisHistory"("ticker", "version", "asOf");

CREATE INDEX IF NOT EXISTS "ResilienceAnalysisHistory_ticker_version_asOf_idx"
  ON "ResilienceAnalysisHistory"("ticker", "version", "asOf");
