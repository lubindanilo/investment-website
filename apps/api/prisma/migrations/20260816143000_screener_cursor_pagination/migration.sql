-- La Resilience partage deja le meme ticker que le screener (audit avant migration :
-- 6 996/6 996 lignes rattachees). La FK formalise cette relation pour que Prisma puisse
-- filtrer et trier sur les etoiles avant d'appliquer la pagination.
ALTER TABLE "ResilienceStarScore"
ADD CONSTRAINT "ResilienceStarScore_ticker_fkey"
FOREIGN KEY ("ticker") REFERENCES "ScreenerTicker"("ticker")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Index de parcours stables pour les tris exposes par le screener. PostgreSQL sait les
-- parcourir dans les deux sens ; le ticker departage les valeurs identiques.
CREATE INDEX "ResilienceStarScore_total_ticker_idx"
ON "ResilienceStarScore"("total", "ticker");

CREATE INDEX "ScreenerTicker_scoreRatio_scoreChiffresMax_ticker_idx"
ON "ScreenerTicker"("scoreRatio", "scoreChiffresMax", "ticker");

CREATE INDEX "ScreenerTicker_pfcfTTM_ticker_idx"
ON "ScreenerTicker"("pfcfTTM", "ticker");

CREATE INDEX "ScreenerTicker_price_ticker_idx"
ON "ScreenerTicker"("price", "ticker");

CREATE INDEX "ScreenerTicker_nextEarningsDate_ticker_idx"
ON "ScreenerTicker"("nextEarningsDate", "ticker");
