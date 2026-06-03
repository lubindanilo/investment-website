-- Colonne freq (observabilité) sur le store de fondamentaux. Idempotent.
-- 'quarterly' = US (Finnhub+EDGAR) ; 'annual' = non-US (Yahoo). La PK reste (ticker, metric)
-- car les noms de métriques ne collisionnent pas (revenue vs annualTotalRevenue).
ALTER TABLE "FundamentalsSeries" ADD COLUMN IF NOT EXISTS "freq" TEXT NOT NULL DEFAULT 'quarterly';
