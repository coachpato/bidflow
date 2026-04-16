-- AlterTable
ALTER TABLE "Appeal" ADD COLUMN "template" TEXT;

-- AlterTable
ALTER TABLE "Tender" ADD COLUMN "assignedTo" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contract" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "client" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "renewalDate" DATETIME,
    "cancelDate" DATETIME,
    "value" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenderId" INTEGER,
    CONSTRAINT "Contract_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contract" ("client", "createdAt", "endDate", "id", "notes", "renewalDate", "startDate", "title", "value") SELECT "client", "createdAt", "endDate", "id", "notes", "renewalDate", "startDate", "title", "value" FROM "Contract";
DROP TABLE "Contract";
ALTER TABLE "new_Contract" RENAME TO "Contract";
CREATE UNIQUE INDEX "Contract_tenderId_key" ON "Contract"("tenderId");
CREATE TABLE "new_Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Notification" ("createdAt", "id", "message", "read") SELECT "createdAt", "id", "message", "read" FROM "Notification";
DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";
CREATE TABLE "new_TenderChecklistItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "responsible" TEXT,
    "dueDate" DATETIME,
    "notes" TEXT,
    "tenderId" INTEGER NOT NULL,
    CONSTRAINT "TenderChecklistItem_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TenderChecklistItem" ("done", "dueDate", "id", "label", "notes", "responsible", "tenderId") SELECT "done", "dueDate", "id", "label", "notes", "responsible", "tenderId" FROM "TenderChecklistItem";
DROP TABLE "TenderChecklistItem";
ALTER TABLE "new_TenderChecklistItem" RENAME TO "TenderChecklistItem";
CREATE TABLE "new_TenderDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "tenderId" INTEGER NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenderDocument_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TenderDocument" ("filename", "filepath", "id", "tenderId", "uploadedAt") SELECT "filename", "filepath", "id", "tenderId", "uploadedAt" FROM "TenderDocument";
DROP TABLE "TenderDocument";
ALTER TABLE "new_TenderDocument" RENAME TO "TenderDocument";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
