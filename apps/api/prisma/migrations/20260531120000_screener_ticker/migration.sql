-- Migration screener_ticker : veille quantitative automatique.
-- Une ligne par ticker de l'univers. La note /10 (quanti only) est re-calculée
-- quand nextEarningsDate est atteinte. Le détail vit dans TickerQuantSnapshot.

CREATE TABLE "ScreenerTicker" (
    "ticker" TEXT NOT NULL,
    "exchange" TEXT,
    "name" TEXT,
    "currency" TEXT,
    "region" TEXT NOT NULL DEFAULT 'US',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scoreChiffres" INTEGER,
    "scoreChiffresMax" INTEGER,
    "scoreRatio" DOUBLE PRECISION,
    "pfcfTTM" DOUBLE PRECISION,
    "fundamentalsSource" TEXT,
    "nextEarningsDate" TEXT,
    "lastScoredAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenerTicker_pkey" PRIMARY KEY ("ticker")
);

CREATE INDEX "ScreenerTicker_status_priority_lastScoredAt_idx" ON "ScreenerTicker"("status", "priority", "lastScoredAt");

CREATE INDEX "ScreenerTicker_scoreRatio_idx" ON "ScreenerTicker"("scoreRatio");
