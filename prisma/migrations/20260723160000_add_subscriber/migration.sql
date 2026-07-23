CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "keywords" TEXT,
    "location" TEXT,
    "subscribed" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3),
    "unsubscribeToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscriber_unsubscribeToken_key" ON "Subscriber"("unsubscribeToken");
CREATE UNIQUE INDEX "Subscriber_email_sector_key" ON "Subscriber"("email", "sector");
CREATE INDEX "Subscriber_sector_idx" ON "Subscriber"("sector");
CREATE INDEX "Subscriber_subscribed_idx" ON "Subscriber"("subscribed");
