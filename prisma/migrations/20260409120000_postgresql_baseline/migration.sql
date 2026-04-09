-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "reference" TEXT,
    "entity" TEXT NOT NULL,
    "description" TEXT,
    "deadline" TIMESTAMP(3),
    "briefingDate" TIMESTAMP(3),
    "contactPerson" TEXT,
    "contactEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'New',
    "assignedTo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER,

    CONSTRAINT "tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenderDocument" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "tenderId" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenderChecklistItem" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "responsible" TEXT,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "tenderId" INTEGER NOT NULL,

    CONSTRAINT "tenderChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "client" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "cancelDate" TIMESTAMP(3),
    "value" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenderId" INTEGER,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeal" (
    "id" SERIAL NOT NULL,
    "reason" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "notes" TEXT,
    "template" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenderId" INTEGER,

    CONSTRAINT "appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activityLog" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "tenderId" INTEGER,
    "contractId" INTEGER,
    "appealId" INTEGER,

    CONSTRAINT "activityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "contract_tenderId_key" ON "contract"("tenderId");

-- AddForeignKey
ALTER TABLE "tender" ADD CONSTRAINT "tender_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenderDocument" ADD CONSTRAINT "tenderDocument_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenderChecklistItem" ADD CONSTRAINT "tenderChecklistItem_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeal" ADD CONSTRAINT "appeal_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activityLog" ADD CONSTRAINT "activityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activityLog" ADD CONSTRAINT "activityLog_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activityLog" ADD CONSTRAINT "activityLog_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activityLog" ADD CONSTRAINT "activityLog_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "appeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

