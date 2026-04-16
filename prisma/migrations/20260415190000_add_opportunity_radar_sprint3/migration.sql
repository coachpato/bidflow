ALTER TABLE "opportunity"
  ADD COLUMN IF NOT EXISTS "organizationId" INTEGER,
  ADD COLUMN IF NOT EXISTS "sourceId" INTEGER,
  ADD COLUMN IF NOT EXISTS "sourceRunId" INTEGER,
  ADD COLUMN IF NOT EXISTS "externalId" TEXT,
  ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "source" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'portal',
  "baseUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "source_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sourceRun" (
  "id" SERIAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "totalFound" INTEGER NOT NULL DEFAULT 0,
  "matchedCount" INTEGER NOT NULL DEFAULT 0,
  "newCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "summary" JSONB,
  "sourceId" INTEGER NOT NULL,

  CONSTRAINT "sourceRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "opportunityMatch" (
  "id" SERIAL NOT NULL,
  "verdict" TEXT NOT NULL DEFAULT 'Matched',
  "fitScore" INTEGER,
  "matchedKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "matchReasons" JSONB,
  "digestSentAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "opportunityId" INTEGER NOT NULL,
  "organizationId" INTEGER NOT NULL,

  CONSTRAINT "opportunityMatch_pkey" PRIMARY KEY ("id")
);

UPDATE "opportunity"
SET "status" = 'Watch'
WHERE "status" = 'Reviewing';

UPDATE "opportunity"
SET "status" = 'Ignore'
WHERE "status" = 'Skipped';

UPDATE "opportunity" AS "o"
SET
  "organizationId" = COALESCE(
    (
      SELECT "m"."organizationId"
      FROM "membership" AS "m"
      WHERE "m"."userId" = "o"."userId"
      ORDER BY "m"."id" ASC
      LIMIT 1
    ),
    (
      SELECT "org"."id"
      FROM "organization" AS "org"
      ORDER BY "org"."id" ASC
      LIMIT 1
    )
  ),
  "externalId" = COALESCE("o"."externalId", "o"."reference"),
  "dedupeKey" = COALESCE(
    "o"."dedupeKey",
    CONCAT_WS(
      ':',
      COALESCE(
        (
          SELECT "m"."organizationId"::TEXT
          FROM "membership" AS "m"
          WHERE "m"."userId" = "o"."userId"
          ORDER BY "m"."id" ASC
          LIMIT 1
        ),
        (
          SELECT "org"."id"::TEXT
          FROM "organization" AS "org"
          ORDER BY "org"."id" ASC
          LIMIT 1
        ),
        '0'
      ),
      LOWER(COALESCE("o"."sourceName", 'manual')),
      LOWER(COALESCE(NULLIF("o"."reference", ''), "o"."title", 'untitled')),
      LOWER(COALESCE("o"."entity", 'unknown-entity')),
      COALESCE(TO_CHAR("o"."deadline", 'YYYY-MM-DD'), 'no-deadline')
    )
  )
WHERE "o"."organizationId" IS NULL
   OR "o"."externalId" IS NULL
   OR "o"."dedupeKey" IS NULL;

WITH "ranked" AS (
  SELECT
    "id",
    "dedupeKey",
    ROW_NUMBER() OVER (
      PARTITION BY "organizationId", "dedupeKey"
      ORDER BY "id" ASC
    ) AS "row_num"
  FROM "opportunity"
  WHERE "organizationId" IS NOT NULL
    AND "dedupeKey" IS NOT NULL
)
UPDATE "opportunity" AS "o"
SET "dedupeKey" = CONCAT("o"."dedupeKey", ':', "o"."id")
FROM "ranked" AS "r"
WHERE "o"."id" = "r"."id"
  AND "r"."row_num" > 1;

INSERT INTO "opportunityMatch" (
  "verdict",
  "fitScore",
  "matchedKeywords",
  "matchReasons",
  "opportunityId",
  "organizationId"
)
SELECT
  CASE
    WHEN COALESCE("o"."fitScore", 0) >= 80 THEN 'Strong match'
    WHEN COALESCE("o"."fitScore", 0) >= 60 THEN 'Relevant'
    WHEN COALESCE("o"."fitScore", 0) >= 40 THEN 'Needs review'
    ELSE 'Manual intake'
  END,
  "o"."fitScore",
  ARRAY[]::TEXT[],
  JSONB_BUILD_ARRAY(
    CASE
      WHEN "o"."status" = 'Pursue' THEN 'Imported from an existing pursue decision.'
      WHEN "o"."status" = 'Watch' THEN 'Imported from an existing watch decision.'
      WHEN "o"."status" = 'Ignore' THEN 'Imported from an existing ignore decision.'
      ELSE 'Imported from an existing opportunity record.'
    END
  ),
  "o"."id",
  "o"."organizationId"
FROM "opportunity" AS "o"
WHERE "o"."organizationId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "opportunityMatch" AS "om"
    WHERE "om"."opportunityId" = "o"."id"
      AND "om"."organizationId" = "o"."organizationId"
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "opportunity"
    WHERE "organizationId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot apply Sprint 3 radar migration because some opportunities still have no organizationId.';
  END IF;
END $$;

ALTER TABLE "opportunity"
  ALTER COLUMN "organizationId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "source_key_key" ON "source"("key");
CREATE INDEX IF NOT EXISTS "sourceRun_sourceId_startedAt_idx" ON "sourceRun"("sourceId", "startedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "opportunity_organizationId_dedupeKey_key" ON "opportunity"("organizationId", "dedupeKey");
CREATE INDEX IF NOT EXISTS "opportunity_organizationId_status_deadline_idx" ON "opportunity"("organizationId", "status", "deadline");
CREATE INDEX IF NOT EXISTS "opportunity_sourceId_publishedAt_idx" ON "opportunity"("sourceId", "publishedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "opportunityMatch_opportunityId_organizationId_key" ON "opportunityMatch"("opportunityId", "organizationId");
CREATE INDEX IF NOT EXISTS "opportunityMatch_organizationId_fitScore_verdict_idx" ON "opportunityMatch"("organizationId", "fitScore", "verdict");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'opportunity_organizationId_fkey'
  ) THEN
    ALTER TABLE "opportunity"
      ADD CONSTRAINT "opportunity_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'opportunity_sourceId_fkey'
  ) THEN
    ALTER TABLE "opportunity"
      ADD CONSTRAINT "opportunity_sourceId_fkey"
      FOREIGN KEY ("sourceId") REFERENCES "source"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'opportunity_sourceRunId_fkey'
  ) THEN
    ALTER TABLE "opportunity"
      ADD CONSTRAINT "opportunity_sourceRunId_fkey"
      FOREIGN KEY ("sourceRunId") REFERENCES "sourceRun"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sourceRun_sourceId_fkey'
  ) THEN
    ALTER TABLE "sourceRun"
      ADD CONSTRAINT "sourceRun_sourceId_fkey"
      FOREIGN KEY ("sourceId") REFERENCES "source"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'opportunityMatch_opportunityId_fkey'
  ) THEN
    ALTER TABLE "opportunityMatch"
      ADD CONSTRAINT "opportunityMatch_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "opportunity"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'opportunityMatch_organizationId_fkey'
  ) THEN
    ALTER TABLE "opportunityMatch"
      ADD CONSTRAINT "opportunityMatch_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
