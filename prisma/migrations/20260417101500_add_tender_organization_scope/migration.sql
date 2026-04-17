ALTER TABLE "tender"
ADD COLUMN "organizationId" INTEGER;

UPDATE "tender" AS t
SET "organizationId" = o."organizationId"
FROM "opportunity" AS o
WHERE t."organizationId" IS NULL
  AND t."opportunityId" = o."id";

UPDATE "tender" AS t
SET "organizationId" = m."organizationId"
FROM (
  SELECT DISTINCT ON ("userId") "userId", "organizationId"
  FROM "membership"
  ORDER BY "userId", "id"
) AS m
WHERE t."organizationId" IS NULL
  AND t."userId" = m."userId";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "tender" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'Could not backfill organizationId for every tender row';
  END IF;
END $$;

ALTER TABLE "tender"
ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "tender"
ADD CONSTRAINT "tender_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "tender_organizationId_status_deadline_idx"
ON "tender"("organizationId", "status", "deadline");

CREATE INDEX "tender_organizationId_assignedUserId_deadline_idx"
ON "tender"("organizationId", "assignedUserId", "deadline");
