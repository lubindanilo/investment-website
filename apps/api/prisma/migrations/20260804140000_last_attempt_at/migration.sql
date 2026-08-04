-- Sépare « dernière tentative de scoring » de « dernier changement réel des données ».
--
-- Avant : `lastScoredAt` servait aux DEUX usages. Conséquence, un titre déjà noté dont le
-- rafraîchissement ÉCHOUAIT (throttle Yahoo depuis les IP Vercel, très corrélé sur les
-- valeurs non-US) voyait quand même sa date avancer. Comme il restait `scored`, son
-- `lastmod` de sitemap et son `dateModified` JSON-LD avançaient sans qu'aucune donnée
-- financière n'ait changé, ce qui est exactement le « refresh de dates de masse » que Google
-- traite comme un signal de faible valeur.
--
-- Après :
--   - `lastAttemptAt`           = cadence (cooldown, TTL, ordre de la file). Bumpé à CHAQUE passage.
--   - `lastScoredAt`            = dernier changement RÉEL des fondamentaux. Alimente le SEO.
--   - `fundamentalsFingerprint` = empreinte des fondamentaux hors prix, pour détecter ce changement.

ALTER TABLE "ScreenerTicker" ADD COLUMN "lastAttemptAt" TIMESTAMP(3);
ALTER TABLE "ScreenerTicker" ADD COLUMN "fundamentalsFingerprint" TEXT;

-- ⚠️ BACKFILL OBLIGATOIRE, ne pas retirer.
-- Toute la file de scoring filtre sur `lastAttemptAt < cutoff`. En SQL, `NULL < x` vaut NULL,
-- donc une colonne laissée à NULL ferait que PLUS AUCUN titre ne remonte dans les phases
-- « earnings atteint » et « TTL » : le scoring s'arrêterait silencieusement (déjà vu sur ce
-- projet en juin 2026). On amorce donc avec la valeur existante.
UPDATE "ScreenerTicker" SET "lastAttemptAt" = "lastScoredAt" WHERE "lastAttemptAt" IS NULL;

-- `fundamentalsFingerprint` reste NULL : au premier scoring, le code ENREGISTRE l'empreinte
-- sans toucher à `lastScoredAt` (on ne sait pas si les données ont changé, on suppose que non).
-- Ça évite une vague de bumps de dates sur tout l'univers juste après le déploiement.

-- Nouvel index de file (l'ancien portait sur lastScoredAt, qui ne pilote plus la cadence).
DROP INDEX IF EXISTS "ScreenerTicker_status_priority_lastScoredAt_idx";
CREATE INDEX "ScreenerTicker_status_priority_lastAttemptAt_idx" ON "ScreenerTicker"("status", "priority", "lastAttemptAt");
