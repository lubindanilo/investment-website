-- Cache qualitatif par langue : ajoute `lang` + PK composite (ticker, lang). Idempotent.
ALTER TABLE "BusinessAnalysis"   ADD COLUMN IF NOT EXISTS "lang" TEXT NOT NULL DEFAULT 'fr';
ALTER TABLE "ManagementAnalysis" ADD COLUMN IF NOT EXISTS "lang" TEXT NOT NULL DEFAULT 'fr';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.key_column_usage
                 WHERE constraint_name='BusinessAnalysis_pkey' AND column_name='lang') THEN
    ALTER TABLE "BusinessAnalysis" DROP CONSTRAINT IF EXISTS "BusinessAnalysis_pkey";
    ALTER TABLE "BusinessAnalysis" ADD CONSTRAINT "BusinessAnalysis_pkey" PRIMARY KEY ("ticker","lang");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.key_column_usage
                 WHERE constraint_name='ManagementAnalysis_pkey' AND column_name='lang') THEN
    ALTER TABLE "ManagementAnalysis" DROP CONSTRAINT IF EXISTS "ManagementAnalysis_pkey";
    ALTER TABLE "ManagementAnalysis" ADD CONSTRAINT "ManagementAnalysis_pkey" PRIMARY KEY ("ticker","lang");
  END IF;
END $$;
