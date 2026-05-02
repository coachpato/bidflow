-- DropIndex
DROP INDEX "complianceDocument_expiryDate_idx";

-- DropIndex
DROP INDEX "complianceDocument_organizationId_idx";

-- DropIndex
DROP INDEX "contract_assignedUserId_idx";

-- DropIndex
DROP INDEX "contractDocument_contractId_idx";

-- DropIndex
DROP INDEX "firmExperience_organizationId_idx";

-- DropIndex
DROP INDEX "firmPerson_organizationId_idx";

-- DropIndex
DROP INDEX "membership_organizationId_idx";

-- DropIndex
DROP INDEX "membership_userId_idx";

-- DropIndex
DROP INDEX "notification_organizationId_idx";

-- DropIndex
DROP INDEX "opportunity_deadline_idx";

-- DropIndex
DROP INDEX "opportunity_status_idx";

-- DropIndex
DROP INDEX "opportunity_userId_idx";

-- DropIndex
DROP INDEX "opportunityDocument_opportunityId_idx";

-- DropIndex
DROP INDEX "tender_assignedUserId_idx";

-- AlterTable
ALTER TABLE "complianceDocument" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "contractMilestone" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "firmExperience" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "firmPerson" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "firmProfile" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "opportunity" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "opportunityMatch" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organization" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "source" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "tenderStatusChange" (
    "id" SERIAL NOT NULL,
    "tenderId" INTEGER NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenderStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractStatusChange" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contractStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenderStatusChange_tenderId_changedAt_idx" ON "tenderStatusChange"("tenderId", "changedAt");

-- CreateIndex
CREATE INDEX "tenderStatusChange_changedByUserId_changedAt_idx" ON "tenderStatusChange"("changedByUserId", "changedAt");

-- CreateIndex
CREATE INDEX "contractStatusChange_contractId_changedAt_idx" ON "contractStatusChange"("contractId", "changedAt");

-- CreateIndex
CREATE INDEX "contractStatusChange_changedByUserId_changedAt_idx" ON "contractStatusChange"("changedByUserId", "changedAt");

-- AddForeignKey
ALTER TABLE "tenderStatusChange" ADD CONSTRAINT "tenderStatusChange_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenderStatusChange" ADD CONSTRAINT "tenderStatusChange_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractStatusChange" ADD CONSTRAINT "contractStatusChange_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractStatusChange" ADD CONSTRAINT "contractStatusChange_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
