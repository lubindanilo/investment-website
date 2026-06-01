-- Cache persistant des séries de graphiques. Idempotent.
CREATE TABLE IF NOT EXISTS "ChartCache" (
  "key"            TEXT PRIMARY KEY,
  "points"         JSONB NOT NULL,
  "source"         TEXT NOT NULL,
  "servedFreq"     TEXT,
  "annualFallback" BOOLEAN,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "storedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ChartCache_expiresAt_idx" ON "ChartCache" ("expiresAt");
