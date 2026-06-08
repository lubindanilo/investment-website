-- Portefeuille personnel suivi (page « Stratégie portefeuille »). Achats/ventes saisis
-- manuellement par le propriétaire → suivi forward « Ma sélection ». Idempotent.
CREATE TABLE IF NOT EXISTS "PortfolioPosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "buyDate" TEXT NOT NULL,
    "buyPrice" DOUBLE PRECISION NOT NULL,
    "sellDate" TEXT,
    "sellPrice" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortfolioPosition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PortfolioPosition_userId_idx" ON "PortfolioPosition"("userId");

DO $$ BEGIN
  ALTER TABLE "PortfolioPosition"
    ADD CONSTRAINT "PortfolioPosition_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
