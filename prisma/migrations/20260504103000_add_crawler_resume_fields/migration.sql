-- Add crawler progress/resume fields. These are safe for populated databases.
ALTER TABLE "sourceRun"
ADD COLUMN "tendersProcessedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastProcessedTenderRef" TEXT,
ADD COLUMN "completionMode" TEXT,
ADD COLUMN "errorMessage" TEXT;
