# Bid360 Crawler Resilience Overhaul — Complete Implementation Plan

## Context & Constraints

You are working on **bid360**, a tender monitoring system that crawls a single source
(etenders) on Vercel Hobby plan with once-daily cron execution. Constraints:

- **300s max function duration** (Fluid Compute), using **240s internal deadline**
- **Once-daily execution** — a failed run means 24 hours of missed opportunities
- **Vercel Serverless** — no persistent memory, no background threads, cold starts
- **Prisma ORM** — connection pooling limits apply; shadow database required for migrations
- **Single crawl source** — etenders only; all optimisations are etenders-specific where needed

### Must Preserve
- Vercel Hobby plan compatibility (300s max, once-daily cron)
- All existing opportunity matching logic (zero changes)
- Current notification delivery (make non-fatal, not removed)
- Organization/dedupe logic (only the write path changes)

### Code Quality Standards (apply to every task)
- Single-responsibility functions; no function > 60 lines without justification
- All async operations have explicit timeout protection
- No silent error swallowing — everything classified and logged
- JSDoc comments explaining **why** for non-obvious decisions
- TypeScript strict mode throughout
- Every new module has a corresponding test file created alongside it

---

## Phase 0: Observability Baseline (No Approval Required)
> **Rationale:** You are about to change a system whose failure modes are currently
> invisible. Before touching any logic, instrument what exists so you can measure
> whether changes actually help. This phase adds no behaviour changes — pure
> read-path instrumentation.

### Task 0.1: Add structured logging wrapper
- **File**: Create `lib/logger.ts`
- **Implement**: Thin wrapper around `console.log` that emits structured JSON with
  `{ level, phase, runId, message, data, durationMs?, error? }`. Use this wrapper
  for every log statement added in subsequent phases.
- **Why**: Vercel log drain ingests JSON; free-text logs are unsearchable.
- **Success criteria**: Every subsequent log line is parseable JSON with consistent shape.

### Task 0.2: Instrument the existing crawl function non-invasively
- **File**: Existing crawl entry point (do not restructure yet)
- **Add**: Timing probes at: run start, first page fetched, last page fetched,
  processing start, processing end, notification start, notification end.
- **Add**: Count probes: pages attempted, pages succeeded, tenders found, tenders written.
- **Log** all probes using the logger from 0.1. No logic changes.
- **Success criteria**: A single production run produces a timeline you can reconstruct
  purely from logs.

### Task 0.3: Capture and log current failure modes for one week (async)
- **Not a code task** — run the instrumented version for at least one real execution
  before proceeding to Phase 1, unless this is a greenfield system.
- **Document**: What actually fails, how often, at which phase.
- **Use this data** to validate or adjust phase priorities below.

---

## Phase 1: Foundation Fixes (No Approval Required)
> These are bugfix-level changes. They prevent data corruption and improve error
> visibility without altering any observable behaviour or schema.

### Task 1.1: Replace findFirst+create with atomic upsert
- **File**: Locate the opportunity write path (likely `lib/crawler.ts`)
- **Current problem**: findFirst → create/update is a race condition on the
  `organizationId_dedupeKey` unique constraint. Overlapping or resumed runs can
  produce duplicates.
- **Implement**:
  ```typescript
  await prisma.opportunity.upsert({
    where: { organizationId_dedupeKey: { organizationId, dedupeKey } },
    create: { ...opportunityData },
    update: { ...updateFields }, // only mutable fields, never overwrite immutable ones
  });
  ```
- **Important**: Define explicitly which fields are **immutable** after first write
  (e.g. `discoveredAt`, `sourceRef`) and which are **mutable** (e.g. `closingDate`,
  `title`, `status`). Document this in a comment above the upsert.
- **Success criteria**: No duplicate opportunities possible even with parallel writes.
- **Test**: Unit test simulating two concurrent upserts with identical dedupe key —
  assert exactly one record exists after both settle.

### Task 1.2: Implement classified error handling
- **File**: Create `lib/errors.ts`
- **Implement**:

  ```typescript
  type CrawlErrorType =
    | 'retryable'        // transient network issues, 5xx
    | 'rate_limited'     // 429, has Retry-After
    | 'fatal'            // 4xx non-429, auth failure
    | 'source_data_invalid' // parse failure, schema mismatch
    | 'timeout'          // request exceeded deadline
    | 'budget_exhausted' // time budget consumed (not an error per se)

  class CrawlError extends Error {
    constructor(
      message: string,
      public readonly type: CrawlErrorType,
      public readonly retryAfterMs?: number,
      public readonly context?: Record<string, unknown>
    ) { super(message); }
  }

  function classifyError(err: unknown, httpStatus?: number): CrawlError
  ```

- **Classification rules** (document these as a decision table in the code):
  | Condition | Type |
  |---|---|
  | HTTP 429 | `rate_limited` |
  | HTTP 5xx | `retryable` |
  | HTTP 4xx (non-429) | `fatal` |
  | `fetch` throws (network) | `retryable` |
  | AbortError / timeout | `timeout` |
  | JSON/HTML parse failure | `source_data_invalid` |
  | Prisma constraint violation | `fatal` |

- **Implement** `withRetry<T>(fn, options)`:
  - Respects `CrawlErrorType` — only retries `retryable` and `rate_limited`
  - Exponential backoff with jitter: `delay = base * 2^attempt + rand(0, 500ms)`
  - Reads `Retry-After` header for `rate_limited` errors
  - Max 3 attempts for `retryable`, 2 for `rate_limited`
  - Never retries `fatal` or `source_data_invalid`

- **Success criteria**: Every caught error has a type; retry decisions are driven by type.
- **Test**: Simulate HTTP 429 (with Retry-After), 500, network throw, parse throw —
  verify type, verify retry count, verify backoff timing.

### Task 1.3: Add crawl diagnostics collection
- **File**: Create `lib/diagnostics.ts`
- **Implement**:
  ```typescript
  interface CrawlDiagnostics {
    // Discovery
    pagesFound: number;
    pagesProcessed: number;
    pagesFailed: number;
    pagesSkipped: number;       // skipped due to budget
    // Tenders
    tendersDiscovered: number;
    tendersProcessed: number;
    tendersSkipped: number;     // already seen this run
    tendersInvalid: number;     // failed quality check
    tendersDeadLettered: number;
    // Errors (keyed by CrawlErrorType)
    errorBreakdown: Record<CrawlErrorType, number>;
    // Timing
    phaseTimings: Record<'discovery' | 'processing' | 'cleanup', number>;
    // Run outcome
    exitReason: 'completed' | 'budget_exhausted' | 'fatal_error' | 'lease_expired';
  }
  ```
- **Implement** a `DiagnosticsCollector` class with methods:
  `recordPage(outcome)`, `recordTender(outcome)`, `recordError(error)`,
  `startPhase(phase)`, `endPhase(phase)`, `snapshot(): CrawlDiagnostics`
- **Pass** the collector instance through the crawl call stack; never use module-level
  mutable state.
- **Success criteria**: Every run returns a complete diagnostics snapshot regardless
  of how it exits. No diagnostic data is lost on error.
- **Test**: Mock a mid-crawl page failure; assert diagnostics capture it correctly
  and exit reason is set.

---

## Phase 2: Schema Migration (Approval Required)
> Schema changes are isolated here before any logic that depends on them.
> Approval gate exists because Prisma migrations on Vercel require careful
> deployment ordering.

### Task 2.0: Schema migration strategy (prerequisite, not optional)
Before writing any migration, document and get approval on:
1. **Migration timing**: Migration must run *before* new code deploys. On Vercel
   this means: run `prisma migrate deploy` in the build step, or manually before
   promoting. Document the chosen approach.
2. **Zero-downtime**: All new fields must be nullable or have defaults, so old
   code can run against the new schema during the deploy window.
3. **Rollback**: For each new field, document whether dropping it is safe
   (additive = safe) or destructive (data loss = unsafe). Provide a down migration
   for each change.

### Task 2.1: SourceRun state machine schema
- **File**: `prisma/schema.prisma`
- **Add to SourceRun model**:
  ```prisma
  enum RunStatus {
    pending
    running
    completed
    completed_with_warnings
    partial_timeout
    failed
    stale
  }

  model SourceRun {
    // ... existing fields ...
    status          RunStatus  @default(pending)
    heartbeatAt     DateTime?
    leaseExpiresAt  DateTime?
    diagnostics     Json?
    cursor          Json?
    metrics         Json?
    notificationSentAt   DateTime?
    notificationError    String?
  }
  ```
- **Add DeadLetter model**:
  ```prisma
  model DeadLetter {
    id            String   @id @default(cuid())
    tenderRef     String
    sourceRunId   String
    failureType   String
    failureCount  Int      @default(1)
    lastError     String
    rawData       Json
    resolvedAt    DateTime?
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt

    @@index([tenderRef])
    @@index([resolvedAt])
  }
  ```
- **Implement** state transition validator in `lib/run-state.ts`:
  ```typescript
  const VALID_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
    pending:    ['running', 'stale'],
    running:    ['completed', 'completed_with_warnings', 'partial_timeout', 'failed', 'stale'],
    partial_timeout: ['running', 'stale'],
    stale:      ['running'],
    completed:  [],  // terminal
    completed_with_warnings: [], // terminal
    failed:     [],  // terminal
  }
  function assertValidTransition(from: RunStatus, to: RunStatus): void
  ```
- **Deliverable for approval**: Schema diff, state transition diagram, migration plan
  with rollback.

---

## Phase 3: Run Lifecycle & Resume Logic (Approval Required)
> These tasks implement the lease/heartbeat system and cursor-based resume.
> They depend on Phase 2 schema being deployed.

### Task 3.1: Implement lease/heartbeat system
- **File**: Create `lib/run-lifecycle.ts`
- **Implement**:

  **`acquireLease(sourceId, leaseDurationMs = 270_000)`**:
  ```
  1. In a Prisma transaction:
     a. Find any run for sourceId with status 'running' AND leaseExpiresAt < now()
        → update those to status 'stale'
     b. Assert no run with status 'running' still exists for sourceId
        → if one exists with valid lease, throw CrawlError('fatal', 'run already active')
     c. Create new run with status 'running', leaseExpiresAt = now + leaseDurationMs
  2. Return the new run
  ```
  - **Why a transaction**: Without atomicity, two cold-start Lambda invocations can
    both pass the "no active run" check simultaneously.

  **`startHeartbeat(runId, intervalMs = 15_000)`**:
  - Returns a `NodeJS.Timeout` handle
  - Every interval: `UPDATE SourceRun SET heartbeatAt = now(), leaseExpiresAt = now() + 270s`
  - On error: log warning, do not throw (heartbeat failure is not fatal to the crawl)
  - Returns a `stopHeartbeat()` function

  **`releaseRun(runId, status, diagnostics, cursor?)`**:
  - Stops heartbeat
  - Transitions status with `assertValidTransition`
  - Writes diagnostics + cursor atomically

- **Success criteria**: No two runs active simultaneously; stale runs cleaned within
  one heartbeat cycle.
- **Test**: Simulate two concurrent `acquireLease` calls; assert second throws.
  Simulate expired lease; assert stale cleanup fires.

### Task 3.2: Implement cursor-based page iteration with validation
- **File**: Create `lib/page-iterator.ts`
- **Implement** an AsyncGenerator:
  ```typescript
  async function* iteratePages(
    fetchPage: (n: number) => Promise<PageResult>,
    cursor: CrawlCursor | null,
    timeBudget: TimeBudget,
  ): AsyncGenerator<PageBatch>

  interface CrawlCursor {
    lastProcessedPage: number;
    lastProcessedRef: string;
    snapshotDate: string;          // ISO date of crawl start
    firstRefOnPage: string;        // for reorder detection
    lastRefOnPage: string;
    totalPagesExpected: number;    // from first run of this session
  }

  interface PageBatch {
    tenders: RawTender[];
    pageNumber: number;
    isLastPage: boolean;
    cursorAfterPage: CrawlCursor;
  }
  ```

- **Cursor validation on resume** (run before yielding first batch):
  ```
  1. Fetch the resume page (cursor.lastProcessedPage)
  2. Extract first and last tender refs from that page
  3. Compare against cursor.firstRefOnPage and cursor.lastRefOnPage
  4. If refs don't match: log warning, restart from page 1 with fresh cursor
     (etenders may have reordered — safer to restart than to skip or duplicate)
  5. If page count changed significantly (>10%): log structural warning but continue
  ```

- **Bootstrap problem** (first-ever run has no cursor):
  - `cursor = null` → start from page 1, build cursor as you go
  - After page 1 completes: initialize cursor with `totalPagesExpected` from pagination
  - Save cursor after *each page*, not at the end

- **Success criteria**: Resume starts from last saved page; reordering detected and
  handled safely; first run bootstraps correctly.
- **Test**: Mock 3-page crawl, simulate kill on page 2, assert resume reads page 2
  first. Mock reordered page, assert fallback to page 1.

### Task 3.3: Wire resume into run initialization
- **File**: Run initialization logic
- **Logic**:
  ```
  1. Query for most recent run for this source
  2. If run.status IN ('partial_timeout', 'stale') AND run.cursor IS NOT NULL:
     → resume: use existing runId, reset status to 'running', refresh lease
  3. If run.status = 'running' AND lease valid:
     → abort: another instance is active (lease system should have caught this)
  4. Otherwise:
     → fresh run: acquireLease(), cursor = null
  ```
- **Why reuse runId on resume**: Keeps diagnostics and metrics continuous for the
  same logical "day's crawl" rather than fragmenting across multiple run records.
- **Success criteria**: A killed run's cursor is used on next invocation; a fresh
  run starts clean.

---

## Phase 4: ETenders-Specific Reliability (Approval Required)

### Task 4.1: Structural change detection with fingerprinting
- **File**: Create `lib/etenders/structure-validator.ts`
- **Implement**:
  ```typescript
  interface StructureFingerprint {
    tenderCardSelector: string;
    paginationSelector: string;
    fieldSelectors: Record<string, string>;
    sampleTenderCount: number;
    capturedAt: string;
  }

  function validateStructure(html: string, stored: StructureFingerprint | null):
    { valid: boolean; issues: string[]; fingerprint: StructureFingerprint }
  ```
- **Bootstrap problem** (first run — no stored fingerprint):
  - If `stored = null`: run validation in "learn" mode — build fingerprint, return
    `valid: true`, log "Fingerprint initialized"
  - Store fingerprint on the SourceRun after first successful completion
  - On next run: compare against stored

- **Validation checks**:
  1. Tender card selector matches > 0 elements
  2. All required field selectors present on at least one card
  3. Pagination selector present (unless only 1 page)
  4. Sample tender count within 50% of historical average (anomaly, not failure)

- **On structural failure**: Set run status `failed`, store issues in diagnostics,
  **do not write any tender data**. Structural failures should page the operator.

- **Deliverable for approval**: Mock HTML with changed selector, show detection +
  safe failure with no DB writes.

### Task 4.2: Polite rate limiting
- **File**: Create `lib/http-client.ts` (replace raw fetch usage)
- **Implement** a `RateLimitedClient` class:
  ```typescript
  class RateLimitedClient {
    private lastRequestAt = 0;
    private consecutiveRateLimits = 0;
    private readonly minIntervalMs = 2_000;
    private readonly cooldownMs = 60_000;
    private readonly maxConsecutiveRateLimits = 3;

    async fetch(url: string, options?: RequestInit): Promise<Response>
  }
  ```
- **Request flow**:
  ```
  1. If consecutiveRateLimits >= maxConsecutiveRateLimits: wait cooldownMs, reset counter
  2. Enforce minIntervalMs since lastRequestAt
  3. Execute fetch with AbortController timeout (30s)
  4. On 429: increment counter, read Retry-After, throw CrawlError('rate_limited')
  5. On success: reset consecutiveRateLimits, update lastRequestAt
  ```
- **Single instance** per crawl run — pass via dependency injection, not module singleton
  (module singletons don't reset between Vercel function invocations predictably).
- **Success criteria**: No request fires within 2s of previous; 429 cascade triggers
  cooldown; Retry-After is respected.
- **Test**: Assert timing distribution across 5 simulated requests. Assert cooldown
  fires after 3 consecutive 429s.

### Task 4.3: Tender quality validation
- **File**: Create `lib/etenders/tender-validator.ts`
- **Implement**:
  ```typescript
  type TenderQuality = 'valid' | 'warning' | 'invalid'

  interface ValidationResult {
    quality: TenderQuality;
    issues: string[];
  }

  function validateTender(raw: RawTender): ValidationResult
  ```
- **Validation rules**:
  | Field | Rule | Failure = |
  |---|---|---|
  | referenceNumber | Matches etenders pattern `/^[A-Z0-9\-\/]+$/` | `invalid` |
  | closingDate | Is future date, not > 5 years ahead | `warning` if past, `invalid` if malformed |
  | description | Non-empty, length > 20 chars, not a known placeholder | `invalid` |
  | title | Non-empty | `invalid` |
  | organizationName | Non-empty | `warning` |
- **Processing rules**:
  - `valid` → write to DB
  - `warning` → write to DB, flag in diagnostics
  - `invalid` → do NOT write; send to dead letter queue (Task 4.4)

- **Test**: Run validator against: normal tender, tender with past closing date,
  tender with empty description, tender with invalid ref format.

### Task 4.4: Dead letter queue with resolution path
- **File**: Create `lib/dead-letters.ts`
- **Implement**:
  ```typescript
  async function sendToDeadLetter(
    tenderRef: string,
    runId: string,
    error: CrawlError,
    rawData: unknown
  ): Promise<void>

  // Called before each processing attempt — checks if tender is already dead-lettered
  async function isDeadLettered(tenderRef: string): Promise<boolean>

  // Resolution path — called manually or via admin UI
  async function resolveDeadLetter(id: string, resolution: 'retried' | 'ignored'): Promise<void>

  // Review query
  async function getPendingDeadLetters(days = 7): Promise<DeadLetter[]>
  ```
- **Retry logic**: A dead-lettered tender is retried on the *next* run if
  `failureCount < 3` AND `resolvedAt IS NULL`. After 3 failures, it stays in dead
  letter and requires manual resolution.
- **Why a resolution path matters**: Without it, dead letters accumulate forever and
  become noise. `resolveDeadLetter` marks them handled so the queue stays actionable.
- **Test**: Simulate 3 consecutive failures for same tenderRef; assert it stays dead-
  lettered and is not retried on 4th run. Simulate resolution; assert it's retried.

### Task 4.5: Run-to-run diff tracking
- **File**: Create `lib/run-diff.ts`
- **Implement**:
  ```typescript
  interface RunDiff {
    newTenders: string[];        // refs
    updatedTenders: string[];    // refs where mutable fields changed
    removedTenders: string[];    // refs present last run, absent this run
    structuralChanges: string[]; // from structure validator
    anomalies: RunDiffAnomaly[];
  }

  interface RunDiffAnomaly {
    type: 'mass_removal' | 'count_spike' | 'all_dates_changed';
    severity: 'warning' | 'critical';
    detail: string;
  }

  async function computeRunDiff(currentRunId: string, previousRunId: string): Promise<RunDiff>
  ```
- **Anomaly thresholds** (make these configurable constants, not magic numbers):
  ```typescript
  const ANOMALY_THRESHOLDS = {
    massRemovalPct: 0.5,   // >50% of previous tenders absent = critical
    countSpikePct: 2.0,    // >200% of previous count = warning (scraper loop?)
  }
  ```
- **On critical anomaly**: Do not mark run `completed`; mark `completed_with_warnings`
  and include anomaly detail in diagnostics.
- **Test**: Mock previous run with 100 tenders; current run has 20 — assert
  `mass_removal` critical anomaly fires.

---

## Phase 5: Time Budget & Operational Safety (Approval Required)

### Task 5.1: Time budget manager
- **File**: Create `lib/time-budget.ts`
- **Implement**:
  ```typescript
  class TimeBudget {
    constructor(private readonly deadlineMs: number) {}

    // Dynamic phase budgets — derived from actual page count after discovery
    allocatePhases(totalPages: number): PhaseBudgets

    remaining(): number       // ms until deadline
    hasBuffer(bufferMs: number): boolean
    checkpoint(label: string): void   // logs elapsed + remaining
    isExhausted(): boolean
  }

  interface PhaseBudgets {
    discovery: number;
    processing: number;
    cleanup: number;
  }
  ```
- **Dynamic allocation** (not fixed percentages):
  ```
  discovery = max(30_000, totalPages * 2_500)   // 2.5s per page + floor
  cleanup   = 15_000                             // fixed: writes + notification
  processing = remaining - cleanup               // everything else
  ```
  This means a 10-page crawl allocates much less to discovery than a 100-page one.

- **Usage pattern**:
  ```typescript
  // Before each page:
  if (!budget.hasBuffer(30_000)) {
    await releaseRun(runId, 'partial_timeout', diagnostics, cursor);
    return;
  }
  ```
- **Success criteria**: Function never hard-times-out; always saves cursor before exit.
- **Test**: Simulate 200-page crawl with 240s budget — assert it exits gracefully
  at budget boundary with cursor saved.

### Task 5.2: Decouple notification from crawl completion
- **File**: Main crawl orchestration
- **Current problem**: Notification failure marks entire run as failed, destroying
  valid crawl data.
- **Implement**:
  ```typescript
  // Step 1: Mark crawl complete BEFORE notification
  await releaseRun(runId, resolvedStatus, diagnostics);

  // Step 2: Attempt notification in isolated try-catch
  try {
    await sendDigest(results);
    await prisma.sourceRun.update({
      where: { id: runId },
      data: { notificationSentAt: new Date() }
    });
  } catch (err) {
    await prisma.sourceRun.update({
      where: { id: runId },
      data: { notificationError: classifyError(err).message }
    });
    logger.warn('notification_failed', { runId, error: err });
    // Do NOT rethrow
  }
  ```
- **Success criteria**: Email failure never changes run status; notification error
  is queryable.
- **Test**: Mock email throw; assert run status = `completed`, `notificationError`
  is populated.

### Task 5.3: Prisma connection management
- **File**: `lib/db.ts` (or wherever Prisma client is instantiated)
- **Problem**: Vercel Serverless can spawn multiple function instances; each creates
  its own Prisma connection. Without pooling awareness, you hit connection limits.
- **Implement**:
  ```typescript
  // Use global singleton pattern to reuse across warm invocations
  const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

  export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
  }
  ```
- **Add** explicit `$disconnect()` call in the crawl's `finally` block.
- **Document** the connection limit for your database provider and how many
  concurrent Vercel function instances could theoretically fire.
- **Success criteria**: No "too many connections" errors under normal operation.

### Task 5.4: Structured run metrics
- **File**: `lib/metrics.ts`
- **Implement**:
  ```typescript
  interface RunMetrics {
    timing: {
      discoveryMs: number;
      processingMs: number;
      cleanupMs: number;
      totalMs: number;
      budgetUtilizationPct: number;
    };
    throughput: {
      pagesPerSecond: number;
      tendersPerSecond: number;
      bytesDownloaded: number;
    };
    quality: {
      validTenders: number;
      warningTenders: number;
      invalidTenders: number;
      deadLetteredTenders: number;
      duplicateAttempts: number;    // upsert hits on existing records
    };
  }
  ```
- Metrics are computed from `DiagnosticsCollector` snapshot at run end.
- Stored in `SourceRun.metrics` JSON field.
- **Success criteria**: Every run has complete metrics; `budgetUtilizationPct` lets
  you spot runs that are dangerously close to timeout.

---

## Phase 6: Testing & Validation (No Approval Required)

### Task 6.1: Test infrastructure setup
- **Framework**: Use Vitest (works in Vercel/Edge environments; Jest has subtle
  Node compatibility issues with some Prisma setups).
- **HTTP mocking**: Use `msw` (Mock Service Worker) for HTTP interception — more
  realistic than nock, works with native `fetch`.
- **Database**: Use `prisma-mock` or a real SQLite test database (not the production
  Postgres). Document the setup in `README.md`.
- **Fixtures**: Create `test/fixtures/etenders/` with:
  - `normal-page-1.html`, `normal-page-2.html`, `normal-page-3.html`
  - `structure-changed.html` (key selectors renamed)
  - `rate-limited-response.html` (429 with Retry-After)
  - `empty-page.html` (pagination edge case)
  - `malformed-tenders.html` (invalid refs, past dates, empty descriptions)

### Task 6.2: Integration test scenarios
Write a test for each scenario. Each test should be independently runnable.

| # | Scenario | Key Assertions |
|---|---|---|
| 1 | Normal crawl, all pages | All tenders written, status=completed, metrics populated |
| 2 | Timeout mid-page-2 | status=partial_timeout, cursor=page 2, diagnostics show pagesProcessed=1 |
| 3 | Resume after timeout | Reads cursor, starts at page 2, final status=completed |
| 4 | Structural change detected | status=failed, zero DB writes, issues in diagnostics |
| 5 | Rate limiting cascade | 3x 429 triggers cooldown, crawl completes after backoff |
| 6 | Parallel run attempt | Second acquireLease throws, first run unaffected |
| 7 | Killed run (no graceful exit) | Lease expires, next run marks stale, resumes from cursor |
| 8 | Email failure | status=completed, notificationError populated |
| 9 | Malformed tender data | Invalid tenders go to dead letter, valid ones written |
| 10 | Mass removal anomaly | status=completed_with_warnings, anomaly in diagnostics |
| 11 | Page reorder on resume | Falls back to page 1, completes normally |
| 12 | First-ever run (no fingerprint) | Fingerprint bootstrapped, run completes normally |

### Task 6.3: Rollback plan
Document for each phase:

| Phase | Changes | Rollback Safe? | Rollback Procedure |
|---|---|---|---|
| 0 | Logging only | ✅ Yes | Revert files, no schema change |
| 1.1 | Upsert logic | ✅ Yes | Revert to findFirst+create (data already clean) |
| 1.2 | Error handling | ✅ Yes | Revert files |
| 1.3 | Diagnostics | ✅ Yes | Revert files |
| 2 | Schema additions | ⚠️ Additive | New nullable fields — old code runs against new schema safely. Down migration drops columns (data loss for diagnostics/cursor only) |
| 3–5 | Logic changes | ✅ Yes (after schema rollback) | Revert logic files after down migration |

---

## Implementation Order & Gates

```
Phase 0  →  (run in production, observe)
Phase 1  →  (unit tests pass)
Phase 2  →  (schema approved + migration plan approved)
Phase 3  →  (depends on Phase 2 deployed)
Phase 4  →  (can run in parallel with Phase 3)
Phase 5  →  (depends on Phase 3 complete)
Phase 6  →  (runs throughout; all scenarios must pass before each phase marked done)
```

Each phase gate requires:
1. All tasks in phase implemented
2. All tests for that phase passing
3. No regressions in existing tests
4. For approval phases: written summary of changes delivered before proceeding

---

## Success Metrics

| Metric | Target | How to Measure |
|---|---|---|
| Failed runs | < 5% | `RunStatus = 'failed'` over 30 days |
| Partial runs that resume successfully | > 95% | cursor present on partial + next run reaches completed |
| Structural changes detected before corrupt write | 100% | validator fires before any DB write |
| Duplicate opportunities | 0 | unique constraint + upsert |
| Hard timeouts (Vercel 300s kill) | 0 | budget manager exits at 240s |
| Runs with complete diagnostics | 100% | `diagnostics IS NOT NULL` on all terminal runs |
| Dead letters resolved within 7 days | > 80% | `resolvedAt IS NOT NULL` within 7 days of creation |
