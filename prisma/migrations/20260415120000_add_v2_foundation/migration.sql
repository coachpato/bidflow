CREATE TABLE IF NOT EXISTS "organization" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "membership" (
  "id" SERIAL NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,

  CONSTRAINT "membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "firmProfile" (
  "id" SERIAL NOT NULL,
  "displayName" TEXT NOT NULL,
  "legalName" TEXT,
  "registrationNumber" TEXT,
  "primaryContactName" TEXT,
  "primaryContactEmail" TEXT,
  "primaryContactPhone" TEXT,
  "website" TEXT,
  "overview" TEXT,
  "practiceAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "targetWorkTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "targetProvinces" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" INTEGER NOT NULL,

  CONSTRAINT "firmProfile_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'membership_organizationId_fkey'
  ) THEN
    ALTER TABLE "membership"
      ADD CONSTRAINT "membership_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'membership_userId_fkey'
  ) THEN
    ALTER TABLE "membership"
      ADD CONSTRAINT "membership_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'firmProfile_organizationId_fkey'
  ) THEN
    ALTER TABLE "firmProfile"
      ADD CONSTRAINT "firmProfile_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "organization_slug_key" ON "organization"("slug");
CREATE INDEX IF NOT EXISTS "membership_userId_idx" ON "membership"("userId");
CREATE INDEX IF NOT EXISTS "membership_organizationId_idx" ON "membership"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "membership_organizationId_userId_key" ON "membership"("organizationId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "firmProfile_organizationId_key" ON "firmProfile"("organizationId");
