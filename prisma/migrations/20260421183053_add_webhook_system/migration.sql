-- CreateTable
CREATE TABLE "webhookDelivery" (
    "id" SERIAL NOT NULL,
    "webhookId" TEXT NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "event" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "deliveredAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhookEndpoint" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "webhookDelivery_webhookId_key" ON "webhookDelivery"("webhookId");

-- CreateIndex
CREATE INDEX "webhookDelivery_organizationId_status_nextRetryAt_idx" ON "webhookDelivery"("organizationId", "status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "webhookDelivery_webhookId_idx" ON "webhookDelivery"("webhookId");

-- CreateIndex
CREATE INDEX "webhookEndpoint_organizationId_isActive_idx" ON "webhookEndpoint"("organizationId", "isActive");

-- AddForeignKey
ALTER TABLE "webhookDelivery" ADD CONSTRAINT "webhookDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhookEndpoint" ADD CONSTRAINT "webhookEndpoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
