-- Add nullable email verification fields. These are safe for populated databases.
ALTER TABLE "user"
ADD COLUMN "emailVerified" TIMESTAMP(3),
ADD COLUMN "verificationToken" TEXT,
ADD COLUMN "verificationTokenExpiresAt" TIMESTAMP(3);

-- Existing users pre-date email verification, so keep them able to log in.
UPDATE "user"
SET "emailVerified" = NOW()
WHERE "emailVerified" IS NULL;

-- Prisma's @unique field mapping for User.verificationToken.
CREATE UNIQUE INDEX "user_verificationToken_key" ON "user"("verificationToken");
