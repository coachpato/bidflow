ALTER TABLE "user"
ADD COLUMN "googleSubject" TEXT,
ADD COLUMN "avatarUrl" TEXT;

CREATE UNIQUE INDEX "user_googleSubject_key" ON "user"("googleSubject");
