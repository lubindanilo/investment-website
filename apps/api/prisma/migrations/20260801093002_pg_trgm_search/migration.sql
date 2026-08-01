-- Recherche tolérante aux fautes pour le tool MCP `search_ticker`.
--
-- Contexte : la recherche stricte (préfixe sur le ticker, sous-chaîne sur le nom) ne
-- rend rien dès qu'il y a une faute de frappe (« microsft »), ce qui est fréquent quand
-- c'est un modèle qui saisit un nom de mémoire. On ajoute un repli par similarité.
--
-- Migration ÉCRITE À LA MAIN : Prisma ne modélise ni les extensions ni les index GIN
-- trigrammes dans le schéma. `prisma migrate deploy` l'applique normalement ; un futur
-- `migrate dev` pourrait signaler une dérive sur ces deux index (attendu, sans gravité).
--
-- Coût : ~30k lignes, index GIN de quelques Mo, négligeable même sur le plan Neon Free.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "ScreenerTicker_ticker_trgm_idx"
  ON "ScreenerTicker" USING gin ("ticker" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ScreenerTicker_name_trgm_idx"
  ON "ScreenerTicker" USING gin ("name" gin_trgm_ops);
