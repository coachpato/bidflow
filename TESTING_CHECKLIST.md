# Bid360 Smoke Testing Checklist

## 🚀 Getting Started

### Step 1: Setup Environment
```bash
cd "C:\Users\Buntu - Local\OneDrive - Theophilus Seanego\Desktop\bidflow"
npm install
npm run setup:local
```

This will:
- ✅ Run database migrations
- ✅ Seed test data
- ✅ Start dev server on http://localhost:3000

### Step 2: Open Browser
Navigate to: **http://localhost:3000**

You'll see the Bid360 homepage. Ready to test!

---

## 📋 Test A: Onboarding Gate (New User Registration)

**Objective:** Verify that new users MUST complete Firm/Industries setup before accessing dashboard

### Checklist:
- [ ] Navigate to http://localhost:3000/register
- [ ] Fill in registration form:
  - Organization Name: `Test Org A`
  - Sector: `Built Environment` (must select)
  - Service: `Civil engineering` (must select at least 1)
  - Opportunity Type: `Design and engineering` (must select at least 1)
  - Full Name: `Test User A`
  - Email: `testA@example.com`
  - Password: `TestPass123!`
  - Confirm: `TestPass123!`
- [ ] Click "Create account"
- [ ] **Expected Result**: User account created and logged in automatically
- [ ] **Verify**: Redirected to `/dashboard` (not `/` or `/login`)
- [ ] **Verify**: User profile shows in top-right corner
- [ ] **Test Failure**: If error "Something went wrong", check browser console for details

**✅ Test Passes If:**
- Registration succeeds
- User is redirected to dashboard
- Firm/Industries selections were saved to user's profile

**❌ Test Fails If:**
- User gets stuck on registration page
- Error message displayed
- Redirected to login instead of dashboard

---

## 📋 Test B: Opportunity Dislike Filter (Firm-wide)

**Objective:** Verify that "Disliking" an opportunity hides it permanently for the ENTIRE organization

### Setup:
- [ ] Log in with: `staff@bidflow.test` / `staff123`
- [ ] You should see the dashboard with opportunities

### Checklist:
- [ ] In navigation, click "Opportunities" (or /opportunities)
- [ ] Find an opportunity in the list (there should be test ones like "Building Design Tender")
- [ ] Look for a "Dislike" or "Hide" button/icon on the opportunity card
- [ ] Click the dislike button
- [ ] **Expected**: Opportunity disappears from list

### Verify for Other Users:
- [ ] Log out (top right menu → Logout)
- [ ] Log in as: `manager@bidflow.test` / `manager123`
- [ ] Navigate to /opportunities
- [ ] **Verify**: The disliked opportunity is still GONE (not showing)
- [ ] **Verify**: Other opportunities are still visible

### ✅ Test Passes If:
- Disliking hides opportunity for logged-in user
- Other org members don't see the disliked opportunity
- It's permanent (doesn't reappear on refresh)

### ❌ Test Fails If:
- Opportunity reappears after refresh
- Other users still see the disliked opportunity
- No dislike button found

---

## 📋 Test C: Tender-to-Contract Workflow (Status Transitions)

**Objective:** Verify "Pursue" and "Record Award" buttons move data correctly without 404 errors

### Setup:
- [ ] Log in as: `manager@bidflow.test` / `manager123`

### Checklist:

#### Phase 1: Navigate to Tenders
- [ ] Click "Opportunities" in nav (or /opportunities)
- [ ] You should see tenders like "Highway Expansion Project"
- [ ] Click on the tender to open details

#### Phase 2: Pursue Tender (New → Pursuing)
- [ ] On tender detail page, look for "Pursue" button
- [ ] Click "Pursue"
- [ ] **Expected**: Page shows tender has moved to "pursuing" status
- [ ] **Verify**: URL shows `/pursuits/[id]` or page refreshes with new status
- [ ] **Check**: No 404 error in browser console

#### Phase 3: Record Award (Pursuing → Awarded)
- [ ] Still on pursuing page, look for "Record Award" or "Award" button
- [ ] Click the button
- [ ] **Expected**: Status changes to "Awarded"
- [ ] **Check**: No 404 error, page loads successfully

#### Phase 4: Convert to Contract (Awarded → Contract)
- [ ] Page should now show "Create Appointment" or "Create Contract" button
- [ ] Click to convert tender to contract
- [ ] **Expected**: Redirected to `/contracts/[id]`
- [ ] **Check**: Contract details page loads
- [ ] **Verify**: Contract shows data from original tender

#### Phase 5: Check for 404s
- [ ] Open Browser DevTools (F12)
- [ ] Go to Console tab
- [ ] Look for any red errors
- [ ] Look for 404 responses in Network tab
- [ ] **Verify**: No 404s during any transition

### ✅ Test Passes If:
- Tender successfully moved: New → Pursuing → Awarded → Contract
- All status changes saved to database
- No 404 errors during transitions
- Contract created with tender information

### ❌ Test Fails If:
- Any transition button missing or doesn't work
- 404 errors appear in console
- Page breaks during workflow
- Status doesn't update on page

---

## 📋 Quick Reference: Test Data

### Test Users
| Email | Password | Role | Notes |
|-------|----------|------|-------|
| admin@bidflow.test | admin123 | Admin | Full system access |
| manager@bidflow.test | manager123 | Manager | Can pursue & award tenders |
| staff@bidflow.test | staff123 | Staff | Limited permissions |

### Test Organization
- **Name**: Test Architecture Firm
- **Sector**: Built Environment
- **Services**: Civil engineering, Architecture
- **Members**: All 3 test users

### Test Tenders
1. **Highway Expansion Project** (NEW)
   - Ref: HWY-2024-001
   - Status: New
   - Ready to pursue

2. **Hospital Refurbishment** (UNDER REVIEW)
   - Ref: HSP-2024-001
   - Status: Under Review
   - Already assigned to manager

---

## 🐛 Debugging

### Test A Fails: "Something went wrong"
1. Check browser console (F12 → Console tab)
2. Look for error messages
3. Check database connection:
   ```bash
   npx prisma studio
   ```
4. Verify environment variables in `.env.local`

### Test B: Dislike button not found
1. Check if opportunities loaded
2. Verify organization has opportunities
3. Look for hide/dislike icon in UI
4. Check browser console for errors

### Test C: 404 during transitions
1. Check network tab (F12 → Network)
2. Look for failed requests
3. Verify tender/contract IDs exist in database
4. Check API endpoint response

---

## 📊 Expected Results Summary

| Test | Objective | Status | Notes |
|------|-----------|--------|-------|
| A | Onboarding gate forces sector/service selection | TBD | New users must complete setup |
| B | Dislike hides opportunity firm-wide | TBD | All org members see same view |
| C | Workflow: Pursue → Award → Contract | TBD | No 404 errors during transitions |

---

## 🔄 Reset & Retry

If tests fail or you want a clean slate:

```bash
# Reset database to fresh state
npm run db:reset

# Start fresh
npm run setup:local
```

⚠️ **Warning**: This deletes all test data!

---

## 📝 Notes

- Keep browser console open during testing
- Watch for error messages
- Check network tab for failed requests
- Test with multiple users to verify firm-wide features
- Document any failures with screenshots

---

**Last Updated:** April 22, 2026  
**Status:** Ready for Manual Testing
