-- Capitalisation boursière (prix × actions) figée au scoring sur ScreenerTicker.
-- Alimente le filtre Small/Mid/Large cap du screener. Idempotent pour rejeu Vercel.
ALTER TABLE "ScreenerTicker" ADD COLUMN IF NOT EXISTS "marketCap" DOUBLE PRECISION;
