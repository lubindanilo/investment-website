-- Store canonique des séries trimestrielles brutes de fondamentaux (append-only). Idempotent.
CREATE TABLE IF NOT EXISTS "FundamentalsSeries" (
  "ticker"    TEXT NOT NULL,
  "metric"    TEXT NOT NULL,
  "points"    JSONB NOT NULL,
  "source"    TEXT NOT NULL,
  "lastEnd"   TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "builtAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FundamentalsSeries_pkey" PRIMARY KEY ("ticker", "metric")
);
CREATE INDEX IF NOT EXISTS "FundamentalsSeries_expiresAt_idx" ON "FundamentalsSeries" ("expiresAt");
