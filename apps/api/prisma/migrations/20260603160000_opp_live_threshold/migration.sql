-- Ré-évaluation LIVE de l'opportunité (prix du jour) sans recharger la distribution. Idempotent.
-- pfcfDecile10 = seuil P/FCF du décile bas figé au scoring ; oppRefreshedAt = throttle ~10 min.
ALTER TABLE "ScreenerTicker" ADD COLUMN IF NOT EXISTS "pfcfDecile10" DOUBLE PRECISION;
ALTER TABLE "ScreenerTicker" ADD COLUMN IF NOT EXISTS "oppRefreshedAt" TIMESTAMP(3);
