# Bid360 Soft Launch Runbook

Use this runbook for the first controlled pilot with real users.

## Launch Gates

Run these before every pilot deployment:

```bash
npm run lint
npm test -- --runInBand
npm run db:validate
npm run db:migrate:status
npm run rollout:gate
npm run build
```

All gates passed locally on 2026-04-28.

## Production Configuration

Set these in Vercel before inviting pilot users:

- `DATABASE_URL`
- `DIRECT_URL`
- `SESSION_SECRET`
- `ALLOW_PUBLIC_REGISTRATION=false`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET=tender-docs`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET`

Confirm the Supabase storage bucket exists and is private unless a public bucket is deliberately required.

## First Admin Setup

1. Temporarily set `ALLOW_PUBLIC_REGISTRATION=true`.
2. Deploy to the pilot environment.
3. Register the first admin account.
4. Set `ALLOW_PUBLIC_REGISTRATION=false`.
5. Redeploy or refresh environment variables.
6. Confirm login still works for the admin account.

## Pilot Scope

Start with 3 to 5 friendly users from one organization. Give them these workflows:

- Create or complete the firm profile.
- Review matched opportunities.
- Hide one irrelevant opportunity and confirm it stays hidden.
- Convert a relevant opportunity into a pursuit.
- Move a pursuit through status changes.
- Upload at least one document.
- Convert an awarded pursuit or tender into a contract.
- Confirm reminder and assignment emails are received.

## Daily Pilot Checks

For the first week:

- Check Vercel function errors.
- Check Supabase database and storage usage.
- Review failed webhook deliveries if webhooks are enabled.
- Confirm scheduled jobs ran: crawler, pursuit reminders, contract reminders.
- Capture user friction in a single issue list.

## Soft Launch Exit Criteria

Move beyond soft launch when:

- No critical workflow blockers are open.
- A real organization can complete opportunity to contract without support.
- Uploads, emails, scheduled reminders, and login are reliable.
- Public registration is locked down.
- Backup and rollback paths are understood.
