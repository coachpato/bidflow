# Full-Stack QA Test Report: Bid360

TEST EXECUTION: 2026-05-10T16:36:31+02:00
ENVIRONMENT: Local dev server at http://127.0.0.1:3000
GIT BRANCH: master
GIT STATUS: clean
APPLICATION: bid360
COMMIT: not resolved during test

## Executive Summary

Bid360 is a Next.js 16 / React 19 SaaS application for South African tender discovery, pursuit management, contracts, appeals, compliance vault documents, notifications, team invites, Google auth, Resend email, Prisma/Postgres, and Supabase Storage. The codebase has 40 page files, 52 API route files, 46 client components, and 28 Prisma models. State is mostly local React state plus server-rendered read models and `iron-session` cookie sessions. API routes generally use explicit session checks and organization scoping by `organizationId`; destructive delete routes commonly require `session.role === 'admin'`.

Executed checks found build-blocking quality issues: Jest fails 3 sector-radar expectations, ESLint fails 12 rules, and `npm audit` reports 2 high-severity direct dependency risks (`next`, `axios`) plus a moderate `postcss` issue through Next.js. Public pages render locally, unauthenticated dashboard routes redirect to `/login`, and negative auth API checks return safe validation errors. The local dev server repeatedly logs a Next.js warning because `metadata.colorScheme` is configured in `app/layout.js` instead of a viewport export. The first cold render of `/` took 10.4s in dev; warmed public routes measured 65-439ms, except repeated `/register` route renders at 436-944ms.

Security review found several priority items: document upload routes read entire files into memory without file size or MIME enforcement, Supabase storage buckets are auto-created as public, email verification HTML does not escape the user's name, auth and verification endpoints lack rate limiting, crawler PDF downloads need host allowlisting, and protected API calls are redirected to HTML login by the proxy instead of returning JSON 401s. Content density thresholds were not exceeded above the fold in public routes, but `/privacy` and `/terms` are text-heavy total pages and `/register` has high control density.

## Infrastructure Health

- Vercel: `vercel.json` defines crons for `/api/contracts/reminders` and `/api/crawler`. No live deployment mutation was performed. Local dev booted successfully.
- Supabase/Postgres: Prisma schema validation passed. Local `.env.local` has database URLs but is missing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`, so storage upload flows are not locally executable as configured.
- GitHub/CI: local repository status was clean. No live GitHub Actions or branch protection checks were mutated or queried from remote.
- Resend: `RESEND_API_KEY` is present locally, `EMAIL_FROM` is absent, and non-production email is dry-run by default unless `EMAIL_DEV_DELIVER=true`.

## Executed Evidence

- `npm test -- --runInBand`: FAIL. 49 passed, 3 failed in `lib/__tests__/opportunity-radar.test.js`.
- `npm run lint`: FAIL. 12 errors across login, appeals new page, status selectors, Input, Modal, Select, Textarea, and home page.
- `npm run db:validate`: PASS. Prisma schema is valid.
- `npm audit --json`: FAIL. 3 vulnerabilities: Next.js high, Axios high, PostCSS moderate.
- Browser routes: `/`, `/login`, `/register`, `/privacy`, `/terms` rendered 200. `/dashboard` redirected to `/login`.
- API negative checks: `/api/auth/me` returned 401 JSON; empty login/register/google POSTs returned 400 JSON; cron endpoints returned 401.
- Protected API behavior: unauthenticated `/api/tenders`, `/api/upload`, and `/api/email/test` returned 307 redirects to `/login`.

## Scenario Set

--- SCENARIO ID: FS-001 ---
TYPE: Functional/Auth
PRIORITY: Critical
PRECONDITIONS: No session cookie.
STEPS TO REPRODUCE: Open `/dashboard`.
EXPECTED RESULT: User is redirected to `/login`.
ACTUAL RESULT: PASS. Browser landed on `/login`.
EVIDENCE: Browser route check.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-002 ---
TYPE: Security/API
PRIORITY: High
PRECONDITIONS: No session cookie.
STEPS TO REPRODUCE: GET `/api/tenders`.
EXPECTED RESULT: JSON 401 for API consumers.
ACTUAL RESULT: FAIL. Proxy returned 307 `/login`.
EVIDENCE: `curl.exe -i http://127.0.0.1:3000/api/tenders`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-003 ---
TYPE: Functional/Auth
PRIORITY: High
PRECONDITIONS: None.
STEPS TO REPRODUCE: POST `{}` to `/api/auth/login`.
EXPECTED RESULT: 400 with required field error.
ACTUAL RESULT: PASS. `{"error":"Email and password are required"}`.
EVIDENCE: API negative check.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-004 ---
TYPE: Security/Auth
PRIORITY: Critical
PRECONDITIONS: Test user exists.
STEPS TO REPRODUCE: Attempt 10 rapid wrong-password login requests.
EXPECTED RESULT: Throttling or lockout after threshold.
ACTUAL RESULT: NOT EXECUTED. Static review found no rate limiter.
EVIDENCE: `app/api/auth/login/route.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-005 ---
TYPE: Functional/Auth
PRIORITY: High
PRECONDITIONS: Existing unverified user.
STEPS TO REPRODUCE: Login before email verification.
EXPECTED RESULT: 403 `EMAIL_NOT_VERIFIED`; resend form shown.
ACTUAL RESULT: NOT EXECUTED. Code path present.
EVIDENCE: `app/api/auth/login/route.js`, login DOM.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-006 ---
TYPE: Functional/Auth
PRIORITY: High
PRECONDITIONS: None.
STEPS TO REPRODUCE: POST `{}` to `/api/auth/google`.
EXPECTED RESULT: 400 invalid intent.
ACTUAL RESULT: PASS.
EVIDENCE: API negative check.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-007 ---
TYPE: Functional/Registration
PRIORITY: High
PRECONDITIONS: Public registration setting as configured.
STEPS TO REPRODUCE: POST `{}` to `/api/auth/register`.
EXPECTED RESULT: 400 required field error.
ACTUAL RESULT: PASS.
EVIDENCE: API negative check.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-008 ---
TYPE: Security/Registration
PRIORITY: High
PRECONDITIONS: Existing email.
STEPS TO REPRODUCE: Register same email twice.
EXPECTED RESULT: Duplicate rejected without leaking sensitive details.
ACTUAL RESULT: NOT EXECUTED. Code returns duplicate email message.
EVIDENCE: `app/api/auth/register/route.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-009 ---
TYPE: Security/Email Verification
PRIORITY: High
PRECONDITIONS: Unknown email address.
STEPS TO REPRODUCE: POST unknown email to `/api/auth/resend-verification`.
EXPECTED RESULT: Generic success, no account enumeration.
ACTUAL RESULT: NOT EXECUTED. Static code returns `{ success: true }`.
EVIDENCE: `app/api/auth/resend-verification/route.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-010 ---
TYPE: Security/Email Verification
PRIORITY: High
PRECONDITIONS: User name contains HTML such as `<img src=x onerror=...>`.
STEPS TO REPRODUCE: Trigger verification email.
EXPECTED RESULT: User-supplied name is escaped in HTML.
ACTUAL RESULT: FAIL BY STATIC REVIEW. `renderVerificationEmail` interpolates `greeting` without escaping.
EVIDENCE: `lib/email-verification.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-011 ---
TYPE: Integration/Session
PRIORITY: High
PRECONDITIONS: Missing `SESSION_SECRET`.
STEPS TO REPRODUCE: Boot app without session secret.
EXPECTED RESULT: Startup fails or warns hard.
ACTUAL RESULT: NOT EXECUTED. Static code uses fixed fallback secret.
EVIDENCE: `lib/session.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-012 ---
TYPE: Security/CSRF
PRIORITY: High
PRECONDITIONS: Authenticated session.
STEPS TO REPRODUCE: Submit cross-site POST/PATCH/DELETE to state-changing endpoints.
EXPECTED RESULT: CSRF token or origin validation blocks request.
ACTUAL RESULT: NOT EXECUTED. Static review found no CSRF token/origin guard.
EVIDENCE: state-changing API routes and `lib/session.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-013 ---
TYPE: Functional/Tenders
PRIORITY: High
PRECONDITIONS: Authenticated user with organization.
STEPS TO REPRODUCE: GET `/api/tenders`.
EXPECTED RESULT: Only user's organization tenders returned.
ACTUAL RESULT: NOT EXECUTED. Static code filters by `organizationId`.
EVIDENCE: `app/api/tenders/route.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-014 ---
TYPE: Security/Tenders
PRIORITY: Critical
PRECONDITIONS: Member role and tender in another organization.
STEPS TO REPRODUCE: PATCH `/api/tenders/:id` for foreign tender.
EXPECTED RESULT: 404.
ACTUAL RESULT: NOT EXECUTED. Static code uses `findTenderForOrganization`.
EVIDENCE: `app/api/tenders/[id]/route.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-015 ---
TYPE: Security/RBAC
PRIORITY: Critical
PRECONDITIONS: Staff role tender in status `New`.
STEPS TO REPRODUCE: PATCH status directly to `Submitted`.
EXPECTED RESULT: 403 insufficient role.
ACTUAL RESULT: NOT EXECUTED. Unit coverage should be expanded to route level.
EVIDENCE: `lib/status-machine.js`, `app/api/tenders/[id]/route.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-016 ---
TYPE: Functional/Contracts
PRIORITY: High
PRECONDITIONS: Authenticated organization user.
STEPS TO REPRODUCE: GET `/api/contracts`.
EXPECTED RESULT: Only organization contracts returned.
ACTUAL RESULT: NOT EXECUTED. Static code filters by `organizationId`.
EVIDENCE: `app/api/contracts/route.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-017 ---
TYPE: Security/Contracts
PRIORITY: Critical
PRECONDITIONS: Staff role.
STEPS TO REPRODUCE: DELETE `/api/contracts/:id`.
EXPECTED RESULT: 403 admin only.
ACTUAL RESULT: NOT EXECUTED. Static code checks `session.role === 'admin'`.
EVIDENCE: `app/api/contracts/[id]/route.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-018 ---
TYPE: Functional/Opportunities
PRIORITY: High
PRECONDITIONS: Authenticated organization user.
STEPS TO REPRODUCE: Create opportunity with duplicate dedupe key.
EXPECTED RESULT: Existing opportunity returned or conflict handled deterministically.
ACTUAL RESULT: NOT EXECUTED. Static code uses `organizationId_dedupeKey` upsert-style lookup.
EVIDENCE: `app/api/opportunities/route.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-019 ---
TYPE: Functional/Appeals
PRIORITY: Medium
PRECONDITIONS: Authenticated organization user.
STEPS TO REPRODUCE: Create appeal linked to tender from another org.
EXPECTED RESULT: Request denied.
ACTUAL RESULT: NOT EXECUTED. Requires route-level test.
EVIDENCE: `app/api/appeals/route.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-020 ---
TYPE: Security/Users
PRIORITY: High
PRECONDITIONS: Authenticated user.
STEPS TO REPRODUCE: GET `/api/users`.
EXPECTED RESULT: Only users in current organization, no password fields.
ACTUAL RESULT: NOT EXECUTED. Static code selects id/name/email/role.
EVIDENCE: `app/api/users/route.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-021 ---
TYPE: Storage/Supabase
PRIORITY: Critical
PRECONDITIONS: Authenticated user, Supabase env configured.
STEPS TO REPRODUCE: Upload oversized file to tender, opportunity, contract, appeal, and vault upload endpoints.
EXPECTED RESULT: File rejected before full memory load.
ACTUAL RESULT: FAIL BY STATIC REVIEW. Routes call `file.arrayBuffer()` with no size checks.
EVIDENCE: `app/api/upload/route.js`, document upload routes.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-022 ---
TYPE: Storage/Supabase
PRIORITY: High
PRECONDITIONS: Authenticated user.
STEPS TO REPRODUCE: Upload executable content with PDF-like filename.
EXPECTED RESULT: MIME and extension allowlist enforced.
ACTUAL RESULT: FAIL BY STATIC REVIEW. Routes trust `file.type || application/octet-stream`.
EVIDENCE: upload routes.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-023 ---
TYPE: Security/Supabase
PRIORITY: High
PRECONDITIONS: Storage bucket missing.
STEPS TO REPRODUCE: Trigger first upload.
EXPECTED RESULT: Private bucket or explicit policy.
ACTUAL RESULT: FAIL BY STATIC REVIEW. `createBucket(..., { public: true })`.
EVIDENCE: `lib/supabase.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-024 ---
TYPE: Storage/Supabase
PRIORITY: High
PRECONDITIONS: Document URL leaked.
STEPS TO REPRODUCE: Open stored `publicUrl` without auth.
EXPECTED RESULT: Private docs require signed URLs.
ACTUAL RESULT: NOT EXECUTED. Static design stores public URLs.
EVIDENCE: `lib/supabase.js`, upload routes.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-025 ---
TYPE: Storage/Delete
PRIORITY: High
PRECONDITIONS: Authenticated user deleting document.
STEPS TO REPRODUCE: DELETE foreign document id.
EXPECTED RESULT: 404 before storage deletion.
ACTUAL RESULT: NOT EXECUTED. Static code usually checks parent ownership first.
EVIDENCE: document `[docId]` routes.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-026 ---
TYPE: Integration/Email
PRIORITY: High
PRECONDITIONS: Non-admin authenticated user.
STEPS TO REPRODUCE: POST `/api/email/test`.
EXPECTED RESULT: 403 admin only.
ACTUAL RESULT: NOT EXECUTED; unauthenticated request was redirected by proxy.
EVIDENCE: `app/api/email/test/route.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-027 ---
TYPE: Integration/Email
PRIORITY: Medium
PRECONDITIONS: Local dev, `EMAIL_DEV_DELIVER` unset.
STEPS TO REPRODUCE: Trigger email send.
EXPECTED RESULT: Dry run, no real delivery.
ACTUAL RESULT: NOT EXECUTED. Static code supports dry-run.
EVIDENCE: `lib/email.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-028 ---
TYPE: Integration/Cron
PRIORITY: Critical
PRECONDITIONS: No Authorization header.
STEPS TO REPRODUCE: GET `/api/crawler`.
EXPECTED RESULT: 401.
ACTUAL RESULT: PASS.
EVIDENCE: API negative check.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-029 ---
TYPE: Security/Crawler
PRIORITY: High
PRECONDITIONS: eTenders page links to unexpected absolute PDF URL.
STEPS TO REPRODUCE: Run crawler against link set containing loopback/private host URL.
EXPECTED RESULT: Host allowlist blocks download.
ACTUAL RESULT: FAIL BY STATIC REVIEW. Any absolute PDF/download URL may be fetched.
EVIDENCE: `lib/crawler/etenders-crawler.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-030 ---
TYPE: Performance/Crawler
PRIORITY: Medium
PRECONDITIONS: Large eTenders result set.
STEPS TO REPRODUCE: Trigger cron in staging.
EXPECTED RESULT: Completes or exits partial before function deadline with cursor.
ACTUAL RESULT: NOT EXECUTED. Static code has `maxDuration=300` and 240s deadline.
EVIDENCE: `app/api/crawler/route.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-031 ---
TYPE: Performance/Web
PRIORITY: Medium
PRECONDITIONS: Cold dev route compile.
STEPS TO REPRODUCE: Open `/`.
EXPECTED RESULT: Local compile acceptable, production should be far faster.
ACTUAL RESULT: WARN. First `/` request took 10.4s in dev.
EVIDENCE: `.codex-qa-dev.out.log`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-032 ---
TYPE: Performance/Web
PRIORITY: Medium
PRECONDITIONS: Warm routes.
STEPS TO REPRODUCE: Request public pages after compile.
EXPECTED RESULT: Subsecond responses.
ACTUAL RESULT: PASS/WARN. `/` 95ms, `/login` 67ms, `/register` 439ms, `/privacy` 100ms, `/terms` 104ms.
EVIDENCE: Node HTTP timing script.
CONTENT DENSITY FLAG: `/privacy` and `/terms` text-heavy total pages.

--- SCENARIO ID: FS-033 ---
TYPE: Performance/Dependency
PRIORITY: High
PRECONDITIONS: Current package lock.
STEPS TO REPRODUCE: Run `npm audit --json`.
EXPECTED RESULT: No high vulnerabilities.
ACTUAL RESULT: FAIL. Direct `next` and `axios` high vulnerabilities.
EVIDENCE: npm audit output.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-034 ---
TYPE: Accessibility
PRIORITY: High
PRECONDITIONS: Mobile viewport 390x844.
STEPS TO REPRODUCE: Open `/register` and inspect accessibility tree.
EXPECTED RESULT: Page has visible/available H1.
ACTUAL RESULT: FAIL/WARN. Mobile tree begins with H2; desktop has H1.
EVIDENCE: Browser responsive snapshot.
CONTENT DENSITY FLAG: Register has high control count.

--- SCENARIO ID: FS-035 ---
TYPE: Accessibility
PRIORITY: Medium
PRECONDITIONS: Keyboard user.
STEPS TO REPRODUCE: Tab from page top.
EXPECTED RESULT: Skip link reaches `#main-content`.
ACTUAL RESULT: PASS BY DOM. Skip link and main target exist.
EVIDENCE: Browser DOM snapshot and `app/layout.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-036 ---
TYPE: Accessibility/Form
PRIORITY: Medium
PRECONDITIONS: Login page.
STEPS TO REPRODUCE: Inspect form controls.
EXPECTED RESULT: Email and password inputs have accessible labels and required state.
ACTUAL RESULT: PASS BY DOM.
EVIDENCE: Browser login snapshot.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-037 ---
TYPE: Accessibility/Live Regions
PRIORITY: Medium
PRECONDITIONS: Toasts rendered.
STEPS TO REPRODUCE: Trigger success and error toasts.
EXPECTED RESULT: Error uses assertive alert; success uses polite status.
ACTUAL RESULT: NOT EXECUTED. Static code supports both regions.
EVIDENCE: `app/components/Toast.js`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-038 ---
TYPE: Accessibility/Modal
PRIORITY: Medium
PRECONDITIONS: Modal opened.
STEPS TO REPRODUCE: Open any confirm modal and press Escape/Tab.
EXPECTED RESULT: Focus trap, escape close, labelled dialog.
ACTUAL RESULT: NOT EXECUTED. Static code has dialog ARIA; lint flags Math.random during render.
EVIDENCE: `app/components/Modal.js`, ESLint output.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-039 ---
TYPE: Responsive/UI
PRIORITY: Medium
PRECONDITIONS: 390, 768, and 1280 px widths.
STEPS TO REPRODUCE: Open `/register`.
EXPECTED RESULT: No overlap; controls remain reachable.
ACTUAL RESULT: PASS/WARN. No obvious overlap in DOM snapshots; high control density persists.
EVIDENCE: Browser responsive snapshots.
CONTENT DENSITY FLAG: Yes, high controls.

--- SCENARIO ID: FS-040 ---
TYPE: UI/Platform
PRIORITY: Medium
PRECONDITIONS: Public pages.
STEPS TO REPRODUCE: Open `/`, `/login`, `/register`, `/privacy`, `/terms`.
EXPECTED RESULT: No console/server warnings.
ACTUAL RESULT: FAIL/WARN. Unsupported `metadata.colorScheme` warning repeated on all routes.
EVIDENCE: browser dev logs and `.codex-qa-dev.err.log`.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-041 ---
TYPE: Quality/Unit Tests
PRIORITY: High
PRECONDITIONS: Current branch.
STEPS TO REPRODUCE: Run `npm test -- --runInBand`.
EXPECTED RESULT: All suites pass.
ACTUAL RESULT: FAIL. 3 opportunity-radar tests fail.
EVIDENCE: Jest output.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-042 ---
TYPE: Quality/Lint
PRIORITY: High
PRECONDITIONS: Current branch.
STEPS TO REPRODUCE: Run `npm run lint`.
EXPECTED RESULT: No lint errors.
ACTUAL RESULT: FAIL. 12 errors.
EVIDENCE: ESLint output.
CONTENT DENSITY FLAG: No.

--- SCENARIO ID: FS-043 ---
TYPE: Content Density
PRIORITY: Low
PRECONDITIONS: Public route.
STEPS TO REPRODUCE: Analyze `/privacy` and `/terms`.
EXPECTED RESULT: Legal text is scannable and below above-fold threshold.
ACTUAL RESULT: PASS/WARN. Total words >850 each, but above-fold threshold not observed as exceeded.
EVIDENCE: density script and browser snapshots.
CONTENT DENSITY FLAG: Yes, total page text-heavy.

--- SCENARIO ID: FS-044 ---
TYPE: Content Density
PRIORITY: Medium
PRECONDITIONS: Registration route.
STEPS TO REPRODUCE: Analyze `/register`.
EXPECTED RESULT: Signup choices are comprehensible without excessive competing controls.
ACTUAL RESULT: WARN. 29 buttons and 6 inputs; cognitive load score 6/10.
EVIDENCE: density script and responsive snapshots.
CONTENT DENSITY FLAG: Yes, control density.

## Content Density Audit

PAGE: `/`
MEASUREMENT DATE: 2026-05-10T16:36:31+02:00
TEXT DENSITY METRICS: total words 310, paragraphs 18, headings 18, buttons 0, inputs 0.
IMAGE DENSITY METRICS: total image count 0, above-fold images 0, lazy loading N/A.
OVERALL DENSITY SCORE: 3/10.
REMOVAL CANDIDATES IDENTIFIED: 0.
REMOVAL TIMING: POST-TEST ONLY.

PAGE: `/register`
MEASUREMENT DATE: 2026-05-10T16:36:31+02:00
TEXT DENSITY METRICS: total words 256, paragraphs 26, headings 7, buttons 29, inputs 6.
IMAGE DENSITY METRICS: total image count 0, above-fold images 0, lazy loading N/A.
OVERALL DENSITY SCORE: 6/10 due to many selection controls.
REMOVAL CANDIDATES IDENTIFIED: 0. Consider progressive disclosure only after conversion testing.
REMOVAL TIMING: POST-TEST ONLY.

PAGE: `/privacy`
MEASUREMENT DATE: 2026-05-10T16:36:31+02:00
TEXT DENSITY METRICS: total words 858, paragraphs 36, H1 1, H2 13. Above-fold word count estimated below 500 based on browser viewport inspection.
IMAGE DENSITY METRICS: total image count 0, above-fold images 0, lazy loading N/A.
OVERALL DENSITY SCORE: 5/10. Legal copy is long but expected.
REMOVAL CANDIDATES IDENTIFIED: 0. Use anchors or summary accordions only after legal review.
REMOVAL TIMING: POST-TEST ONLY.

PAGE: `/terms`
MEASUREMENT DATE: 2026-05-10T16:36:31+02:00
TEXT DENSITY METRICS: total words 865, paragraphs 29, H1 1, H2 13. Above-fold word count estimated below 500 based on browser viewport inspection.
IMAGE DENSITY METRICS: total image count 0, above-fold images 0, lazy loading N/A.
OVERALL DENSITY SCORE: 5/10. Legal copy is long but expected.
REMOVAL CANDIDATES IDENTIFIED: 0. Use anchors or summary accordions only after legal review.
REMOVAL TIMING: POST-TEST ONLY.

## Risk Assessment Matrix

| Risk | Severity | Likelihood | Impact | Evidence | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Dependency vulnerabilities in Next.js and Axios | High | High | DoS, request hijack, SSRF-adjacent risk | `npm audit` | Upgrade Next to at least 16.2.6 and Axios beyond 1.15.2; rerun audit. |
| Upload routes lack file size/MIME controls | High | Medium | Memory exhaustion, malware/content abuse | Upload route static review | Add max size checks before buffering, MIME allowlists, extension checks, and scanning pipeline. |
| Public Supabase bucket for tender/compliance documents | High | Medium | Sensitive document disclosure if URLs leak | `lib/supabase.js` | Use private bucket and signed URLs; avoid storing permanent public URLs. |
| Verification email HTML injection | High | Medium | Malicious markup in outbound email | `lib/email-verification.js` | Escape user name and URL in HTML template. |
| Auth/rate-limit missing | High | High | Brute force and email resend abuse | Auth route static review | Add IP/user/email throttling for login, register, resend, Google auth. |
| Crawler downloads untrusted absolute PDF links | High | Medium | SSRF/egress abuse, large downloads | `lib/crawler/etenders-crawler.js` | Restrict hosts to eTenders allowlist and reject private/link-local IPs after DNS resolution. |
| API proxy returns redirects instead of JSON 401 | Medium | High | API client breakage, confusing tests | Curl evidence | Exclude `/api/*` from page redirect proxy and let routes return JSON 401. |
| Mobile register lacks H1 in accessibility tree | Medium | Medium | Screen reader page orientation issue | Browser mobile snapshot | Keep a semantic H1 available on mobile, even if visually styled differently. |
| Quality gates fail | High | High | CI/deploy confidence reduced | Jest/ESLint evidence | Fix failing tests and lint errors before release. |
| Test/debug endpoints exist | Medium | Medium | Internal data/error leakage in non-production | `app/api/test-db`, `app/api/test-dashboard` | Remove or admin-gate tightly; never connect preview to production data with these enabled. |

## Prioritized Post-Test Actions

1. Fix dependency audit issues: upgrade Next.js and Axios, then rerun audit, tests, and lint.
2. Fix the three failing opportunity radar tests or adjust implementation/expectations deliberately.
3. Clear lint failures, especially React purity issues in reusable form/modal components.
4. Add rate limiting and brute-force protection to login, register, Google auth, and verification resend.
5. Make document storage private, enforce signed URL access, and add file size/type validation before buffering uploads.
6. Escape all user-derived values in verification email HTML.
7. Add crawler URL allowlisting for PDF downloads and block private IP ranges after DNS resolution.
8. Change unauthenticated API behavior from proxy-level 307 redirects to route-level JSON 401s.
9. Restore mobile H1 semantics on auth pages.
10. Add route-level integration tests for org scoping, RBAC transitions, file upload rejections, cron auth, and email dry-run.

## Content Modification Proposal

UNAPPROVED - REQUIRES AUTHORIZATION.

No content removal is recommended yet. Public pages did not exceed the formal trigger of more than 500 words above the fold or more than 5 above-fold images. Suggested A/B tests only:

- `/register`: compare current all-options-visible flow with a two-step progressive disclosure version.
- `/privacy` and `/terms`: compare full legal pages with sticky table-of-contents anchors.
- Measure signup completion, scroll depth, first interaction time, and support/legal comprehension before altering copy.

