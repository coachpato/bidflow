# Bid360 Crawler Resilience Overhaul — Agent Prompt

## Your Mission
You are implementing the Bid360 Crawler Resilience Overhaul on a live Next.js/Prisma
project hosted on Vercel Hobby plan. A failed crawl run means 24 hours of missed
tenders for real users. Your job is to make every run maximally reliable.

The full implementation plan is in `bid360-crawler-resilience-plan.md`. Read it
completely before writing a single line of code.

---

## Before You Write Any Code

1. **Read the plan end-to-end.** Understand all phases and their dependencies before
   starting Phase 0.

2. **Map the existing codebase.** Find and document:
   - The crawl entry point (likely `lib/crawler.ts` or an API route)
   - Where opportunities are currently written to the DB
   - Where errors are currently caught (or not)
   - The current `SourceRun` model in `prisma/schema.prisma`
   - Where the daily cron is defined
   - Where notifications/digest are sent
   Report this mapping before proceeding.

3. **Identify what already exists.** Some tasks in the plan may already be partially
   implemented. Note what's present, what's missing, and any conflicts with the plan.
   Do not rewrite working code unnecessarily.

---

## How to Work Through Each Phase

### For each task:
1. State which file(s) you're modifying and why
2. Show the diff or full new file — never describe changes without showing code
3. Write the test file alongside the implementation file (not after)
4. Run the tests mentally (or actually if you have a test runner available) and
   report results
5. Note any assumptions you made about existing code

### Approval gates (Phases 2, 3, 4, 5):
Before implementing any approval-required phase:
- Write a summary of the changes you're about to make
- Explain any risks or irreversible steps
- Wait for explicit approval before proceeding
- "I think this is fine" is not approval — state clearly "requesting approval to proceed"

---

## Hard Rules

**Never do these:**
- Modify existing opportunity matching logic (zero tolerance)
- Change organization or dedupe logic (only the write path)
- Write a test file that doesn't actually test behaviour (no empty `it('works')`)
- Swallow errors silently — every catch block must classify and log
- Use module-level mutable state for anything that must reset per-run
- Skip the cursor validation step on resume — it exists to prevent silent data corruption
- Mark a run `completed` before crawl data is written (notification happens after)
- Proceed past an approval gate without explicit sign-off

**Always do these:**
- Use the structured logger (from Task 0.1) for every log statement
- Pass dependencies (DB client, HTTP client, diagnostics collector) via parameters,
  not imports of singletons
- Add a JSDoc comment above any function whose "why" is not obvious from its name
- Check time budget before each page fetch, not just at phase boundaries
- Write TypeScript strict — no `any`, no non-null assertions without a comment

---

## Handling Ambiguity

When you encounter something the plan doesn't specify:

1. **Lean toward safety over completeness.** If unsure whether to write a tender
   or skip it, skip it and dead-letter it. Bad data in the DB is worse than
   missing data.

2. **Lean toward preserving existing behaviour.** If the current code does something
   in a way the plan doesn't address, keep it unless the plan explicitly changes it.

3. **Surface it explicitly.** Don't silently make a decision that changes behaviour.
   State "The plan doesn't specify X; I'm doing Y because Z. Please correct me if wrong."

---

## Deliverables Per Phase

After completing each phase, provide:

```
## Phase N Complete

### Files Changed
- `path/to/file.ts` — what changed and why
- `path/to/file.test.ts` — new test file

### Test Results
[List each test and whether it passes]

### Schema Changes (if any)
[Migration SQL or Prisma diff]

### Known Limitations / Follow-ups
[Anything deferred or not fully addressed]

### Requesting Approval (if approval-required phase)
[Summary of risks and irreversible steps]
```

---

## The Definition of Done

The overhaul is complete when:
- [ ] All 12 integration test scenarios in Task 6.2 pass
- [ ] No hard Vercel timeouts are possible (budget manager always exits cleanly)
- [ ] Zero duplicate opportunities possible (upsert + unique constraint)
- [ ] Every terminal run has `diagnostics IS NOT NULL`
- [ ] Structural changes are detected before any DB write occurs
- [ ] A killed run resumes correctly on next invocation
- [ ] Notification failure does not change run status
- [ ] Dead-lettered tenders are queryable and have a resolution path
- [ ] All existing tests still pass
- [ ] `prisma/schema.prisma` has a valid migration with up and down scripts

---

Begin with the codebase mapping step. Do not write any implementation code until
that mapping is reported.
