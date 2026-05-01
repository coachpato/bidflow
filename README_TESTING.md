# 🧪 Bid360 Local Testing Environment

Welcome! I've set up a complete local testing environment for you to play around with Bid360. Here's what you can do now:

---

## ⚡ Quick Start (Recommended)

### Windows Users:
```bash
START_TESTING.bat
```

### Mac/Linux Users:
```bash
chmod +x start-testing.sh
./start-testing.sh
```

### Or Manual Setup:
```bash
npm install
npm run db:migrate:deploy
npm run db:seed:test
npm run dev
```

**Then open**: http://localhost:3000 in your browser

---

## 📚 What's Included

### ✅ Test Data Seeded
I've pre-created test users and organizations so you can immediately start testing:

**Test Users:**
```
Admin:    admin@bidflow.test / admin123
Manager:  manager@bidflow.test / manager123  
Staff:    staff@bidflow.test / staff123
```

**Test Organization:**
- Name: Test Architecture Firm
- Sector: Built Environment
- Services: Civil engineering, Architecture
- Opportunities: 2 sample opportunities
- Tenders: 2 sample tenders

### ✅ Database Connected
- Uses your existing Supabase PostgreSQL database
- Migrations are ready to run
- Test data seeder includes realistic data

### ✅ Development Server Ready
- Full Next.js hot reload enabled
- All API routes accessible
- Browser DevTools support

---

## 🎯 What You Can Test

### Test A: New User Registration & Onboarding
1. Go to http://localhost:3000/register
2. Create a new account with sector/service selections
3. Verify you're forced to select Firm Industries
4. Verify you're redirected to dashboard after signup

**Test Data:**
```
Org Name: Test Org [A/B/C]
Sector: Built Environment
Service: Civil engineering (required)
Opportunity Type: Design and engineering (required)
Email: testa@example.com
Password: TestPass123!
```

### Test B: Dislike Feature (Firm-wide filter)
1. Log in as `staff@bidflow.test`
2. Navigate to Opportunities
3. Find an opportunity and click "Dislike"
4. Verify it disappears for you
5. **Switch user**: Log in as `manager@bidflow.test`
6. **Verify**: Disliked opportunity is STILL gone (proves it's firm-wide)

### Test C: Workflow Transitions
1. Log in as `manager@bidflow.test`
2. Go to Opportunities
3. Click a tender (e.g., "Highway Expansion Project")
4. Click "Pursue" → Should move to Pursuing status
5. Click "Record Award" → Should move to Awarded status
6. Click "Create Contract" → Should create contract record
7. **Watch console**: No 404 errors should appear

---

## 📋 Complete Testing Guide

See **TESTING_CHECKLIST.md** for detailed step-by-step instructions for all three smoke tests.

---

## 🛠 Available Commands

```bash
# Start development server
npm run dev

# Setup everything (migrations + seed + dev server)
npm run setup:local

# Database management
npm run db:migrate:deploy      # Run pending migrations
npm run db:migrate:status      # Check migration status
npm run db:seed:test           # Seed test data
npm run db:reset               # ⚠️ DESTRUCTIVE: Delete all data and reset

# Build & Production
npm run build                  # Build for production
npm start                      # Run production build

# Code quality
npm run lint                   # Check code style
npm test                       # Run Jest tests
npm run test:watch            # Watch for test changes
npm run test:coverage         # Coverage report
```

---

## 🔑 Test Credentials Quick Reference

### Users
| Email | Password | Role | Permissions |
|-------|----------|------|-------------|
| admin@bidflow.test | admin123 | Admin | Full access, can delete, override |
| manager@bidflow.test | manager123 | Manager | Can pursue/award tenders, manage team |
| staff@bidflow.test | staff123 | Staff | Can search opportunities, limited actions |

### Organization
- **Name**: Test Architecture Firm
- **Members**: All 3 users above
- **Sector**: Built Environment
- **Services**: Civil engineering, Architecture
- **Industries**: All selected
- **Provinces**: Gauteng, Western Cape

---

## 🐛 Troubleshooting

### "Something went wrong" on Registration
1. Open Browser DevTools: Press **F12**
2. Go to **Console** tab
3. Look for error message
4. Try again with a different email

**Common Fixes:**
```bash
# Reset database
npm run db:reset

# Restart server
# (Press Ctrl+C to stop, then npm run dev)

# Check database connection
npx prisma studio
```

### "Cannot find module" Error
```bash
npm install
```

### Port 3000 Already in Use
```bash
# Kill the process on port 3000 (macOS/Linux)
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

### Database Migration Failed
```bash
# Check migration status
npm run db:migrate:status

# Try pushing schema directly
npx prisma db push --skip-generate
```

---

## 🔄 Testing Workflow

1. **Setup** (one time)
   ```bash
   npm install
   npm run setup:local
   ```

2. **Test A: Registration**
   - Open http://localhost:3000/register
   - Create new account
   - Verify onboarding gate works

3. **Test B: Dislike Feature**
   - Log in with staff user
   - Dislike an opportunity
   - Switch to manager user
   - Verify it's gone

4. **Test C: Workflow**
   - Log in as manager
   - Pursue → Award → Contract a tender
   - Watch for errors

5. **Reset & Repeat**
   ```bash
   npm run db:reset
   npm run setup:local
   ```

---

## 📊 What's Being Tested

### Functional Tests
- ✅ User registration with sector/service selection
- ✅ Onboarding gate enforcement
- ✅ Dislike feature (firm-wide)
- ✅ Tender status workflow (New → Pursuing → Awarded → Contract)
- ✅ Role-based permissions (Admin, Manager, Staff)
- ✅ Multi-user organization features

### Technical Tests
- ✅ Database connectivity (Supabase PostgreSQL)
- ✅ Session management
- ✅ API endpoints (registration, updates, transitions)
- ✅ Error handling
- ✅ 404 error detection

### UI Tests
- ✅ Form validation
- ✅ Button functionality
- ✅ Navigation flows
- ✅ Status updates
- ✅ Error messages

---

## 📝 Notes for Testing

1. **Watch the console** (F12 → Console tab)
   - Errors appear in red
   - API responses show in Network tab

2. **Check for 404s**
   - Open DevTools Network tab
   - Look for red entries
   - Verify no 404 responses during transitions

3. **Test with different users**
   - Each role has different permissions
   - Firm-wide features visible to all members
   - Staff limitations verified

4. **Refresh to verify persistence**
   - After each action, refresh page (F5)
   - Verify changes were saved to database
   - Status should persist

---

## 🎓 Learning Resources

### Files to Explore
- `LOCAL_TEST_SETUP.md` - Detailed setup instructions
- `TESTING_CHECKLIST.md` - Step-by-step test procedures
- `prisma/schema.prisma` - Database schema
- `app/api/auth/register/route.js` - Registration API
- `app/(auth)/register/RegisterForm.js` - Registration form component

### Key URLs
- **App**: http://localhost:3000
- **Register**: http://localhost:3000/register
- **Dashboard**: http://localhost:3000/dashboard
- **Opportunities**: http://localhost:3000/opportunities
- **Tenders**: http://localhost:3000/opportunities (filtered)

---

## 🚀 You're All Set!

Everything is ready to go. Here's what to do next:

1. **Start the environment**
   ```bash
   npm run setup:local
   ```

2. **Open your browser**
   ```
   http://localhost:3000
   ```

3. **Follow the testing checklist**
   - Test A: Registration & Onboarding
   - Test B: Dislike Feature
   - Test C: Workflow Transitions

4. **Document your findings**
   - Note any errors or unexpected behavior
   - Take screenshots of failures
   - Share results in your testing report

---

## 💡 Pro Tips

- Use **incognito/private browsing** for cleaner testing
- Keep **two browser windows** open (different users)
- Use **browser DevTools** to inspect API responses
- Use **npx prisma studio** to view/edit database directly
- Create custom test data using the seed script as a template

---

## 📞 Need Help?

1. **Database Issues?** → Check `.env.local` database URLs
2. **API Errors?** → Check browser console and Network tab
3. **Test Data Missing?** → Run `npm run db:seed:test`
4. **Something Broken?** → Run `npm run db:reset` and start fresh

---

**Created:** April 22, 2026  
**Status:** Ready for Testing  
**Next Step:** Run `npm run setup:local` and start testing!

Happy testing! 🎉
