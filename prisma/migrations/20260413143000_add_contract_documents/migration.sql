-- CreateTable
CREATE TABLE IF NOT EXISTS "contractDocument" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'Other',
    "contractId" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contractDocument_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contractDocument_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contract"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contractDocument_contractId_idx" ON "contractDocument"("contractId");
