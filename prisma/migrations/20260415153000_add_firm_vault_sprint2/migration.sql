ALTER TABLE "firmProfile"
  ADD COLUMN IF NOT EXISTS "preferredEntities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "minimumContractValue" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "maximumContractValue" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "firmPerson" (
  "id" SERIAL NOT NULL,
  "fullName" TEXT NOT NULL,
  "title" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "yearsExperience" INTEGER,
  "qualifications" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "practiceAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" INTEGER NOT NULL,

  CONSTRAINT "firmPerson_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "firmExperience" (
  "id" SERIAL NOT NULL,
  "matterName" TEXT NOT NULL,
  "clientName" TEXT,
  "entityName" TEXT,
  "practiceArea" TEXT,
  "workType" TEXT,
  "summary" TEXT,
  "projectValue" DOUBLE PRECISION,
  "startedYear" INTEGER,
  "completedYear" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" INTEGER NOT NULL,

  CONSTRAINT "firmExperience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "complianceDocument" (
  "id" SERIAL NOT NULL,
  "filename" TEXT NOT NULL,
  "filepath" TEXT NOT NULL,
  "storagePath" TEXT,
  "documentType" TEXT NOT NULL,
  "description" TEXT,
  "issueDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "notes" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" INTEGER NOT NULL,
  "uploadedByUserId" INTEGER,

  CONSTRAINT "complianceDocument_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notification"
  ADD COLUMN IF NOT EXISTS "sourceKey" TEXT,
  ADD COLUMN IF NOT EXISTS "organizationId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'firmPerson_organizationId_fkey'
  ) THEN
    ALTER TABLE "firmPerson"
      ADD CONSTRAINT "firmPerson_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'firmExperience_organizationId_fkey'
  ) THEN
    ALTER TABLE "firmExperience"
      ADD CONSTRAINT "firmExperience_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'complianceDocument_organizationId_fkey'
  ) THEN
    ALTER TABLE "complianceDocument"
      ADD CONSTRAINT "complianceDocument_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'complianceDocument_uploadedByUserId_fkey'
  ) THEN
    ALTER TABLE "complianceDocument"
      ADD CONSTRAINT "complianceDocument_uploadedByUserId_fkey"
      FOREIGN KEY ("uploadedByUserId") REFERENCES "user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notification_organizationId_fkey'
  ) THEN
    ALTER TABLE "notification"
      ADD CONSTRAINT "notification_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "firmPerson_organizationId_idx" ON "firmPerson"("organizationId");
CREATE INDEX IF NOT EXISTS "firmExperience_organizationId_idx" ON "firmExperience"("organizationId");
CREATE INDEX IF NOT EXISTS "complianceDocument_organizationId_idx" ON "complianceDocument"("organizationId");
CREATE INDEX IF NOT EXISTS "complianceDocument_expiryDate_idx" ON "complianceDocument"("expiryDate");
CREATE INDEX IF NOT EXISTS "notification_organizationId_idx" ON "notification"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "notification_sourceKey_key" ON "notification"("sourceKey");
