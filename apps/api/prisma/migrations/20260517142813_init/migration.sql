-- CreateTable
CREATE TABLE "QualitativeCache" (
    "ticker" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualitativeCache_pkey" PRIMARY KEY ("ticker")
);

-- CreateTable
CREATE TABLE "WatchlistEntry" (
    "id" SERIAL NOT NULL,
    "ticker" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB,
    "refreshedAt" TIMESTAMP(3),

    CONSTRAINT "WatchlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistEntry_ticker_key" ON "WatchlistEntry"("ticker");

-- CreateIndex
CREATE INDEX "WatchlistEntry_ticker_idx" ON "WatchlistEntry"("ticker");
