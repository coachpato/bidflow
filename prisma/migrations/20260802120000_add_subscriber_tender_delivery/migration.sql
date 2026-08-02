CREATE TABLE "subscriberTenderDelivery" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "opportunityId" INTEGER NOT NULL,
    "sourceRunId" INTEGER,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriberTenderDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscriberTenderDelivery_subscriberId_opportunityId_key" ON "subscriberTenderDelivery"("subscriberId", "opportunityId");
CREATE INDEX "subscriberTenderDelivery_subscriberId_deliveredAt_idx" ON "subscriberTenderDelivery"("subscriberId", "deliveredAt");
CREATE INDEX "subscriberTenderDelivery_opportunityId_idx" ON "subscriberTenderDelivery"("opportunityId");
CREATE INDEX "subscriberTenderDelivery_sourceRunId_idx" ON "subscriberTenderDelivery"("sourceRunId");

ALTER TABLE "subscriberTenderDelivery"
  ADD CONSTRAINT "subscriberTenderDelivery_subscriberId_fkey"
  FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscriberTenderDelivery"
  ADD CONSTRAINT "subscriberTenderDelivery_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscriberTenderDelivery"
  ADD CONSTRAINT "subscriberTenderDelivery_sourceRunId_fkey"
  FOREIGN KEY ("sourceRunId") REFERENCES "sourceRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
