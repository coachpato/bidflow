CREATE TABLE IF NOT EXISTS "tenderRequirement" (
  "id" SERIAL NOT NULL,
  "label" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'parser',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenderId" INTEGER NOT NULL,

  CONSTRAINT "tenderRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "qualificationAssessment" (
  "id" SERIAL NOT NULL,
  "verdict" TEXT NOT NULL,
  "summary" TEXT,
  "readinessPercent" INTEGER NOT NULL DEFAULT 0,
  "checklistCompletionPercent" INTEGER NOT NULL DEFAULT 0,
  "blockerCount" INTEGER NOT NULL DEFAULT 0,
  "warningCount" INTEGER NOT NULL DEFAULT 0,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" INTEGER NOT NULL,
  "tenderId" INTEGER NOT NULL,

  CONSTRAINT "qualificationAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "qualificationCheck" (
  "id" SERIAL NOT NULL,
  "checkKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "detail" TEXT,
  "recommendation" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assessmentId" INTEGER NOT NULL,

  CONSTRAINT "qualificationCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenderRequirement_tenderId_label_key" ON "tenderRequirement"("tenderId", "label");
CREATE UNIQUE INDEX IF NOT EXISTS "qualificationAssessment_tenderId_key" ON "qualificationAssessment"("tenderId");
CREATE INDEX IF NOT EXISTS "qualificationAssessment_organizationId_verdict_idx" ON "qualificationAssessment"("organizationId", "verdict");
CREATE UNIQUE INDEX IF NOT EXISTS "qualificationCheck_assessmentId_checkKey_key" ON "qualificationCheck"("assessmentId", "checkKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tenderRequirement_tenderId_fkey'
  ) THEN
    ALTER TABLE "tenderRequirement"
      ADD CONSTRAINT "tenderRequirement_tenderId_fkey"
      FOREIGN KEY ("tenderId") REFERENCES "tender"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'qualificationAssessment_organizationId_fkey'
  ) THEN
    ALTER TABLE "qualificationAssessment"
      ADD CONSTRAINT "qualificationAssessment_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'qualificationAssessment_tenderId_fkey'
  ) THEN
    ALTER TABLE "qualificationAssessment"
      ADD CONSTRAINT "qualificationAssessment_tenderId_fkey"
      FOREIGN KEY ("tenderId") REFERENCES "tender"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'qualificationCheck_assessmentId_fkey'
  ) THEN
    ALTER TABLE "qualificationCheck"
      ADD CONSTRAINT "qualificationCheck_assessmentId_fkey"
      FOREIGN KEY ("assessmentId") REFERENCES "qualificationAssessment"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
