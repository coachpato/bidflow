# Workflow Slice Playbook

This playbook executes the page-by-page rollout without interrupting live workflows.

## 1) Baseline Before Any Slice

Run:

```bash
npm run rollout:gate
```

Expected:
- `rollout/workflow-inventory.json` is refreshed.
- Critical routes/pages for all workflows exist.

## 2) Slice Execution Order

Use this order and do not skip ahead:

1. Auth and entry surfaces
2. Dashboard and navigation
3. Opportunities
4. Pursuits and tenders
5. Contracts
6. Appeals
7. Firm/settings and ancillary pages

## 3) Required Checks Per Slice

For each slice PR:

1. **Compatibility check**
   - Keep old status names/aliases valid via `lib/status-compat.js`.
   - Ensure status transition validation still accepts legacy names via `lib/status-machine.js`.
2. **Side-effect safety**
   - Confirm outbound webhooks are controlled by `ENABLE_OUTBOUND_WEBHOOKS=true`.
   - Do not enable side effects in local smoke runs.
3. **Regression gate**
   - Run `npm run rollout:gate`.
   - Run `npm run lint`.
4. **Manual smoke checks**
   - Login/register flow and dashboard redirect.
   - Slice-specific CRUD/status transitions.
   - Conversion paths into downstream workflow.

## 4) Cleanup Rules (Final PR)

Only after all slice PRs pass:

1. Remove obsolete status aliases from `lib/status-compat.js`.
2. Keep canonical status labels in data + UI.
3. Refresh inventory and gate:

```bash
npm run rollout:gate
```

4. Re-run full smoke checklist (`TESTING_CHECKLIST.md`).
