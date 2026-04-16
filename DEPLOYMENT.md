# BidFlow Deployment Guide

## Recommended stack

- Vercel for hosting
- Supabase Postgres for the database
- Supabase Storage for uploaded tender documents

This is the easiest path for a small company pilot because it keeps ops light and works well with Next.js + Prisma.

## Easiest deployment path

The simplest way to avoid manually copying database credentials is to install the Supabase Vercel integration from the Supabase dashboard. It injects these env vars into Vercel automatically:

- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

This app now supports those injected variables automatically.

## Environment variables

Set these locally and in Vercel:

- `DATABASE_URL`
- `DIRECT_URL`
- `SESSION_SECRET`
- `ALLOW_PUBLIC_REGISTRATION`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Use `.env.example` as the template.
If you use the Supabase Vercel integration, you can skip manually creating the DB URLs in Vercel.

## Production setup

1. Create a Supabase project.
2. Create a public storage bucket named `tender-docs`.
3. Install the Supabase Vercel integration from Supabase, or manually set the env vars in Vercel.
4. If you are setting them manually, set `DATABASE_URL` to the Supabase pooled connection string.
5. If you are setting them manually, set `DIRECT_URL` to the Supabase direct connection string.
6. If local Prisma migration commands fail with a generic schema engine error and your machine cannot resolve the direct `db.<project-ref>.supabase.co` host, use this repo's helper scripts. They automatically fall back to Supabase's session pooler on port `5432` for Prisma migrate/db commands.
6. Deploy this repo to Vercel.
7. Add the environment variables in Vercel Project Settings.
8. Run the production migrations:

```bash
npm run db:migrate:deploy
```

## First launch

1. Open `/register`.
2. Create the first admin user.
3. Set `ALLOW_PUBLIC_REGISTRATION=false`.
4. Test login.
5. Upload a PDF and confirm it appears in Supabase Storage.
6. Create a tender and confirm data is saved in the production database.
