CREATE TABLE IF NOT EXISTS "generatedDocument" (
  "id" SERIAL NOT NULL,
  "documentType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "requiresManualInput" BOOLEAN NOT NULL DEFAULT false,
  "manualInputSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenderId" INTEGER NOT NULL,

  CONSTRAINT "generatedDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "submissionPack" (
  "id" SERIAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "readinessPercent" INTEGER NOT NULL DEFAULT 0,
  "checklistCompletionPercent" INTEGER NOT NULL DEFAULT 0,
  "generatedDocumentCount" INTEGER NOT NULL DEFAULT 0,
  "reviewedDocumentCount" INTEGER NOT NULL DEFAULT 0,
  "manualInputCount" INTEGER NOT NULL DEFAULT 0,
  "requiredDocumentCount" INTEGER NOT NULL DEFAULT 0,
  "summary" TEXT,
  "missingItems" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenderId" INTEGER NOT NULL,

  CONSTRAINT "submissionPack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "generatedDocument_tenderId_documentType_key" ON "generatedDocument"("tenderId", "documentType");
CREATE UNIQUE INDEX IF NOT EXISTS "submissionPack_tenderId_key" ON "submissionPack"("tenderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'generatedDocument_tenderId_fkey'
  ) THEN
    ALTER TABLE "generatedDocument"
      ADD CONSTRAINT "generatedDocument_tenderId_fkey"
      FOREIGN KEY ("tenderId") REFERENCES "tender"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'submissionPack_tenderId_fkey'
  ) THEN
    ALTER TABLE "submissionPack"
      ADD CONSTRAINT "submissionPack_tenderId_fkey"
      FOREIGN KEY ("tenderId") REFERENCES "tender"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
