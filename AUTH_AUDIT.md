# Auth & Settings Audit — 2026-05-01

## Summary

- Auth strategy: Bid360 uses custom application auth, not NextAuth or Supabase Auth. Email/password login is backed by Prisma `User` records and bcrypt password hashes, while Google sign-in uses Google Identity Services in the browser and verifies the returned ID token server-side with `google-auth-library`. Server sessions are encrypted/signed `iron-session` cookies named `bidflow_session`; session state stores the user id, global user role, and selected organization context. Supabase is used with a server-side service-role client for storage/file operations, not for authentication.
- Critical findings:
  - Public registration can be privilege-escalated: `/api/auth/register` and `/api/auth/google` accept a client-supplied `role` and assign it when the database already has users (`app/api/auth/register/route.js:75-83`, `app/api/auth/google/route.js:294-305`).
  - Public self-signup creates new workspace founders as global `member` users after the first-ever account, so they cannot access admin-only settings even though they own the new workspace (`app/api/auth/register/route.js:67-76`, `app/(dashboard)/settings/page.js:16-21`).
  - Settings exists, but it is not in the shared navigation at all (`app/components/Sidebar.js:7-68`, `app/components/TopNav.js:42-67`, `app/(dashboard)/settings/page.js:50-80`).
  - The dashboard layout can redirect an incomplete admin to `/settings`, but `/settings` is inside the same layout, so an incomplete admin may self-redirect instead of rendering the setup page (`app/(dashboard)/layout.js:10-16`).
  - There is no first-party email verification infrastructure: no `User.emailVerified`, no verification token model, no verify route, and no verification email.
- Why my logged-in user can't see settings: most likely either the session `role` is not exactly `admin`, or the nav never exposes settings. In the current code, `/settings` is admin-only (`app/(dashboard)/settings/page.js:19-20`) and the nav array has no Settings item (`app/components/Sidebar.js:7-68`). If the user registered publicly after at least one user already existed, the server likely assigned `role: "member"` by default (`app/api/auth/register/route.js:67-76`), which would redirect `/settings` back to `/dashboard`.

## 1. Authentication

### Entry points

| Entry point | Purpose | Notes |
| --- | --- | --- |
| `/login` | Login UI | Client component posts email/password to `/api/auth/login`; Google button posts GIS credential to `/api/auth/google` with `intent: "login"` (`app/(auth)/login/page.js:24-56`, `app/(auth)/login/page.js:80-85`, `app/(auth)/login/page.js:93-144`). |
| `/register` | Registration UI | Server page checks `prisma.user.count()` and `ALLOW_PUBLIC_REGISTRATION`; renders the form only in bootstrap mode or public-registration mode (`app/(auth)/register/page.js:23-58`). |
| `/api/auth/login` | Email/password login | Looks up normalized email, bcrypt-compares password, ensures organization context, saves iron-session (`app/api/auth/login/route.js:7-70`). |
| `/api/auth/register` | Email/password registration | Creates user, org context, session; public gate is based on user count plus `ALLOW_PUBLIC_REGISTRATION` (`app/api/auth/register/route.js:9-111`). |
| `/api/auth/google` | GIS login/register/invite endpoint | Verifies Google ID token, handles existing user, registration, and invite acceptance (`app/api/auth/google/route.js:201-398`). |
| `/api/auth/me` | Current user endpoint | Returns session user; if org info is already in session it does not hit the DB for firm profile (`app/api/auth/me/route.js:10-55`). |
| `/api/auth/logout` | Logout endpoint | Destroys the iron-session cookie (`app/api/auth/logout/route.js:3-6`). |
| `proxy.js` | Broad route gate | Allows public paths, then only checks for presence of `bidflow_session`; full session validation happens later in server code (`proxy.js:3-34`). |

### Email/password login flow

1. User submits `/login` form with `email` and `password` (`app/(auth)/login/page.js:33-42`).
2. `/api/auth/login` normalizes email and checks required fields (`app/api/auth/login/route.js:9-15`).
3. The route fetches a `User` by email, including the first membership and its organization/firm profile (`app/api/auth/login/route.js:17-35`).
4. It bcrypt-compares the submitted password. It also tries a trimmed retry for pasted passwords with extra spaces (`app/api/auth/login/route.js:41-53`).
5. It calls `ensureOrganizationContextForUser(user)` (`app/api/auth/login/route.js:56`). If the user has no membership, this function creates an organization, membership, and firm profile (`lib/organization.js:161-224`).
6. It writes session fields: `userId`, `name`, `email`, `role`, `organizationId`, `organizationName`, `organizationRole`, then calls `session.save()` (`app/api/auth/login/route.js:58-65`, `lib/organization.js:105-109`).
7. Client redirects to `next` query param or `/dashboard` (`app/(auth)/login/page.js:31`, `app/(auth)/login/page.js:52`).

### Session mechanism

- The session library is `iron-session` (`package.json`, dependency; `lib/session.js:1`).
- Cookie name: `bidflow_session` (`lib/session.js:24-31`).
- Cookie options: `httpOnly: true`, `sameSite: "lax"`, and `secure` only when production `APP_URL` resolves to HTTPS (`lib/session.js:6-31`).
- `SESSION_SECRET` is used as the iron-session password. If absent, the app falls back to a hard-coded default secret (`lib/session.js:24-25`). Production must not rely on this fallback.
- `requireAuth()` checks only `session.userId` and redirects to `/login` if absent (`lib/session.js:40-48`).
- Subsequent server pages/API routes generally call `getSession()` or `requireAuth()` and then trust session fields (`lib/session.js:34-48`).
- `proxy.js` is not a complete session validator. It only checks that the cookie exists (`proxy.js:29-34`); tampered/expired cookies are handled by later server code.

### Session validation and stale state

- The session stores authorization-critical data (`session.role`, `session.organizationId`, `session.organizationRole`) at login/registration time (`app/api/auth/login/route.js:59-65`, `app/api/auth/register/route.js:100-106`, `app/api/auth/google/route.js:390-396`).
- Most role gates trust `session.role` rather than querying the current user record.
- `/api/auth/me` can return a user payload directly from session when `organizationId`, `organizationName`, and `organizationRole` are present (`app/api/auth/me/route.js:16-40`).
- Impact: role changes, disabled users, deleted users, or organization-membership changes may not take effect until the session is refreshed/destroyed unless a route explicitly re-resolves context.

### Hijacking, CSRF, replay controls

- Positive controls:
  - `iron-session` encrypts/signs cookie contents with `SESSION_SECRET` (`lib/session.js:24-37`).
  - Session cookie is `httpOnly`, reducing script access (`lib/session.js:27-30`).
  - `sameSite: "lax"` provides baseline CSRF mitigation for many cross-site POST cases (`lib/session.js:27-31`).
  - In production HTTPS, cookie `secure` should be true if `APP_URL` is HTTPS (`lib/session.js:6-31`).
  - Google ID token verification checks server-side audience (`lib/google-auth.js:49-57`).
- Gaps:
  - No CSRF tokens or origin checks on state-changing POST/PATCH/DELETE routes were found.
  - No rate limiting, account lockout, IP throttling, or login attempt audit was found for `/api/auth/login`.
  - No explicit session max age is configured in app code (`lib/session.js:24-31`).
  - Session revocation is not modeled server-side; the app trusts the cookie until destroyed/expired.
  - `/api/auth/register` allows client-selected role during public registration; this is a direct privilege-escalation risk (`app/api/auth/register/route.js:75-83`).

### Registration flow

The actual signup form asks for:

- Organization name (`app/(auth)/register/RegisterForm.js:188-197`).
- Sector (`serviceSector`) (`app/(auth)/register/RegisterForm.js:200-219`).
- Practice areas (`app/(auth)/register/RegisterForm.js:232-242`).
- Target work types (`app/(auth)/register/RegisterForm.js:244-253`).
- Target provinces, optional (`app/(auth)/register/RegisterForm.js:255-264`).
- Preferred entities, optional text parsed by comma/newline (`app/(auth)/register/RegisterForm.js:19-24`, `app/(auth)/register/RegisterForm.js:266-278`).
- Full name, email, password, confirm password (`app/(auth)/register/RegisterForm.js:282-339`).

Client-side validation requires org name, sector, at least one practice area, at least one target work type, and for email/password registration also name, email, password length >= 6, and matching confirm password (`app/(auth)/register/RegisterForm.js:26-64`, `app/(auth)/register/RegisterForm.js:114-122`).

Server-side registration validation:

- Normalizes email/name/org/sector and list fields (`app/api/auth/register/route.js:11-38`).
- Requires name, email, password, organization name, sector (`app/api/auth/register/route.js:40-43`).
- Requires at least one practice area and target work type (`app/api/auth/register/route.js:45-51`).
- Requires password length >= 6 (`app/api/auth/register/route.js:53-55`).
- Checks duplicate email (`app/api/auth/register/route.js:57-65`).
- Checks `ALLOW_PUBLIC_REGISTRATION` only after duplicate-email check and only when `userCount > 0` (`app/api/auth/register/route.js:67-70`).

Success behavior:

- Creates `User` first (`app/api/auth/register/route.js:72-85`).
- Calls `ensureOrganizationContextForUser(..., options)` which creates `Organization`, `Membership`, and `FirmProfile` when no membership exists (`app/api/auth/register/route.js:87-97`, `lib/organization.js:184-220`).
- Auto-logs-in the new user immediately (`app/api/auth/register/route.js:99-106`).
- Returns an auth user payload (`app/api/auth/register/route.js:108-111`).

Important registration findings:

- The first-ever user becomes global `admin`; every later public signup defaults to `member` unless the request body includes `role` (`app/api/auth/register/route.js:67-76`).
- The UI does not send `role`, but the API accepts it. A crafted request can likely create an `admin` when public registration is enabled (`app/api/auth/register/route.js:75-83`).
- A later public signup creates a separate organization for the user, but because the user is `member`, they cannot access `/settings` or save firm settings (`app/(dashboard)/settings/page.js:19-20`, `app/api/firm/route.js:62-66`).
- Newly created organizations do not get `setupCompletedAt` during registration. It is set only by `PUT /api/firm` (`lib/organization.js:185-216`, `app/api/firm/route.js:82-88`).

### Google sign-in flow

Client:

- `GoogleAuthButton` loads GIS from `https://accounts.google.com/gsi/client` and uses `ux_mode: "popup"` (`app/components/GoogleAuthButton.js:6-8`, `app/components/GoogleAuthButton.js:87-101`).
- The GIS callback POSTs `intent`, `credential`, and extra payload to `/api/auth/google` (`app/components/GoogleAuthButton.js:49-69`).

Server verification:

- `verifyGoogleIdToken()` verifies the ID token with `google-auth-library` and checks `audience` against `GOOGLE_CLIENT_ID` or `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (`lib/google-auth.js:5-24`, `lib/google-auth.js:49-57`).
- Normalized profile includes `googleSubject`, email, `emailVerified`, name, avatar URL (`lib/google-auth.js:27-46`).
- `/api/auth/google` rejects unverified Google emails (`app/api/auth/google/route.js:225-229`).

Existing-user login:

- Finds by `googleSubject` or email (`app/api/auth/google/route.js:170-191`).
- If login intent has no user and no invite, returns 404 with "No Bid360 account exists..." (`app/api/auth/google/route.js:246-248`).
- If email matches an existing password user with no `googleSubject`, the route links Google by updating `googleSubject`, avatar, and possibly name (`app/api/auth/google/route.js:349-376`).
- It then resolves organization context, writes session, and returns success (`app/api/auth/google/route.js:379-398`).

Registration with Google:

- Requires same workspace/radar fields as email registration except name/email/password are taken from Google/profile (`app/api/auth/google/route.js:154-168`, `app/api/auth/google/route.js:277-287`).
- Uses public-registration gate like email registration (`app/api/auth/google/route.js:289-292`).
- Creates a random password for Google-created users (`app/api/auth/google/route.js:294-305`).
- Creates organization context and logs in (`app/api/auth/google/route.js:322-342`).
- Like email registration, it accepts client-provided `role` for non-first users (`app/api/auth/google/route.js:207-218`, `app/api/auth/google/route.js:294-305`).

Google invitations:

- Invite token comes from `/login?invite=...` (`app/(auth)/login/page.js:30`, `app/(auth)/login/page.js:74-85`).
- Invite resolution checks token exists, status is pending, and not expired (`app/api/auth/google/route.js:46-68`).
- Invite acceptance requires the Google email to match the invite email (`app/api/auth/google/route.js:71-77`).
- It creates/updates the membership, updates invite status to accepted, and may raise the user's global role to match a higher invite role (`app/api/auth/google/route.js:79-151`).

Provider distinction:

- There is no `provider` enum/table.
- Google-linked users are distinguished by `User.googleSubject` and optional `avatarUrl` (`prisma/schema.prisma:18-19`).
- Google-only users still have a required `password` field filled with a random bcrypt hash (`app/api/auth/google/route.js:250-262`, `app/api/auth/google/route.js:294-305`).
- Google verified-email status is checked at login/register but not stored in the local `User` model.

## 2. User and Organization Model

### Prisma model summary

`User` (`prisma/schema.prisma:13-36`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `Int @id @default(autoincrement())` | Primary key. |
| `name` | `String` | Required. |
| `email` | `String @unique` | Required unique login identifier. |
| `password` | `String` | Required hash; also populated for Google-created users. |
| `googleSubject` | `String? @unique` | Google account subject link. |
| `avatarUrl` | `String?` | Google profile picture. |
| `role` | `String @default("member")` | Global role string. No enum constraint. Used for most gates. |
| `createdAt` | `DateTime @default(now())` | Creation timestamp. |
| relations | many | Memberships, tenders, assigned tenders/contracts, status changes, opportunities, activity, notifications, compliance uploads, disliked opportunities, sent invites. |

`Organization` (`prisma/schema.prisma:38-61`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `Int @id @default(autoincrement())` | Primary key. |
| `name` | `String` | Workspace/firm name. |
| `slug` | `String @unique` | Created as `${slugBase}-${user.id}` for new orgs (`lib/organization.js:184-189`). |
| `createdAt`, `updatedAt` | `DateTime` | Timestamps. |
| `setupCompletedAt` | `DateTime?` | Used by dashboard layout setup gate (`lib/organization.js:111-123`). |
| relations | many | Memberships, firm profile, people, experience, compliance docs, opportunities, tenders, contracts, appeals, notifications, webhooks, invites. |

`Membership` (`prisma/schema.prisma:63-74`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `Int @id @default(autoincrement())` | Primary key. |
| `role` | `String @default("member")` | Organization role string. No enum constraint. |
| `organizationId`, `userId` | `Int` | Required relation fields, cascade delete. |
| unique | `@@unique([organizationId, userId])` | One membership per user per organization. |

`FirmProfile` (`prisma/schema.prisma:76-100`) stores editable firm settings: display name, primary/legacy `serviceSector`, multi-sector `serviceSectors`, legal/contact fields, overview, practice areas, preferred entities, target work types/provinces, value band, and one-to-one `organizationId`.

`TeamInvite` (`prisma/schema.prisma:526-544`) stores invite email/name/role/token/status/expiry/acceptedAt/invitedBy/organization. This is the only token model in the schema.

There are no Prisma role enums. Roles are plain strings spread across `User.role` and `Membership.role`.

### Role vocabulary in code

- Global user roles: `admin`, `manager`, `member`, and older/utility references to `staff`/`user`.
- Status machine numeric roles are `STAFF: 0`, `MANAGER: 1`, `ADMIN: 2` (`lib/status-machine.js:17-27`).
- `roleStringToValue()` maps `admin -> ADMIN`, `manager -> MANAGER`, `staff/user -> STAFF`, and all unknown roles to `STAFF` (`lib/roles.js:13-31`).
- It does not map `member`, so `member` becomes `STAFF` by default (`lib/roles.js:20-30`).
- Organization membership role normalization maps global `admin` to membership `owner`, otherwise preserves the role (`lib/organization.js:60-64`).
- Team invites allow only `manager` or `member` (`app/api/settings/invites/route.js:15-17`).

### Places roles/permissions are checked

Page/layout gates:

- Dashboard setup redirect for incomplete admins (`app/(dashboard)/layout.js:14-15`).
- Settings page is global-admin only (`app/(dashboard)/settings/page.js:16-21`).
- Firm page redirects admins to settings, letting non-admins view the firm workspace UI (`app/(dashboard)/firm/page.js:24-29`).
- Launch interest page is global-admin only (`app/(dashboard)/launch-interest/page.js:14-18`).

API admin gates:

- `PUT /api/firm` requires `session.role === "admin"` (`app/api/firm/route.js:62-66`).
- `GET/POST /api/settings/invites` require admin (`app/api/settings/invites/route.js:50-53`, `app/api/settings/invites/route.js:66-72`).
- `POST /api/email/test` requires admin (`app/api/email/test/route.js:21-30`).
- `GET /api/pilot-leads` requires admin (`app/api/pilot-leads/route.js:10-14`).
- `DELETE /api/tenders/[id]` and `DELETE /api/contracts/[id]` require admin (`app/api/tenders/[id]/route.js:242-247`, `app/api/contracts/[id]/route.js:284-289`).
- Reminder endpoints allow `CRON_SECRET`, otherwise require admin session (`app/api/contracts/reminders/route.js:22-33`, `app/api/pursuits/reminders/route.js:8-19`, `app/api/appeals/reminders/route.js:20-31`).
- Mock feed attempts an admin/first-user exception, but references a non-existent Prisma relation `organizationRoles` (`app/api/opportunities/mock-feed/route.js:133-145`).

Status-transition RBAC:

- Tender status transitions validate numeric role and return 403 on insufficient role (`app/api/tenders/[id]/route.js:122-146`, `lib/status-machine.js:221-275`).
- Contract appointment/instruction transitions validate numeric role (`app/api/contracts/[id]/route.js:119-169`, `lib/status-machine.js:284-395`).
- Appeal creation can mark a linked tender lost and validates the tender transition first (`app/api/appeals/route.js:178-219`).
- Client-side status selectors can disable transitions based on `userRole`, but no usage of these selectors was found in the app pages during this pass (`app/components/TenderStatusSelector.js:15-69`, `app/components/ContractStatusSelector.js:14-139`).

Reusable but unused:

- `lib/api-handler.js` has `withAuth`, `withOrgContext`, and `withRoleCheck`, but no import/use sites were found (`lib/api-handler.js:17-140`).

### User -> organization linkage

At signup:

- `ensureOrganizationContextForUser` creates an organization, membership, and firm profile if the user has no membership (`lib/organization.js:161-224`).
- Membership role is `owner` only if global user role is `admin`; otherwise it mirrors the user role (`lib/organization.js:60-64`, `lib/organization.js:192-197`).

At Google sign-in:

- Invite path creates/updates membership in the invited organization and marks the invite accepted (`app/api/auth/google/route.js:79-140`).
- Non-invite path calls `ensureOrganizationContextForUser`; for existing users with no membership this can create a new default org (`app/api/auth/google/route.js:379-388`, `lib/organization.js:161-224`).

At session validation:

- Login/register/google store `organizationId`, `organizationName`, and `organizationRole` in the session (`lib/organization.js:105-109`).
- `getOrganizationContextFromSession` uses `session.organizationId` to fetch cached org profile, or creates/repairs context if missing (`lib/organization.js:129-159`).
- Many API routes then scope queries by `getSessionOrganizationId(session)` (`lib/organization.js:125-127`).

Small relationship diagram:

```text
User (global role string)
  1..* Membership (organization role string)
        *..1 Organization
              1..1 FirmProfile
              1..* TeamInvite / Tender / Contract / Appeal / Opportunity / Notification
```

## 3. Settings

### Settings-related files

| File | Role | Notes |
| --- | --- | --- |
| `app/(dashboard)/settings/page.js` | Page | The only settings page found. Route is `/settings` because `(dashboard)` is a route group. |
| `app/settings/TeamInviteManager.js` | Client component | Used by settings page for team invites. Not a route. |
| `app/api/settings/invites/route.js` | API | Admin-only invite listing/creation and invite email send. |
| `app/(dashboard)/firm/FirmProfileForm.js` | Shared settings form | Embedded in settings for admins and firm page for non-admins, but save API is admin-only. |
| `app/api/firm/route.js` | API | GET firm context for any signed-in user; PUT admin-only firm profile update. |

### Settings page behavior

- Requires login via `requireAuth()` (`app/(dashboard)/settings/page.js:16-18`).
- Redirects any non-admin to `/dashboard` (`app/(dashboard)/settings/page.js:19-20`).
- Loads organization context from session (`app/(dashboard)/settings/page.js:23-24`).
- Loads memberships and pending invites for the current organization (`app/(dashboard)/settings/page.js:26-48`).
- Renders:
  - Header meta: firm, sectors, member count, pending invites (`app/(dashboard)/settings/page.js:50-62`).
  - Firm profile editor (`app/(dashboard)/settings/page.js:64-77`).
  - Team invite manager (`app/(dashboard)/settings/page.js:79`).

### What settings can edit

Firm profile editor (`app/(dashboard)/firm/FirmProfileForm.js`) supports:

- Sector focus: multi-select `serviceSectors`, first sector saved as primary `serviceSector` (`app/(dashboard)/firm/FirmProfileForm.js:14-33`, `app/(dashboard)/firm/FirmProfileForm.js:58-65`, `app/(dashboard)/firm/FirmProfileForm.js:72-80`, `app/(dashboard)/firm/FirmProfileForm.js:105-132`).
- Display/legal/contact/website fields (`app/(dashboard)/firm/FirmProfileForm.js:37-45`, `app/(dashboard)/firm/FirmProfileForm.js:134-143`).
- Practice areas, preferred entities, target work types/provinces (`app/(dashboard)/firm/FirmProfileForm.js:146-186`).
- Minimum/maximum contract value (`app/(dashboard)/firm/FirmProfileForm.js:187-210`).
- Overview (`app/(dashboard)/firm/FirmProfileForm.js:213-222`).

Save behavior:

- Client sends `PUT /api/firm` with `serviceSectors` and primary `serviceSector` (`app/(dashboard)/firm/FirmProfileForm.js:67-80`).
- Server requires admin (`app/api/firm/route.js:62-66`).
- Server requires display name and at least one sector (`app/api/firm/route.js:71-80`).
- Server updates `Organization.name`, sets `setupCompletedAt`, and updates `FirmProfile` including sector fields (`app/api/firm/route.js:82-121`).

Sector editing is implemented and functional for admins. Non-admins can see the form on `/firm`, but save will fail with `Admin only` because `PUT /api/firm` requires admin (`app/(dashboard)/firm/page.js:24-29`, `app/api/firm/route.js:62-66`).

Team invites:

- UI collects optional name, required email, role `member` or `manager` (`app/settings/TeamInviteManager.js:14-18`, `app/settings/TeamInviteManager.js:58-83`).
- API normalizes role to `manager` or `member` (`app/api/settings/invites/route.js:15-17`).
- API rejects existing workspace members (`app/api/settings/invites/route.js:88-99`).
- API creates/refreshes a pending invite with a random token and 14-day expiry (`app/api/settings/invites/route.js:101-133`).
- API emails `/login?invite=...` via Resend when `APP_URL` is available (`app/api/settings/invites/route.js:19-21`, `app/api/settings/invites/route.js:135-155`).
- Invite email failures are logged but do not fail the API response (`app/api/settings/invites/route.js:156-161`).

Integrations:

- Webhook endpoint APIs exist (`app/api/webhooks/endpoints/route.js`, `app/api/webhooks/endpoints/[id]/route.js`) but no settings UI was found for them.
- These webhook APIs are organization-scoped but not admin-gated; any signed-in user with organization context can create/update/delete endpoints (`app/api/webhooks/endpoints/route.js:40-75`, `app/api/webhooks/endpoints/[id]/route.js:9-92`).

### Navigation

- `NAV_ITEMS` includes Dashboard, Opportunities, Pursuits, Contracts, Appeals only (`app/components/Sidebar.js:7-68`).
- `TopNav` renders exactly `NAV_ITEMS`, plus Inbox, theme toggle, and logout (`app/components/TopNav.js:42-92`).
- Mobile nav also renders exactly `NAV_ITEMS` (`app/components/TopNav.js:96-121`, `app/components/MobileNav.js:13-31`).
- `DashboardLayout` renders `TopNav` only; `Sidebar` is not used in the active layout (`app/(dashboard)/layout.js:18-22`).

Therefore, Settings is not merely role-gated in nav; it is absent from nav for everyone.

### Missing-settings symptom hypotheses

Most likely causes, in order:

1. The user is not global `admin`. `/settings` redirects non-admins to `/dashboard` (`app/(dashboard)/settings/page.js:19-20`). Public signup after the first-ever user creates `member` by default (`app/api/auth/register/route.js:67-76`).
2. There is no Settings nav item. Even an admin who can directly visit `/settings` will not see a Settings link (`app/components/Sidebar.js:7-68`, `app/components/TopNav.js:42-67`).
3. If the user is admin but the organization has no `setupCompletedAt`, the dashboard layout redirects to `/settings`; because `/settings` is inside the same layout, this can loop instead of rendering the page (`app/(dashboard)/layout.js:10-16`, `app/(dashboard)/settings/page.js:16-83`).
4. If the user's session has stale `role` or missing organization context, the UI/API will trust those session fields until re-login or context repair (`app/api/auth/me/route.js:16-45`, `lib/organization.js:129-159`).
5. A newly public-registered org can have a firm profile and sectors but still be considered incomplete because `setupCompletedAt` is only set by `PUT /api/firm` (`lib/organization.js:111-123`, `app/api/firm/route.js:82-88`).

## 4. Existing Email Pipeline

### Shared Resend wrapper

- `sendEmail()` uses `RESEND_API_KEY`, `EMAIL_FROM`, and Resend's `emails.send()` (`lib/email.js:3-47`).
- In non-production, delivery is dry-run unless `EMAIL_DEV_DELIVER === "true"` (`lib/email.js:15-28`).
- If `RESEND_API_KEY` is absent, email calls are skipped with `{ skipped: true }` (`lib/email.js:19-23`).

### Emails found

| Email | Exists | Fires from | Notes/gaps |
| --- | --- | --- | --- |
| Welcome email on signup | No | None found | Registration logs the user in immediately, but does not send welcome email (`app/api/auth/register/route.js:99-111`). |
| Email verification | No | None found | Google email verification is checked from Google token only; local email/password has no verification. |
| Password reset | No | None found | No forgot/reset routes, tokens, or emails found. |
| Team invite email | Yes | `POST /api/settings/invites` | Admin-only settings flow; sends `/login?invite=token` link (`app/api/settings/invites/route.js:135-155`). Failures are swallowed/logged (`app/api/settings/invites/route.js:156-161`). |
| Test Resend email | Yes | `POST /api/email/test` | Admin-only; useful for setup diagnostics (`app/api/email/test/route.js:21-75`). |
| Opportunity/radar alert | Yes | `/api/crawler` -> `sendOpportunityAlert` | Crawler cron is configured in `vercel.json` (`vercel.json:11-14`); route requires `CRON_SECRET` (`app/api/crawler/route.js:403-406`); sends to primary contact plus admin/owner-like recipients (`lib/bid360-notifications.js:141-232`). |
| Daily digest helper | Partially | Defined in crawler route | `sendDailyDigestEmail()` exists with "Daily ... Opportunity Digest" subject/body (`app/api/crawler/route.js:299-372`) but no call site in current code. Current crawler sends `sendOpportunityAlert` instead (`app/api/crawler/route.js:505-515`). |
| Pursuit assignment email | Yes | Tender/pursuit create and update | Called on `POST /api/tenders` and `PATCH /api/tenders/[id]` (`app/api/tenders/route.js:105-110`, `app/api/tenders/[id]/route.js:224-231`); implementation in `lib/tender-assignment.js:92-183`. |
| Pursuit deadline reminder | Yes | `/api/pursuits/reminders` | Cron configured at 05:00 daily (`vercel.json:7-10`); sends when deadlines enter 48-hour window (`app/api/pursuits/reminders/route.js:14-79`, `lib/bid360-notifications.js:235-309`). |
| High-value pursuit status email | Yes | `PATCH /api/tenders/[id]` | Fires for high-value statuses (`Under Review`, `Submitted`, `Awarded`) after status changes (`app/api/tenders/[id]/route.js:205-216`, `lib/tender-status-email.js:87-160`). Has hard-coded BCC `buntu.pato@gmail.com` (`lib/tender-status-email.js:6`, `lib/tender-status-email.js:121-124`). |
| Contract assignment email | Yes | Contract create/update | Called on `POST /api/contracts` and `PATCH /api/contracts/[id]` (`app/api/contracts/route.js:124-129`, `app/api/contracts/[id]/route.js:271-278`); implementation in `lib/contract-notifications.js:32-120`. |
| Contract end/renewal reminders | Yes | `/api/contracts/reminders` | Cron configured at 06:00 daily (`vercel.json:3-6`); sends date reminders and marks sent fields (`app/api/contracts/reminders/route.js:112-141`, `lib/contract-notifications.js:122-202`). |
| Contract follow-up reminder | Yes | `/api/contracts/reminders` | Same cron; sends when `nextFollowUpAt` enters window (`app/api/contracts/reminders/route.js:133-141`, `lib/contract-notifications.js:204-284`). |
| Contract milestone due | In-app only | `/api/contracts/reminders` | Creates in-app notifications; no email send for milestones (`app/api/contracts/reminders/route.js:144-170`). |
| Appeal created email | Yes | `POST /api/appeals` | Sends after appeal creation through `notifyChallengeCreated` (`app/api/appeals/route.js:318-323`, `lib/challenge-notifications.js:53-124`). |
| Appeal deadline reminder | Yes, but not scheduled in Vercel | `/api/appeals/reminders` | Route exists and sends via `sendChallengeDeadlineReminder` (`app/api/appeals/reminders/route.js:26-80`, `lib/challenge-notifications.js:126-201`), but `vercel.json` does not include this path. |
| Compliance expiry alert | In-app only | Vault/notifications sync | Creates/updates in-app notifications; no Resend email (`lib/compliance-documents.js:38-104`). |
| Generic NotificationService email | Exists but unused | No import sites found | `NotificationService` can send email, but no code imports it (`lib/notification-service.js:17-334`). |

### Email gaps

- No welcome email, password reset email, or email verification email.
- Daily digest helper appears dead in current code; current crawler uses opportunity alerts.
- Appeal deadline emails are not wired into `vercel.json` cron.
- Some email failures are swallowed intentionally (team invites), which can make the UI say "Invitation sent" even when email delivery failed.

## 5. Email Verification Readiness

### What exists

- Google token verification has an `emailVerified` check from Google payload (`lib/google-auth.js:40-46`, `app/api/auth/google/route.js:225-229`).
- Local `User` has no `emailVerified`, `emailVerifiedAt`, `verificationToken`, or provider-verification fields (`prisma/schema.prisma:13-36`).
- Schema has no `VerificationToken` model. The only token field found is `TeamInvite.token` (`prisma/schema.prisma:526-544`).
- No `/api/auth/verify`, `/api/auth/verify-email`, password reset, or forgot-password routes were found; `app/api/auth` contains only `google`, `login`, `logout`, `me`, and `register`.
- No verification email template/send path exists.

### What to add

- Add durable verification state to `User`, for example `emailVerifiedAt DateTime?` or `emailVerified Boolean @default(false)`.
- Add a token model, for example `EmailVerificationToken` with hashed token, userId/email, expiry, consumedAt, createdAt, and unique constraints.
- Add a post-registration email send path for email/password signup. Decide whether Google-created users should be immediately verified locally because Google email verification is already checked.
- Add verification routes:
  - `POST /api/auth/verification/request` or similar to issue/reissue tokens.
  - `GET` or `POST /api/auth/verify` to consume tokens.
- Gate login or sensitive app access based on verification state. The cleanest product choice is probably: allow registration, show a "verify email" interstitial, and block app workflows until verified.
- Update session payload to include verification state and refresh it from DB where needed.
- Add a resend-verification UI and audit/logging for token issuance/consumption.

### What to modify

- `prisma/schema.prisma` for fields/models and migrations.
- `/api/auth/register` to create verification token and send email, and to prevent role injection before public registration opens.
- `/api/auth/login` to block or mark unverified users.
- `/api/auth/google` to mark Google users verified locally or bypass local verification explicitly.
- `lib/session.js`/auth payload helpers to include verification state only if it is needed client-side.
- Settings/admin flows to invite users cleanly without requiring public registration.
- Email wrapper/templates to include a verification email with app URL from `lib/config/app-url.js`.

## 6. Top concerns

Things to fix before opening registration, ordered by severity:

1. Stop accepting client-supplied `role` in public registration. Both email and Google registration can assign `role` from the request body (`app/api/auth/register/route.js:75-83`, `app/api/auth/google/route.js:294-305`).
2. Decide the workspace-founder role model. Current public self-signup creates a new organization but a non-admin founder, which blocks settings and firm setup (`app/api/auth/register/route.js:67-76`, `app/(dashboard)/settings/page.js:19-20`).
3. Fix the `/settings` self-redirect risk for incomplete admins. Exempt `/settings` from the dashboard layout redirect or move setup gating into pages that are not settings (`app/(dashboard)/layout.js:10-16`).
4. Add Settings to navigation with a clear role rule. Right now no one sees a Settings link because `NAV_ITEMS` omits it (`app/components/Sidebar.js:7-68`).
5. Add email verification before allowing email/password public registration. There is no local verification state or route.
6. Add rate limiting/brute-force protection for login, registration, invite acceptance, and verification-token issuance.
7. Add CSRF/origin protection for cookie-authenticated state-changing routes.
8. Replace the hard-coded session-secret fallback with a fail-fast production check (`lib/session.js:24-25`).
9. Reconcile global `User.role` vs `Membership.role`. Settings and most admin gates use global role, while membership role stores `owner/manager/member` but rarely controls access.
10. Admin-gate webhook endpoint management or explicitly design it as a team-wide permission. Current webhook APIs allow any signed-in org member to create/update/delete outbound endpoints (`app/api/webhooks/endpoints/route.js:40-75`, `app/api/webhooks/endpoints/[id]/route.js:9-92`).
11. Fix broken mock-feed role check referencing non-existent `organizationRoles` (`app/api/opportunities/mock-feed/route.js:133-145`).
12. Remove or configure the hard-coded BCC in high-value tender status emails before production use (`lib/tender-status-email.js:6`, `lib/tender-status-email.js:121-124`).
13. Decide whether crawler `/api/crawler` should remain in `PUBLIC_PATHS`; the route checks `CRON_SECRET`, but keeping it "public" in proxy increases reliance on the route-level check (`proxy.js:3-13`, `app/api/crawler/route.js:403-406`).

## 7. Open questions

- Should every new public signup create a new workspace where that user is the workspace owner/admin, or should public registration only create pending users for an existing workspace?
- Is `User.role` intended to be global platform role, or should authorization be based primarily on `Membership.role` per organization?
- Should `owner` be a first-class organization role distinct from global `admin`, and should settings accept `organizationRole === "owner"`?
- Should settings be visible to managers/members in read-only form, or hidden entirely unless editable?
- Should `/firm` remain editable for non-admins? The UI shows the form, but the save API rejects non-admins.
- Should Google users be considered email-verified locally, or should all accounts go through a local verification flow regardless of provider?
- Should invited users be able to set an email/password after accepting a Google-first invite?
- Should password reset be added before public launch, or is Google-first/team-invite access the intended recovery path?
- Was the "daily digest worked this morning" produced by deployed code that differs from this branch? In this code, the daily digest helper exists but is not called; crawler sends opportunity alerts instead.
- Should appeal deadline reminders be added to `vercel.json` cron, or are they manually triggered/admin-only for now?
