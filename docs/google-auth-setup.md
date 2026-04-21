# Google Auth Setup for Bid360

Bid360 uses Google Identity Services for "Continue with Google" on web.

## 1. Create a Google web client

In Google Cloud Console:

1. Open `APIs & Services` -> `Credentials`
2. Configure the consent screen if Google asks
3. Create an `OAuth client ID`
4. Choose `Web application`

Use these **Authorized JavaScript origins**:

- `http://localhost:3000`
- `https://bidflow-livid.vercel.app`

If you add a custom production domain later, add that exact origin too.

If you need Google auth on a stable non-production URL, add that exact origin as well.
Google does not support wildcard origins for this setup.

You do **not** need a redirect URI for the current Bid360 Google button flow.

## 2. Set environment variables

Set the same value for both:

- `GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

### Local

Add both values to `.env.local`.

### Vercel

Add both values to:

- Development
- Preview
- Production

Example commands:

```powershell
npx vercel env add GOOGLE_CLIENT_ID development
npx vercel env add GOOGLE_CLIENT_ID preview
npx vercel env add GOOGLE_CLIENT_ID production
npx vercel env add NEXT_PUBLIC_GOOGLE_CLIENT_ID development
npx vercel env add NEXT_PUBLIC_GOOGLE_CLIENT_ID preview
npx vercel env add NEXT_PUBLIC_GOOGLE_CLIENT_ID production
```

After updating Vercel env vars, redeploy the app.

## 3. Verify

1. Open `/register`
2. Confirm the Google button renders
3. Complete sign-up with a Google account
4. Confirm the user lands on `/dashboard`
5. Repeat on `/login`

## 4. Stability notes

- Use the Google account `sub` claim as the durable account identifier
- Keep production on one stable domain for the smoothest Google setup
- Preview deployments may need extra origins if you want Google auth there
