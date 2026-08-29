-- Canonical tender-linking support for crawler-backed opportunities.
-- This migration is intentionally additive so existing opportunities remain readable
-- while new crawler writes begin using sourceIdentityKey for global source identity.

ALTER TABLE "opportunity"
  ADD COLUMN IF NOT EXISTS "sourceTenderId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceIdentityKey" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceContentHash" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceDetailUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceFallbackUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "briefingDetails" TEXT,
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "matchedSectors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sourceMissingAt" TIMESTAMP(3);

UPDATE "opportunity"
SET
  "firstSeenAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
  "lastSeenAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP),
  "lastVerifiedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "lastSeenAt" IS NULL
   OR "lastVerifiedAt" IS NULL;

ALTER TABLE "opportunityDocument"
  ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceDocumentId" TEXT,
  ADD COLUMN IF NOT EXISTS "documentType" TEXT NOT NULL DEFAULT 'SOURCE',
  ADD COLUMN IF NOT EXISTS "extension" TEXT,
  ADD COLUMN IF NOT EXISTS "fileSize" INTEGER,
  ADD COLUMN IF NOT EXISTS "checksum" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceMetadata" JSONB,
  ADD COLUMN IF NOT EXISTS "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "lastVerifiedAt" TIMESTAMP(3);

UPDATE "opportunityDocument"
SET
  "firstSeenAt" = COALESCE("uploadedAt", CURRENT_TIMESTAMP),
  "lastVerifiedAt" = COALESCE("uploadedAt", CURRENT_TIMESTAMP)
WHERE "lastVerifiedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "opportunity_sourceIdentityKey_key"
  ON "opportunity"("sourceIdentityKey");

CREATE INDEX IF NOT EXISTS "opportunity_sourceId_sourceTenderId_idx"
  ON "opportunity"("sourceId", "sourceTenderId");

CREATE INDEX IF NOT EXISTS "opportunity_sourceStatus_deadline_idx"
  ON "opportunity"("sourceStatus", "deadline");

CREATE INDEX IF NOT EXISTS "opportunity_archivedAt_deadline_idx"
  ON "opportunity"("archivedAt", "deadline");

CREATE INDEX IF NOT EXISTS "opportunity_lastSeenAt_idx"
  ON "opportunity"("lastSeenAt");

CREATE UNIQUE INDEX IF NOT EXISTS "opportunityDocument_opportunityId_sourceDocumentId_key"
  ON "opportunityDocument"("opportunityId", "sourceDocumentId");

CREATE INDEX IF NOT EXISTS "opportunityDocument_opportunityId_uploadedAt_idx"
  ON "opportunityDocument"("opportunityId", "uploadedAt");

CREATE INDEX IF NOT EXISTS "opportunityDocument_sourceDocumentId_idx"
  ON "opportunityDocument"("sourceDocumentId");
