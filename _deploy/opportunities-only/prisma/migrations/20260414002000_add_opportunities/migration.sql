CREATE TABLE IF NOT EXISTS "opportunity" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "reference" TEXT,
  "entity" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL DEFAULT 'eTenders.gov.za',
  "sourceUrl" TEXT,
  "practiceArea" TEXT,
  "summary" TEXT,
  "estimatedValue" DOUBLE PRECISION,
  "deadline" TIMESTAMP(3),
  "briefingDate" TIMESTAMP(3),
  "siteVisitDate" TIMESTAMP(3),
  "contactPerson" TEXT,
  "contactEmail" TEXT,
  "fitScore" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'New',
  "notes" TEXT,
  "parsedRequirements" JSONB,
  "parsedAppointments" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" INTEGER,

  CONSTRAINT "opportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "opportunityDocument" (
  "id" SERIAL NOT NULL,
  "filename" TEXT NOT NULL,
  "filepath" TEXT NOT NULL,
  "opportunityId" INTEGER NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "opportunityDocument_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'opportunity_userId_fkey'
  ) THEN
    ALTER TABLE "opportunity"
      ADD CONSTRAINT "opportunity_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'opportunityDocument_opportunityId_fkey'
  ) THEN
    ALTER TABLE "opportunityDocument"
      ADD CONSTRAINT "opportunityDocument_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "opportunity"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "tender"
  ADD COLUMN IF NOT EXISTS "opportunityId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tender_opportunityId_fkey'
  ) THEN
    ALTER TABLE "tender"
      ADD CONSTRAINT "tender_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "opportunity"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "opportunity_status_idx" ON "opportunity"("status");
CREATE INDEX IF NOT EXISTS "opportunity_deadline_idx" ON "opportunity"("deadline");
CREATE INDEX IF NOT EXISTS "opportunity_userId_idx" ON "opportunity"("userId");
CREATE INDEX IF NOT EXISTS "opportunityDocument_opportunityId_idx" ON "opportunityDocument"("opportunityId");
CREATE UNIQUE INDEX IF NOT EXISTS "tender_opportunityId_key" ON "tender"("opportunityId");
