CREATE TABLE IF NOT EXISTS "crawl_runs" (
  "id" SERIAL NOT NULL,
  "run_id" TEXT NOT NULL,
  "source_run_id" INTEGER,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'running',
  "opportunities_found" INTEGER NOT NULL DEFAULT 0,
  "emails_sent" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "crawl_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crawl_runs_run_id_key" ON "crawl_runs"("run_id");
CREATE INDEX IF NOT EXISTS "crawl_runs_started_at_idx" ON "crawl_runs"("started_at");
CREATE INDEX IF NOT EXISTS "crawl_runs_status_started_at_idx" ON "crawl_runs"("status", "started_at");
CREATE INDEX IF NOT EXISTS "crawl_runs_source_run_id_idx" ON "crawl_runs"("source_run_id");
