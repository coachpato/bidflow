# Bid360 Local Testing Setup Guide

## Quick Start (One Command)

```bash
npm run setup:local
```

## Manual Setup Steps

### 1. Verify Database Connection
Your app is configured to use Supabase PostgreSQL. The connection strings are in `.env.local`:
- `DATABASE_URL`: Pooled connection (for app runtime)
- `DIRECT_URL`: Direct connection (for migrations)

### 2. Run Database Migrations
```bash
npx prisma migrate deploy
```

### 3. Seed Test Data (Optional)
```bash
npx prisma db seed
```

### 4. Start Development Server
```bash
npm run dev
```

The app will be available at: **http://localhost:3000**

---

## Testing Registration Flow

### Test Scenario: User Registration with Onboarding

1. **Navigate to Registration**
   - URL: `http://localhost:3000/register`

2. **Fill Registration Form**
   ```
   Organization Name: "Test Architecture Firm"
   Sector: "Built Environment"
   Services: Select at least one (e.g., "Civil engineering")
   Opportunity Types: Select at least one (e.g., "Design and engineering")
   Full Name: "Test User"
   Email: "testuser@example.com"
   Password: "TestPassword123!"
   Confirm Password: "TestPassword123!"
   ```

3. **Expected Behavior**
   - ✅ Form validates all fields
   - ✅ On submit, user account is created
   - ✅ User is logged in automatically
   - ✅ User is redirected to dashboard
   - ✅ Organization is created with selected preferences

4. **What Test A Verifies**
   - New users MUST complete Firm/Industries onboarding before accessing dashboard
   - After successful registration, they should be on `/dashboard`
   - The onboarding "gate" should force sector and service selections

---

## Test Data Credentials

### Admin User (if seed runs successfully)
```
Email: admin@example.com
Password: admin123
```

### Sample Organizations
The seed script creates:
- Architecture firms
- Legal practices
- Financial services companies

---

## Troubleshooting

### "Something went wrong" Error During Registration

**Possible Causes:**
1. **Database Connection Failed**
   - Verify Supabase credentials in `.env.local`
   - Check DATABASE_URL and DIRECT_URL

2. **Missing Email Service (Resend)**
   - RESEND_API_KEY is configured
   - Email notifications may fail silently

3. **Migration Not Run**
   ```bash
   npx prisma migrate deploy
   ```

4. **Schema Mismatch**
   ```bash
   npx prisma db push --skip-generate
   ```

### Dev Server Won't Start

```bash
# Clear cache
rm -rf .next

# Reinstall dependencies
npm install

# Start fresh
npm run dev
```

### Reset Database (⚠️ Deletes All Data)

```bash
# Reset to clean slate
npx prisma migrate reset
```

---

## Environment Variables Explained

| Variable | Purpose | Status |
|----------|---------|--------|
| `DATABASE_URL` | App database access (pooled) | ✅ Configured |
| `DIRECT_URL` | Migrations & direct queries | ✅ Configured |
| `SESSION_SECRET` | Session encryption | ✅ Configured |
| `ALLOW_PUBLIC_REGISTRATION` | Enable registration | ✅ Set to "true" |
| `RESEND_API_KEY` | Email service | ✅ Configured |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth (Optional) | ❌ Disabled |

---

## Test Plan: Complete Feature Flow

### Test A: Onboarding Gate ✅
- [ ] Register new user
- [ ] Verify sector selection is required
- [ ] Verify service selection is required
- [ ] Verify redirect to dashboard after setup

### Test B: Opportunity Dislike Filter
- [ ] Log in to dashboard
- [ ] Find an opportunity
- [ ] Click "Dislike"
- [ ] Verify it's hidden for all organization members

### Test C: Tender-to-Contract Workflow
- [ ] Navigate to /opportunities
- [ ] Create/select a tender
- [ ] Click "Pursue" → moves to /pursuits
- [ ] Click "Record Award" → moves to /contracts
- [ ] Verify no 404 errors

---

## Database Schema

Key tables being tested:
- **User**: User accounts with authentication
- **Organization**: Company/firm workspace
- **FirmProfile**: Sector, services, preferences
- **Opportunity**: Tenders and opportunities
- **Tender**: Specific bids/opportunities
- **Contract**: Awards and contract records

---

## Browser DevTools Tips

1. **Inspect Network Tab**
   - Watch POST /api/auth/register
   - Check response status and body
   - Look for error details

2. **Console Tab**
   - Check for JavaScript errors
   - Look for error logging

3. **Application Tab**
   - Verify session cookie is set
   - Check localStorage for state

---

## Need Help?

1. **Check logs**: Dev server terminal shows backend errors
2. **Database**: Test connection with `npx prisma studio`
3. **Migrations**: See status with `npx prisma migrate status`
4. **Schema**: View with `npx prisma db push --help`

---

**Last Updated:** April 22, 2026
**Status:** Ready for Testing
