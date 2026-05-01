# Crawler Diagnostic Report
Date: 2026-04-30

## 1. How the crawler works

| Area | Finding |
| --- | --- |
| Source URLs | The listing crawler targets `https://www.etenders.gov.za/Home/PaginatedTenderOpportunities` with query params `draw=1`, `start`, `length=100`, and `status=1` (`lib/crawler/etenders-crawler.js:5-8`, `103-115`). It records `https://www.etenders.gov.za/Home/opportunities?id=1` as the source page (`lib/crawler/etenders-crawler.js:6`, `57`). |
| HTML/selectors | The main listing path does not parse HTML; it consumes the eTenders DataTables JSON response. Dormant/detail helpers use Cheerio over full page text for `Organ of State|Department|Entity` and email regexes (`lib/crawler/etenders-crawler.js:196-211`), and PDF selectors `a[href*=".pdf"], a[href*="download"]` (`lib/crawler/etenders-crawler.js:274-286`). |
| Parsed fields | Rows are mapped from JSON fields including `id`, `description`, `tender_No`, `category`, `date_Published`, `closing_Date`, `organ_of_State`, `department`, `compulsory_briefing_session`, `contactPerson`, `email`, and `province` (`lib/crawler/etenders-crawler.js:46-69`). |
| Sector filtering | The API loads all organizations with `firmProfile`, crawls globally once, then evaluates each tender per organization (`app/api/crawler/route.js:417-459`). It uses the singular `firmProfile.serviceSector`, defaults to legal, concatenates title + description + PDF text, lowercases it, and checks exact substring keyword matches (`app/api/crawler/route.js:437-447`, `lib/crawler/keyword-matcher.js:179-198`). `evaluateOpportunityMatch` then boosts score for preferred entities, practice areas, work types, and province, and only keeps `fitScore >= 40` (`lib/opportunity-radar.js:152-246`). |
| Storage | It writes `Source`, `SourceRun`, `Opportunity`, `OpportunityMatch`, `OpportunityDocument`, and `Notification` records. Core models are in `prisma/schema.prisma:182-294`, `233-263`, and `506-524`. Opportunities are deduped per organization by `organizationId + dedupeKey` (`prisma/schema.prisma:225`). |
| Triggering | Triggered by authorized `GET /api/crawler`, requiring `Authorization: Bearer ${CRON_SECRET}` (`app/api/crawler/route.js:28-32`, `403-406`). Vercel cron calls `/api/crawler` daily at `0 4 * * *` (`vercel.json:12-13`). |
| Per-user/global | The scrape is global, then matched per organization. It is not per-user (`app/api/crawler/route.js:417-459`). If no organizations exist, it creates organization context from users (`app/api/crawler/route.js:91-107`). |
| Retry/timeout/error handling | Listing requests use Axios timeout `45000ms` with exponential retry, max 2 retries (`lib/crawler/etenders-crawler.js:75-120`). Per-page errors are logged and skipped (`lib/crawler/etenders-crawler.js:160-164`). The API has a top-level failure handler that marks `SourceRun` failed (`app/api/crawler/route.js:567-587`). |
| Deduplication | Yes, per organization. `buildOpportunityDedupeKey` combines organization, source, external/reference/title, entity, and deadline (`lib/opportunity-radar.js:84-107`; used at `app/api/crawler/route.js:180-188`). |

## 2. Static code concerns

1. Critical: first-page source failure can create an unbounded crawl loop. `crawlETenders()` loops while `totalRecords === null || start < totalRecords`, but if the first page fails, `totalRecords` stays `null` and the catch block just increments `start` (`lib/crawler/etenders-crawler.js:136`, `160-164`). Combined with 45s Axios timeouts and retries (`lib/crawler/etenders-crawler.js:106-120`), this can hang a cron run and keep hitting the source.

2. High: the production API route is not a safe local diagnostic entry point. It creates/updates `SourceRun`, opportunities, matches, documents, notifications, can upload to Supabase, and sends alerts (`app/api/crawler/route.js:408-414`, `461-469`, `273-290`, `509-514`, `517-559`). Local `.env.local` points at a remote Supabase pooler host, so I did not call this route.

3. High: tender detail and PDF enrichment are effectively dormant in the current listing flow. `mapOpportunityRow()` sets `url: null` and `pdfLinks: []` (`lib/crawler/etenders-crawler.js:55`, `67`), while `getTenderDetails()` and `getPDFLinksFromTender()` return early when those fields already exist (`lib/crawler/etenders-crawler.js:182-184`, `260-262`). Result: `buildTenderSourcePack()` normally has no page URL, no PDFs, and no extracted PDF text (`app/api/crawler/route.js:112-145`).

4. High: performance is serial and has no explicit source rate limit. The route loops all tenders, then all organizations, and PDF processing would download/extract documents sequentially if links were present (`app/api/crawler/route.js:431-469`, `118-139`). There is no max tender cap, run budget, concurrency limiter, or robots/backoff policy beyond retry delays.

5. Medium: sector matching is exact substring matching with no word boundaries, stemming, fuzzy matching, negative terms, or source-field weighting (`lib/crawler/keyword-matcher.js:179-198`). Scores can become high from repeated keywords in one category (`lib/crawler/keyword-matcher.js:157-177`).

6. Medium: only the singular `firmProfile.serviceSector` is used during crawler matching (`app/api/crawler/route.js:437`), even though the schema supports `serviceSectors String[]` (`prisma/schema.prisma:79-80`) and `lib/service-sectors.js` has multi-sector helpers.

7. Medium: the listing mapper is tightly coupled to eTenders JSON field names and silently drops rows without title/reference (`lib/crawler/etenders-crawler.js:46-69`, `151-153`). There are no schema assertions, fallback field names, or parse-error counters.

8. Medium: listing page errors are swallowed inside `crawlETenders()` and are not surfaced to the API result unless the whole crawl throws (`lib/crawler/etenders-crawler.js:160-168`, `app/api/crawler/route.js:420-429`). A partial crawl can look successful.

9. Low: stale/unused code signals exist. `sendDailyDigestEmail()` and `createDigestNotification()` are defined but not called in the crawler route (`app/api/crawler/route.js:311-401`).

10. Low: there are mojibake strings such as `Ownerâ€™s engineer` in keyword/config labels (`lib/crawler/keyword-matcher.js:96-97`, `lib/service-sectors.js:153-154`), which suggests encoding drift in matching/display data.

## 3. Live run results

I created `scripts/crawler-diagnostic.js` as the allowed diagnostic-only runner. It imports the real crawler, patches local alias resolution, avoids the API route, avoids Prisma/Supabase/email, and caps the crawl to the first live DataTables page per run to respect the source-hit limit.

The live command did not complete:

| Metric | Result |
| --- | --- |
| Command | `node scripts/crawler-diagnostic.js` |
| Outcome | Timed out before emitting diagnostic JSON |
| Wall time before tool timeout | `244050ms` |
| Cleanup | A leftover Node process from the run was found and killed |
| HTTP status captured | Not available; the process produced no completed run output |
| Parsed tenders | Not available |
| Parse errors/skipped items | Not available |
| Follow-up source hits | Skipped to avoid exceeding the requested `~5` total source-hit budget |

| Run | Duration | HTTP status | Parsed tenders | Parse/skipped count | First 5 tenders |
| --- | --- | --- | --- | --- | --- |
| 1 | Not completed; overall command exceeded `244050ms` | Unknown | Unknown | Unknown | Not captured |
| 2 | Not reached/reported | Unknown | Unknown | Unknown | Not captured |
| 3 | Not reached/reported | Unknown | Unknown | Unknown | Not captured |

Because no completed live output was emitted, I cannot honestly report sample tenders. The technical finding is that the crawler could not be verified live from this environment within a reasonable diagnostic timeout.

## 4. Verdict (technical only, not relevance)

Pick ONE: BROKEN

The code has a plausible JSON-based crawler, but live verification failed: the safe diagnostic run exceeded `244050ms` without producing even first-page metrics. Static review also found a real unbounded-loop failure mode when initial pagination does not establish `totalRecords`, plus the production route is too side-effectful to use as a diagnostic entry point. Relevance/accuracy of surfaced tenders still needs manual review.

## 5. Top 5 issues to fix, ranked

1. Unbounded failure loop and long timeouts. Location: `lib/crawler/etenders-crawler.js:136`, `160-164`, `106-120`. Effort: S. Fix by failing fast when the first page cannot establish `totalRecords`, surfacing page errors, and adding a max pages/request budget.

2. No safe first-class dry-run mode. Location: `app/api/crawler/route.js:408-587`. Effort: M. Add a read-only diagnostic path or script that reports crawl metrics without Prisma writes, Supabase uploads, or emails.

3. Detail/PDF enrichment does not run for mapped listing rows. Location: `lib/crawler/etenders-crawler.js:55`, `67`, `182-184`, `260-262`; `app/api/crawler/route.js:112-145`. Effort: M/L. Populate real detail/document URLs from eTenders JSON or a detail endpoint, then process documents under a strict budget.

4. Sector matcher is brittle and single-sector. Location: `lib/crawler/keyword-matcher.js:179-198`; `app/api/crawler/route.js:437`; `prisma/schema.prisma:79-80`. Effort: M. Use `serviceSectors`, word-boundary-aware matching, field weighting, and explicit false-positive tests.

5. Serial processing with no rate/run budget. Location: `app/api/crawler/route.js:431-469`, `118-139`. Effort: M. Add max tenders/pages per run, limited concurrency, per-host request pacing, and structured metrics for fetched/skipped/failed items.

## 6. Open questions

1. Is the current `.env.local` Supabase pooler production, staging, or a disposable dev database?

2. Does `PaginatedTenderOpportunities` include any stable detail/document URL fields that are not currently mapped?

3. What is the intended maximum crawl size and acceptable cron runtime for pilot launch?

4. Should organizations with multiple `serviceSectors` receive matches across all sectors, or only one primary sector?

5. Should pilot crawler runs send real emails immediately, or only create in-app notifications until relevance has been spot-checked?
