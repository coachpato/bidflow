-- Alter contract records to support appointment tracking and org scoping
ALTER TABLE "contract"
ADD COLUMN "organizationId" INTEGER,
ADD COLUMN "appointmentStatus" TEXT NOT NULL DEFAULT 'Appointed',
ADD COLUMN "instructionStatus" TEXT NOT NULL DEFAULT 'No Instruction',
ADD COLUMN "appointmentDate" TIMESTAMP(3),
ADD COLUMN "firstInstructionDate" TIMESTAMP(3),
ADD COLUMN "lastFollowUpAt" TIMESTAMP(3),
ADD COLUMN "nextFollowUpAt" TIMESTAMP(3),
ADD COLUMN "nextFollowUpReminderSentAt" TIMESTAMP(3),
ADD COLUMN "dormantReminderSentAt" TIMESTAMP(3),
ADD COLUMN "milestoneSummary" TEXT;

-- Backfill contract organizations from linked opportunities first, then tender creators, then the first organization
UPDATE "contract" AS c
SET "organizationId" = o."organizationId"
FROM "tender" AS t
JOIN "opportunity" AS o ON o."id" = t."opportunityId"
WHERE c."tenderId" = t."id"
  AND c."organizationId" IS NULL;

UPDATE "contract" AS c
SET "organizationId" = membership_map."organizationId"
FROM (
  SELECT DISTINCT ON (t."id")
    t."id" AS "tenderId",
    m."organizationId"
  FROM "tender" AS t
  JOIN "membership" AS m ON m."userId" = t."userId"
  ORDER BY t."id", m."id"
) AS membership_map
WHERE c."tenderId" = membership_map."tenderId"
  AND c."organizationId" IS NULL;

UPDATE "contract"
SET "organizationId" = fallback."id"
FROM (
  SELECT "id"
  FROM "organization"
  ORDER BY "id"
  LIMIT 1
) AS fallback
WHERE "contract"."organizationId" IS NULL;

ALTER TABLE "contract"
ALTER COLUMN "organizationId" SET NOT NULL;

CREATE INDEX "contract_organizationId_appointmentStatus_instructionStatus_idx"
ON "contract"("organizationId", "appointmentStatus", "instructionStatus");

ALTER TABLE "contract"
ADD CONSTRAINT "contract_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Appointment milestones
CREATE TABLE "contractMilestone" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "reminderSentAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "contractId" INTEGER NOT NULL,

  CONSTRAINT "contractMilestone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contractMilestone_contractId_dueDate_idx"
ON "contractMilestone"("contractId", "dueDate");

ALTER TABLE "contractMilestone"
ADD CONSTRAINT "contractMilestone_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "contract"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter appeal records to support challenge workflow depth and org scoping
ALTER TABLE "appeal"
ADD COLUMN "organizationId" INTEGER,
ADD COLUMN "challengeType" TEXT NOT NULL DEFAULT 'Administrative Appeal',
ADD COLUMN "exclusionReason" TEXT,
ADD COLUMN "exclusionDate" TIMESTAMP(3),
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "resolvedAt" TIMESTAMP(3),
ADD COLUMN "deadlineReminderSentAt" TIMESTAMP(3),
ADD COLUMN "requestedRelief" TEXT,
ADD COLUMN "nextStep" TEXT,
ADD COLUMN "evidenceChecklist" JSONB;

-- Backfill appeal organizations using linked tender context, then fallback to the first organization
UPDATE "appeal" AS a
SET "organizationId" = o."organizationId"
FROM "tender" AS t
JOIN "opportunity" AS o ON o."id" = t."opportunityId"
WHERE a."tenderId" = t."id"
  AND a."organizationId" IS NULL;

UPDATE "appeal" AS a
SET "organizationId" = membership_map."organizationId"
FROM (
  SELECT DISTINCT ON (t."id")
    t."id" AS "tenderId",
    m."organizationId"
  FROM "tender" AS t
  JOIN "membership" AS m ON m."userId" = t."userId"
  ORDER BY t."id", m."id"
) AS membership_map
WHERE a."tenderId" = membership_map."tenderId"
  AND a."organizationId" IS NULL;

UPDATE "appeal"
SET "organizationId" = fallback."id"
FROM (
  SELECT "id"
  FROM "organization"
  ORDER BY "id"
  LIMIT 1
) AS fallback
WHERE "appeal"."organizationId" IS NULL;

ALTER TABLE "appeal"
ALTER COLUMN "organizationId" SET NOT NULL;

CREATE INDEX "appeal_organizationId_status_deadline_idx"
ON "appeal"("organizationId", "status", "deadline");

ALTER TABLE "appeal"
ADD CONSTRAINT "appeal_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Challenge evidence documents
CREATE TABLE "appealDocument" (
  "id" SERIAL NOT NULL,
  "filename" TEXT NOT NULL,
  "filepath" TEXT NOT NULL,
  "documentType" TEXT NOT NULL DEFAULT 'Evidence',
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appealId" INTEGER NOT NULL,

  CONSTRAINT "appealDocument_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "appealDocument"
ADD CONSTRAINT "appealDocument_appealId_fkey"
FOREIGN KEY ("appealId") REFERENCES "appeal"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Actionable notifications
ALTER TABLE "notification"
ADD COLUMN "title" TEXT,
ADD COLUMN "linkUrl" TEXT,
ADD COLUMN "linkLabel" TEXT;
