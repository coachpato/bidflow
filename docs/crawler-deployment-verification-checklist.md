# Bid360 Crawler Deployment Verification Checklist

Use this checklist after deploying the crawler resilience overhaul. The live crawler should be run by the scheduled Vercel cron or an authorized manual cron request only.

## First-Ever Run

Expected behavior:
- No previous cursor exists, so the crawl starts at page 1.
- No stored `SourceFingerprint` exists, so the first valid page bootstraps the fingerprint and continues.
- No previous successful run exists, so `metrics.runDiff.previousRunId` is `null`.
- The run should end as `completed` or `completed_with_warnings` if quality or structural warnings are recorded.

Database checks:
- `sourceRun.runStatus` is terminal: `completed`, `completed_with_warnings`, `partial_timeout`, or `failed`.
- `sourceRun.diagnostics IS NOT NULL`.
- `sourceRun.metrics.runDiff.previousRunId` is `null`.
- `sourceFingerprint` has one row for the eTenders source.
- `sourceRun.cursor` is `null` on full completion, populated on `partial_timeout`.

## Normal Daily Run

Expected behavior:
- The crawl validates any available cursor before resuming.
- The current source fingerprint is compared with the stored fingerprint.
- Valid tenders are processed page by page.
- Cursor is saved after each page.
- Run diff is calculated against the previous `completed` or `completed_with_warnings` run.
- Run status is finalized before notification delivery.

Database checks:
- `sourceRun.runStatus = 'completed'` unless warnings were recorded.
- `sourceRun.metrics.runDiff` contains `newCount`, `updatedCount`, `removedCount`, and `missingRatio`.
- `sourceRun.metrics.timingBreakdown.totalDurationMs` is populated.
- `sourceRun.notificationSentAt` is populated on notification success.
- `sourceRun.notificationError` is populated on notification failure without changing `runStatus`.

## After a Vercel Function Timeout or Kill

Expected behavior:
- A graceful budget exit should set `runStatus = 'partial_timeout'`, `completionMode = 'partial-deadline'`, and `diagnostics.exitReason = 'time_budget'`.
- A killed invocation leaves a running lease that expires.
- The next invocation marks expired running runs as `stale`.
- If the stale run has a valid cursor, the next invocation resumes from the next page.

Database checks:
- Expired runs change from `running` to `stale`.
- The next run has `runStatus = 'running'` while active, then a terminal status.
- `sourceRun.cursor.nextPage` points to the page after the last saved page.
- `sourceRun.lastProcessedTenderRef` is populated on partial runs.
- No two rows for the same source remain active with `runStatus = 'running'` and unexpired `leaseExpiresAt`.

## Dead Letter Review

Expected behavior:
- Fatal or `source_data_invalid` tender failures are quarantined.
- Any tender that fails on its third consecutive attempt is quarantined.
- Dead-lettered tenders do not fail the whole run.

Database checks:
- `deadLetter.tenderRef`, `sourceRunId`, `failureType`, `failureCount`, `lastError`, and `rawData` are populated.
- Repeated failures for the same `tenderRef + sourceRunId` increment `failureCount`.
- `sourceRun.diagnostics.tendersDeadLettered` matches the number quarantined during the run.

## Logs to Monitor

Watch for these structured log fields and messages:
- `message = crawler_run_started`: confirms lease acquisition and resume page.
- `message = crawler_page_fetch_failed`: source availability or parsing risk.
- `message = crawler_structure_html_fetch_failed`: fingerprint validation degraded.
- `message = crawler_tender_quality_invalid`: source data quality issue.
- `message = crawler_tender_quality_warning`: tender written with warning.
- `message = crawler_rate_limit_429_backoff` and `crawler_rate_limit_consecutive_pause`: source throttling.
- `message = crawler_notification_delivery_failed`: notification issue only; crawl status should remain terminal success.
- `error.type`: should classify failures as `retryable`, `rate_limited`, `fatal`, `source_data_invalid`, `timeout`, or `budget_exhausted`.
- `runId`, `phase`, `durationMs`, and `data.sourceId`: required for tracing a run across Vercel logs.
