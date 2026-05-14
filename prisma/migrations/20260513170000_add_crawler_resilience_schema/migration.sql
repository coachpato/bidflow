-- Add crawler resilience schema. This migration is additive and keeps the legacy
-- sourceRun.status string column for zero-downtime compatibility during rollout.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RunStatus') THEN
    CREATE TYPE "RunStatus" AS ENUM (
      'pending',
      'running',
      'completed',
      'completed_with_warnings',
      'partial_timeout',
      'failed',
      'stale'
    );
  END IF;
END $$;

ALTER TABLE "sourceRun"
  ADD COLUMN IF NOT EXISTS "runStatus" "RunStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "heartbeatAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "diagnostics" JSONB,
  ADD COLUMN IF NOT EXISTS "cursor" JSONB,
  ADD COLUMN IF NOT EXISTS "metrics" JSONB,
  ADD COLUMN IF NOT EXISTS "notificationSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notificationError" TEXT;

UPDATE "sourceRun"
SET "runStatus" = CASE
  WHEN "status" = 'running' THEN 'running'::"RunStatus"
  WHEN "status" = 'completed' THEN 'completed'::"RunStatus"
  WHEN "status" = 'failed' THEN 'failed'::"RunStatus"
  WHEN "status" = 'partial' THEN 'partial_timeout'::"RunStatus"
  WHEN "status" = 'timeout' THEN 'stale'::"RunStatus"
  ELSE 'failed'::"RunStatus"
END;

CREATE TABLE IF NOT EXISTS "deadLetter" (
  "id" SERIAL NOT NULL,
  "tenderRef" TEXT NOT NULL,
  "sourceRunId" INTEGER NOT NULL,
  "failureType" TEXT NOT NULL,
  "failureCount" INTEGER NOT NULL DEFAULT 1,
  "lastError" TEXT NOT NULL,
  "rawData" JSONB NOT NULL,
  "resolution" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "deadLetter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sourceFingerprint" (
  "id" SERIAL NOT NULL,
  "sourceId" INTEGER NOT NULL,
  "fingerprint" JSONB NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sourceFingerprint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "idempotencyRecord" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "result" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "idempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sourceRun_sourceId_runStatus_startedAt_idx"
  ON "sourceRun"("sourceId", "runStatus", "startedAt");
CREATE INDEX IF NOT EXISTS "sourceRun_runStatus_leaseExpiresAt_idx"
  ON "sourceRun"("runStatus", "leaseExpiresAt");

CREATE INDEX IF NOT EXISTS "deadLetter_tenderRef_idx" ON "deadLetter"("tenderRef");
CREATE INDEX IF NOT EXISTS "deadLetter_sourceRunId_idx" ON "deadLetter"("sourceRunId");
CREATE INDEX IF NOT EXISTS "deadLetter_resolvedAt_idx" ON "deadLetter"("resolvedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "sourceFingerprint_sourceId_key" ON "sourceFingerprint"("sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "idempotencyRecord_key_key" ON "idempotencyRecord"("key");
CREATE INDEX IF NOT EXISTS "idempotencyRecord_expiresAt_idx" ON "idempotencyRecord"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'deadLetter_sourceRunId_fkey'
  ) THEN
    ALTER TABLE "deadLetter"
      ADD CONSTRAINT "deadLetter_sourceRunId_fkey"
      FOREIGN KEY ("sourceRunId") REFERENCES "sourceRun"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sourceFingerprint_sourceId_fkey'
  ) THEN
    ALTER TABLE "sourceFingerprint"
      ADD CONSTRAINT "sourceFingerprint_sourceId_fkey"
      FOREIGN KEY ("sourceId") REFERENCES "source"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
