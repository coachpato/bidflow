-- The old deployed crawler continued to insert Home/opportunities?id=1 after
-- the first backfill migration had already run. Keep this migration
-- idempotent so rollout scrubs any placeholder links created in the interim.

UPDATE "opportunity"
SET
  "sourceUrl" = NULL,
  "sourceFallbackUrl" = COALESCE("sourceFallbackUrl", 'https://www.etenders.gov.za/Home?myTab=1'),
  "updatedAt" = NOW()
WHERE LOWER(COALESCE("sourceUrl", '')) LIKE '%/home/opportunities?id=1%';

UPDATE "opportunity"
SET
  "sourceFallbackUrl" = 'https://www.etenders.gov.za/Home?myTab=1',
  "updatedAt" = NOW()
WHERE "sourceName" = 'eTenders.gov.za'
  AND "sourceFallbackUrl" IS NULL
  AND "sourceUrl" IS NULL;
