# Bid360 Pre-Launch Verification

Updated: 2026-05-12

## Automated Gates

Run locally after the remediation pass:

| Gate | Result |
| --- | --- |
| `npm audit --json` | 0 total vulnerabilities, 0 high, 0 critical |
| `npm run lint` | Pass |
| `npm test -- --runInBand` | Pass, 66 tests |
| `npm run build` | Pass |

The same sequence is configured in `.github/workflows/prelaunch-gate.yml` for pull requests and pushes to `main`.

## Route And Browser Checks

Local production server: `npm run start -- -p 3010`

| Check | Result |
| --- | --- |
| `/register` semantic heading | One `<h1>` in the accessible form panel: `Create your Bid360 account` |
| Browser console on `/register` | No warnings or errors captured |
| Unauthenticated `/api/tenders` | JSON 401 from proxy |
| Diagnostic endpoints | Production route handlers return 404; non-production handlers require admin session |

## Performance Baseline

Measured against the local production build on `http://localhost:3010`.

| Route | Warm samples, seconds | Notes |
| --- | --- | --- |
| `/` | 0.046, 0.032, 0.040 | Under 1s warmed |
| `/login` | 0.046, 0.018, 0.017 | Under 500ms |
| `/register` | 1.142, 0.984, 1.075 | Exceeds 500ms due to bootstrap user-existence DB query |
| `/privacy` | 0.022, 0.010, 0.012 | Under 500ms |
| `/terms` | 0.019, 0.010, 0.009 | Under 500ms |
| `/api/tenders` | 0.009, 0.006, 0.007 | Unauthenticated JSON 401, under 500ms |

## External Launch Items

These require access to Supabase, Vercel, or Resend dashboards and were not mutated by the local remediation pass:

| Item | Required before production launch |
| --- | --- |
| Supabase storage | Confirm existing document bucket is private in the Supabase dashboard |
| Vercel env parity | Confirm production and preview contain `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `SESSION_SECRET`, `EMAIL_FROM`, and `CRON_SECRET` |
| Resend sender | Set `EMAIL_FROM` to a verified domain sender and confirm the domain is verified |
| Local env placeholders | `.env.local` has the required keys, but `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `EMAIL_FROM` still need real local values |

Do not deploy to production until every external item above is confirmed.
