ALTER TABLE "tenderDocument"
ADD COLUMN IF NOT EXISTS "documentCategory" TEXT NOT NULL DEFAULT 'SOURCE';

CREATE INDEX IF NOT EXISTS "tenderDocument_tenderId_documentCategory_uploadedAt_idx"
ON "tenderDocument"("tenderId", "documentCategory", "uploadedAt");
