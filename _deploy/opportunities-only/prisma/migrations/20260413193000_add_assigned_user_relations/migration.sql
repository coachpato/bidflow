ALTER TABLE "tender"
  ADD COLUMN IF NOT EXISTS "assignedUserId" INTEGER;

ALTER TABLE "contract"
  ADD COLUMN IF NOT EXISTS "assignedUserId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tender_assignedUserId_fkey'
  ) THEN
    ALTER TABLE "tender"
      ADD CONSTRAINT "tender_assignedUserId_fkey"
      FOREIGN KEY ("assignedUserId") REFERENCES "user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contract_assignedUserId_fkey'
  ) THEN
    ALTER TABLE "contract"
      ADD CONSTRAINT "contract_assignedUserId_fkey"
      FOREIGN KEY ("assignedUserId") REFERENCES "user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tender_assignedUserId_idx" ON "tender"("assignedUserId");
CREATE INDEX IF NOT EXISTS "contract_assignedUserId_idx" ON "contract"("assignedUserId");

UPDATE "tender" AS t
SET "assignedUserId" = u."id"
FROM "user" AS u
WHERE t."assignedUserId" IS NULL
  AND t."assignedTo" IS NOT NULL
  AND (
    lower(trim(t."assignedTo")) = lower(trim(u."email"))
    OR lower(trim(t."assignedTo")) = lower(trim(u."name"))
  );

UPDATE "contract" AS c
SET "assignedUserId" = u."id"
FROM "user" AS u
WHERE c."assignedUserId" IS NULL
  AND c."assignedTo" IS NOT NULL
  AND (
    lower(trim(c."assignedTo")) = lower(trim(u."email"))
    OR lower(trim(c."assignedTo")) = lower(trim(u."name"))
  );
