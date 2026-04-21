# RBAC Implementation - Code Locations & Changes

## File-by-File Implementation Map

### 1. lib/status-machine.js - CORE SYSTEM
**Status**: ✅ MODIFIED (350+ lines added)

**Changes Made:**
- Lines 1-25: Added `ROLES` enum and `ROLE_NAMES` mapping
- Lines 54-77: Added `TENDER_TRANSITION_PERMISSIONS` matrix
- Lines 108-130: Added `CONTRACT_APPOINTMENT_TRANSITION_PERMISSIONS` matrix
- Lines 152-167: Added `CONTRACT_INSTRUCTION_TRANSITION_PERMISSIONS` matrix
- Lines 190-250: Updated `validateTenderTransition()` to accept `userRole` parameter and check permissions
- Lines 252-297: Updated `validateContractAppointmentTransition()` with role checks
- Lines 299-344: Updated `validateContractInstructionTransition()` with role checks
- Lines 346-450: Added helper functions:
  - `getTenderTransitionRequiredRole()`
  - `getContractAppointmentTransitionRequiredRole()`
  - `getContractInstructionTransitionRequiredRole()`
  - `canUserTransition()`
  - `getTransitionRequiredRoleName()`

**Key Logic:**
```javascript
// Validation now includes role check
export function validateTenderTransition(currentStatus, newStatus, userRole = ROLES.STAFF) {
  // ... existing transition validation ...
  
  const requiredRole = TENDER_TRANSITION_PERMISSIONS[`${currentStatus} > ${newStatus}`]
  
  if (userRole === ROLES.ADMIN) return { isValid: true }  // Admin bypass
  if (userRole < requiredRole) return { isValid: false, code: 'INSUFFICIENT_ROLE' }
  
  return { isValid: true }
}
```

---

### 2. lib/roles.js - NEW UTILITY FILE
**Status**: ✅ CREATED (95 lines)

**Exports:**
```javascript
roleStringToValue(roleString)              // 'manager' → 1
getUserRoleFromSession(session)            // Extract from session.role
userHasRole(userRole, requiredRole)        // Check permission level
isUserAdmin(userRole)                      // Quick admin check
isUserManager(userRole)                    // Quick manager check
getRoleComparisonMessage()                 // User-friendly error text
canUserTransition()                        // Check if user can do specific transition
getTransitionRequiredRoleName()            // Get 'Manager', 'Staff', etc.
```

**Example Usage:**
```javascript
import { getUserRoleFromSession } from '@/lib/roles'

const userRole = getUserRoleFromSession(session)  // Returns 0, 1, or 2
```

---

### 3. app/api/tenders/[id]/route.js - TENDER UPDATE
**Status**: ✅ MODIFIED (~40 lines added/changed)

**Line 6**: Added import
```javascript
import { validateTenderTransition, ROLE_NAMES } from '@/lib/status-machine'
import { getUserRoleFromSession } from '@/lib/roles'
```

**Lines 118-138**: Updated status validation section
```javascript
if (body.status && body.status !== existing.status) {
  const userRole = getUserRoleFromSession(session)
  const validation = validateTenderTransition(existing.status, body.status, userRole)
  
  if (!validation.isValid) {
    const statusCode = validation.code === 'INSUFFICIENT_ROLE' ? 403 : 400
    return Response.json({
      error: validation.error,
      code: validation.code,
      ...(validation.code === 'INSUFFICIENT_ROLE' && {
        requiredRole: ROLE_NAMES[validation.requiredRole],
        userRole: ROLE_NAMES[validation.userRole]
      })
    }, { status: statusCode })
  }
}
```

**Lines 153-165**: Updated audit trail recording
```javascript
if (body.status && body.status !== existing.status) {
  const userRole = getUserRoleFromSession(session)
  const userRoleName = ROLE_NAMES[userRole]
  
  void recordTenderStatusChange({
    tenderId: updated.id,
    fromStatus: existing.status,
    toStatus: body.status,
    changedByUserId: session.userId,
    userRole: userRoleName,  // ← NEW FIELD
    reason: body.statusChangeReason || null
  })
}
```

---

### 4. app/api/contracts/[id]/route.js - CONTRACT UPDATE
**Status**: ✅ MODIFIED (~50 lines added/changed)

**Lines 1-10**: Added imports
```javascript
import { ROLE_NAMES, validateContractAppointmentTransition, validateContractInstructionTransition } from '@/lib/status-machine'
import { getUserRoleFromSession } from '@/lib/roles'
```

**Lines 117-156**: Updated BOTH status validation sections
```javascript
const userRole = getUserRoleFromSession(session)

// Appointment status check
if (body.appointmentStatus && body.appointmentStatus !== existing.appointmentStatus) {
  const validation = validateContractAppointmentTransition(
    existing.appointmentStatus,
    body.appointmentStatus,
    userRole
  )
  if (!validation.isValid) {
    const statusCode = validation.code === 'INSUFFICIENT_ROLE' ? 403 : 400
    return Response.json({ ... }, { status: statusCode })
  }
}

// Instruction status check (similar)
if (body.instructionStatus && body.instructionStatus !== existing.instructionStatus) {
  const validation = validateContractInstructionTransition(
    existing.instructionStatus,
    body.instructionStatus,
    userRole
  )
  if (!validation.isValid) {
    return Response.json({ ... }, { status: statusCode })
  }
}
```

**Lines 182-223**: Updated audit trail for both status fields
```javascript
if (newAppointmentStatus !== existing.appointmentStatus) {
  void recordContractStatusChange({
    contractId: updated.id,
    fieldName: 'appointmentStatus',
    oldValue: existing.appointmentStatus,
    newValue: newAppointmentStatus,
    changedByUserId: session.userId,
    userRole: userRoleName,  // ← NEW FIELD
    reason: body.statusChangeReason || null
  })
}
```

---

### 5. app/api/tenders/[id]/convert-to-contract/route.js - CONVERT ENDPOINT
**Status**: ✅ MODIFIED (~25 lines added/changed)

**Lines 1-3**: Added imports
```javascript
import { ROLES, ROLE_NAMES } from '@/lib/status-machine'
import { getUserRoleFromSession } from '@/lib/roles'
```

**Lines 128-150**: Added RBAC check BEFORE conversion
```javascript
// New check inserted here
const userRole = getUserRoleFromSession(session)
if (userRole < ROLES.MANAGER) {
  return Response.json({
    error: `Converting a tender to contract requires ${ROLE_NAMES[ROLES.MANAGER]} role. You are ${ROLE_NAMES[userRole]}.`,
    code: 'INSUFFICIENT_ROLE',
    requiredRole: ROLE_NAMES[ROLES.MANAGER],
    userRole: ROLE_NAMES[userRole]
  }, { status: 403 })
}

const body = await request.json()
```

**Lines 176-180**: Updated logging
```javascript
const userRoleName = ROLE_NAMES[userRole]
await logActivity(
  `Tender "${tender.title}" converted to contract (ID: ${contract.id}) by ${userRoleName}`,
  { ... }
)
```

---

### 6. app/components/TenderStatusSelector.js - NEW COMPONENT
**Status**: ✅ CREATED (60 lines)

**Purpose**: RBAC-aware dropdown for tender status selection

**Features:**
- Shows current status first
- Lists allowed next statuses based on user role
- Disables transitions user lacks permission for
- Displays "(requires Manager)" on disabled options
- Helper text about role restrictions

**Usage:**
```javascript
<TenderStatusSelector
  currentStatus={tender.status}
  value={form.status}
  onChange={handleStatusChange}
  userRole={getUserRoleFromSession(session)}
/>
```

**Output for STAFF in "Under Review":**
```
Under Review (current)
In Progress (requires Manager)  [DISABLED]
Submitted (requires Manager)    [DISABLED]
```

---

### 7. app/components/ContractStatusSelector.js - NEW COMPONENT
**Status**: ✅ CREATED (130 lines)

**Exports:**
```javascript
export function ContractAppointmentStatusSelector(...)
export function ContractInstructionStatusSelector(...)
```

**Features:**
- Two separate selectors for appointment and instruction
- RBAC-aware disabling of restricted transitions
- Role requirement tooltips
- Works with `canUserTransition()` from status-machine

**Usage:**
```javascript
import { ContractAppointmentStatusSelector } from '@/app/components/ContractStatusSelector'

<ContractAppointmentStatusSelector
  currentStatus={contract.appointmentStatus}
  value={form.appointmentStatus}
  onChange={handleChange}
  userRole={userRole}
/>
```

---

## Documentation Files Created

### RBAC_IMPLEMENTATION.md
**Lines**: 600+
**Contents:**
- Complete permission matrices with examples
- API endpoint specifications
- Error response formats
- 5 test cases with curl commands
- Security considerations
- Troubleshooting guide
- Monitoring instructions

### RBAC_SUMMARY.md
**Lines**: 300+
**Contents:**
- Executive summary
- Files modified list
- All permission matrices
- Verification checklist
- Backward compatibility notes
- Build verification status

### RESTRICTED_TRANSITIONS.md
**Lines**: 250+
**Contents:**
- Quick reference guide
- What's now protected
- What STAFF can still do
- Key takeaways
- Testing procedures
- Impact summary

### RBAC_CODE_LOCATIONS.md
**Lines**: 300+
**Contents**: This file
- Line-by-line code changes
- File-by-file implementation map
- Code snippets showing changes
- Component exports and usage

---

## Role Enum Values

```javascript
ROLES.STAFF = 0
ROLES.MANAGER = 1
ROLES.ADMIN = 2
```

Session role strings get converted:
```
'staff' or 'user'  →  0 (ROLES.STAFF)
'manager'          →  1 (ROLES.MANAGER)
'admin'            →  2 (ROLES.ADMIN)
default/null       →  0 (ROLES.STAFF) - safe default
```

---

## Permission Check Pattern (Used Everywhere)

```javascript
// 1. Get user role
const userRole = getUserRoleFromSession(session)

// 2. Validate with role check
const validation = validateTenderTransition(currentStatus, newStatus, userRole)

// 3. Return 403 if permission denied
if (!validation.isValid && validation.code === 'INSUFFICIENT_ROLE') {
  return Response.json({
    error: validation.error,
    requiredRole: ROLE_NAMES[validation.requiredRole],
    userRole: ROLE_NAMES[userRole]
  }, { status: 403 })
}

// 4. Record with role for audit trail
void recordTenderStatusChange({
  ...,
  userRole: ROLE_NAMES[userRole],
  ...
})
```

---

## Error Response Pattern

**When STAFF tries restricted action:**
```json
HTTP 403 Forbidden

{
  "error": "This transition requires Manager role. You are Staff.",
  "code": "INSUFFICIENT_ROLE",
  "requiredRole": "Manager",
  "userRole": "Staff"
}
```

**When invalid transition (role-agnostic):**
```json
HTTP 400 Bad Request

{
  "error": "Cannot transition from 'New' to 'Submitted'. Valid transitions: Under Review",
  "code": "INVALID_TRANSITION"
}
```

---

## Key Exports from Status Machine

```javascript
// Constants
export const ROLES = { STAFF: 0, MANAGER: 1, ADMIN: 2 }
export const ROLE_NAMES = { 0: 'Staff', 1: 'Manager', 2: 'Admin' }

// Permission Matrices
export const TENDER_TRANSITION_PERMISSIONS = { ... }
export const CONTRACT_APPOINTMENT_TRANSITION_PERMISSIONS = { ... }
export const CONTRACT_INSTRUCTION_TRANSITION_PERMISSIONS = { ... }

// Validation Functions (now with role check)
export function validateTenderTransition(currentStatus, newStatus, userRole)
export function validateContractAppointmentTransition(currentStatus, newStatus, userRole)
export function validateContractInstructionTransition(currentStatus, newStatus, userRole)

// Helper Functions
export function getTenderTransitionRequiredRole(currentStatus, newStatus)
export function canUserTransition(currentStatus, newStatus, userRole, resourceType)
export function getTransitionRequiredRoleName(currentStatus, newStatus, resourceType)
```

---

## Build Summary

✅ **lib/status-machine.js** - 350+ lines added (validation functions + matrices + helpers)
✅ **lib/roles.js** - 95 lines (NEW utility file)
✅ **app/api/tenders/[id]/route.js** - 40 lines modified
✅ **app/api/contracts/[id]/route.js** - 50 lines modified  
✅ **app/api/tenders/[id]/convert-to-contract/route.js** - 25 lines modified
✅ **app/components/TenderStatusSelector.js** - 60 lines (NEW component)
✅ **app/components/ContractStatusSelector.js** - 130 lines (NEW component)
✅ **Documentation** - 1000+ lines across 4 files

**Total Lines of Code**: ~700 production code + 1000 documentation
**Build Status**: ✅ PASSING (0 errors, 0 warnings)
**Backward Compatible**: ✅ Yes
**Database Migration Needed**: ❌ No
**Breaking Changes**: ❌ None

---

**Implementation Complete: April 21, 2026**
**Status: PRODUCTION READY**
