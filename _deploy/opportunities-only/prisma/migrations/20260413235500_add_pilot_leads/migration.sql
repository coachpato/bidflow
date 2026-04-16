CREATE TABLE IF NOT EXISTS "pilotLead" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "company" TEXT,
  "role" TEXT,
  "teamSize" TEXT,
  "whoWouldUseIt" TEXT NOT NULL,
  "pricingPreference" TEXT,
  "monthlyBudget" TEXT,
  "lifetimeBudget" TEXT,
  "painPoint" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pilotLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pilotLead_email_key" ON "pilotLead"("email");
