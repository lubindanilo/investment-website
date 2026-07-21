-- Dossier de preuves fige utilise pour chaque adjudication.
ALTER TABLE "ResilienceAnalysis"
  ADD COLUMN IF NOT EXISTS "researchDossier" TEXT,
  ADD COLUMN IF NOT EXISTS "researchHash" TEXT;

ALTER TABLE "ResilienceAnalysisHistory"
  ADD COLUMN IF NOT EXISTS "researchDossier" TEXT,
  ADD COLUMN IF NOT EXISTS "researchHash" TEXT;
