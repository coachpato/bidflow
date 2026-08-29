# Tender lifecycle

Bid360 stores one shared `Opportunity` record for each source tender. The public route is `/tenders/{opportunityId}/{optional-slug}`; the numeric opportunity ID is the permanent identity and the slug is cosmetic.

Crawler writes update `lastSeenAt` and `lastVerifiedAt`. They preserve existing user workflow fields such as `status` and `notes`. A source status containing cancellation or award evidence is displayed as `Cancelled` or `Awarded`; a past closing date is displayed as `Closed`. After the configured period, the retention job marks the record with `archivedAt` and the page remains available as `Archived`.

The proposed default archival period is 12 months after the closing date. Set `TENDER_ARCHIVE_MONTHS_AFTER_CLOSE` to change it. The retention endpoint is `/api/crawler/retention`, protected by `CRON_SECRET`, and is dry-run by default. Set `TENDER_RETENTION_DRY_RUN=false` only after reviewing the reported candidate count. The batch size is capped at 1,000 by the job.

If a source verification process sets `sourceMissingAt`, the page retains the last stored metadata and states that the source could not recently be verified. The current daily eTenders listing is a paginated active-opportunity crawl, so it does not by itself prove that an older closed tender was removed. A future complete source-verification pass can set `sourceMissingAt` when that distinction is known.

Document metadata is retained when eTenders supplies a stable official document URL and source document ID. Documents are not downloaded or permanently archived unless `CRAWLER_ARCHIVE_TENDER_DOCUMENTS=true` is explicitly enabled, preserving the existing storage and retention boundary.
