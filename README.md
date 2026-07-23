# Bid360

Bid360 is a Next.js app for South African tender discovery. The crawler fetches and stores eTenders opportunities daily, then the subscription layer matches new opportunities to sector-based subscribers and sends personalized digest emails.

## Current Product Shape

- `/` is a public landing page with an email-only subscription form.
- `/manage` lets subscribers find their subscriptions by email, update keywords/location, or unsubscribe.
- Subscribers choose one predefined sector per subscription. The same email can subscribe to multiple sectors.
- The crawler, diagnostics, lease handling, metrics, dead letters, and source storage remain in place.
- Organization tables are preserved in the database for future use, but organization-based tender matching is bypassed.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

- `ADMIN_EMAIL`: receives a notification when a brand-new sector subscription is created.
- `RESEND_API_KEY` and `EMAIL_FROM`: used by the shared email delivery utility.

## Verification

```bash
npm test -- --runInBand
npm run lint
npm run db:validate
```

## Database

Prisma schema changes are managed through migrations in `prisma/migrations`. The subscriber model is additive and lives alongside the preserved organization models.
