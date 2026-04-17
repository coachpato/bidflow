CREATE INDEX IF NOT EXISTS "firmPerson_organizationId_yearsExperience_idx"
ON "firmPerson" ("organizationId", "yearsExperience");

CREATE INDEX IF NOT EXISTS "firmExperience_organizationId_completedYear_idx"
ON "firmExperience" ("organizationId", "completedYear");

CREATE INDEX IF NOT EXISTS "complianceDocument_organizationId_documentType_isDefault_idx"
ON "complianceDocument" ("organizationId", "documentType", "isDefault");

CREATE INDEX IF NOT EXISTS "complianceDocument_organizationId_expiryDate_idx"
ON "complianceDocument" ("organizationId", "expiryDate");

CREATE INDEX IF NOT EXISTS "opportunity_organizationId_status_fitScore_deadline_idx"
ON "opportunity" ("organizationId", "status", "fitScore", "deadline");

CREATE INDEX IF NOT EXISTS "tenderDocument_tenderId_uploadedAt_idx"
ON "tenderDocument" ("tenderId", "uploadedAt");

CREATE INDEX IF NOT EXISTS "tenderChecklistItem_tenderId_done_idx"
ON "tenderChecklistItem" ("tenderId", "done");

CREATE INDEX IF NOT EXISTS "contract_organizationId_endDate_idx"
ON "contract" ("organizationId", "endDate");

CREATE INDEX IF NOT EXISTS "contract_organizationId_nextFollowUpAt_idx"
ON "contract" ("organizationId", "nextFollowUpAt");

CREATE INDEX IF NOT EXISTS "notification_organizationId_read_createdAt_idx"
ON "notification" ("organizationId", "read", "createdAt");

CREATE INDEX IF NOT EXISTS "notification_userId_read_createdAt_idx"
ON "notification" ("userId", "read", "createdAt");
