-- Phrase de presentation d'entreprise traduite (FR/EN/ES), par ticker. Idempotent (redeploys).
CREATE TABLE IF NOT EXISTS "BusinessDescription" (
    "ticker" TEXT NOT NULL,
    "en" TEXT,
    "fr" TEXT,
    "es" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessDescription_pkey" PRIMARY KEY ("ticker")
);
