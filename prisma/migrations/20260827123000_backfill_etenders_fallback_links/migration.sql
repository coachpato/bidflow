-- Existing crawler rows used Home/opportunities?id=1 as a placeholder. It is
-- not a tender link, so preserve the row and replace only that source value
-- with the honest general opportunities fallback.

UPDATE "opportunity"
SET
  "sourceUrl" = NULL,
  "sourceFallbackUrl" = COALESCE("sourceFallbackUrl", 'https://www.etenders.gov.za/Home?myTab=1')
WHERE "sourceName" = 'eTenders.gov.za'
  AND LOWER(COALESCE("sourceUrl", '')) LIKE '%/home/opportunities?id=1%';

UPDATE "opportunity"
SET "sourceFallbackUrl" = 'https://www.etenders.gov.za/Home?myTab=1'
WHERE "sourceName" = 'eTenders.gov.za'
  AND "sourceFallbackUrl" IS NULL
  AND "sourceUrl" IS NULL;
