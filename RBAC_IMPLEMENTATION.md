# Role-Based Access Control (RBAC) Implementation

## Overview
BidFlow now enforces role-based permissions on status transitions to ensure only authorized users can approve and advance work items.

## Role Hierarchy
- **STAFF** (Level 0): Basic users who can initiate reviews and receive instructions
- **MANAGER** (Level 1): Can approve transitions, finalize submissions, and convert tenders to contracts
- **ADMIN** (Level 2): Full access, can perform any transition

---

## Tender Status Transitions - Permission Matrix

| Transition | Required Role | Details |
|-----------|---------------|---------|
| New → Under Review | **STAFF** | Anyone can start review |
| New → Submitted | **MANAGER** | Expedited path requires approval |
| Under Review → In Progress | **MANAGER** | Manager must approve active work |
| Under Review → Submitted | **MANAGER** | Manager can skip directly to submission |
| In Progress → Submitted | **MANAGER** | Final approval to submit |

### Permission Examples

✅ **STAFF can:**
- Move tender from New → Under Review

❌ **STAFF cannot:**
- Move tender from Under Review → In Progress (needs MANAGER)
- Move tender from Any → Submitted (needs MANAGER)

✅ **MANAGER can:**
- All STAFF permissions, plus
- Move from Under Review → In Progress
- Move from Under Review → Submitted
- Move from In Progress → Submitted
- **Convert tender to contract** ⭐

✅ **ADMIN can:**
- All transitions without restriction
- Includes tender-to-contract conversion

---

## Contract Appointment Status Transitions

| Transition | Required Role |
|-----------|---------------|
| Pending → Appointed | **MANAGER** |
| Pending → Not Appointed | **MANAGER** |
| Appointed → Not Appointed | **MANAGER** |
| Appointed → Pending | **STAFF** |
| Not Appointed → Appointed | **MANAGER** |
| Not Appointed → Pending | **STAFF** |

---

## Contract Instruction Status Transitions

| Transition | Required Role |
|-----------|---------------|
| No Instruction → Instruction Received | **STAFF** |
| Instruction Received → Work Complete | **MANAGER** |
| Instruction Received → No Instruction | **MANAGER** |

---

## Convert Tender to Contract

**Endpoint:** `POST /api/tenders/{id}/convert-to-contract`

**Required Role:** **MANAGER** or higher

**Response if unauthorized:**
```json
HTTP 403 Forbidden

{
  "error": "Converting a tender to contract requires Manager role. You are Staff.",
  "code": "INSUFFICIENT_ROLE",
  "requiredRole": "Manager",
  "userRole": "Staff"
}
```

---

## Implementation Details

### 1. Status Machine Updates (`lib/status-machine.js`)

Added three permission matrices:
- `TENDER_TRANSITION_PERMISSIONS` - Maps tender transitions to required roles
- `CONTRACT_APPOINTMENT_TRANSITION_PERMISSIONS` - Maps appointment status transitions
- `CONTRACT_INSTRUCTION_TRANSITION_PERMISSIONS` - Maps instruction status transitions

All validation functions now accept optional `userRole` parameter:
```javascript
validateTenderTransition(currentStatus, newStatus, userRole)
validateContractAppointmentTransition(currentStatus, newStatus, userRole)
validateContractInstructionTransition(currentStatus, newStatus, userRole)
```

Returns detailed error object on permission failure:
```javascript
{
  isValid: false,
  error: "This transition requires Manager role. You are Staff.",
  code: 'INSUFFICIENT_ROLE',
  requiredRole: 1,        // ROLES.MANAGER
  userRole: 0             // ROLES.STAFF
}
```

### 2. Role Utility Functions (`lib/roles.js`)

New utility file with helpers:
- `getUserRoleFromSession(session)` - Extract and convert role from session
- `roleStringToValue(roleString)` - Convert string ('staff', 'manager', 'admin') to numeric
- `canUserTransition()` - Check if user can make specific transition
- `getTransitionRequiredRoleName()` - Get human-readable required role for transition

### 3. API Route Protection

#### Tender Update (`app/api/tenders/[id]/route.js`)
```javascript
const userRole = getUserRoleFromSession(session)
const validation = validateTenderTransition(existing.status, body.status, userRole)

if (!validation.isValid && validation.code === 'INSUFFICIENT_ROLE') {
  return Response.json({...}, { status: 403 })  // Forbidden
}
```

#### Contract Update (`app/api/contracts/[id]/route.js`)
```javascript
const userRole = getUserRoleFromSession(session)

// Check both appointment and instruction status with role
const appointmentValidation = validateContractAppointmentTransition(
  existing.appointmentStatus,
  body.appointmentStatus,
  userRole
)
```

#### Convert to Contract (`app/api/tenders/[id]/convert-to-contract/route.js`)
```javascript
const userRole = getUserRoleFromSession(session)
if (userRole < ROLES.MANAGER) {
  return Response.json({
    error: `Converting requires Manager role...`,
    code: 'INSUFFICIENT_ROLE'
  }, { status: 403 })
}
```

### 4. UI Components

#### TenderStatusSelector
Component for selecting tender status with RBAC feedback:
```javascript
<TenderStatusSelector
  currentStatus={tender.status}
  value={form.status}
  onChange={handleStatusChange}
  userRole={getUserRoleFromSession(session)}
  showHelperText={true}
/>
```

Disabled options show required role:
```
Under Review → In Progress (requires Manager)
```

#### ContractAppointmentStatusSelector & ContractInstructionStatusSelector
Similar components for contract statuses with role-aware option disabling.

---

## Audit Trail

All status changes now record the user's role:
- `TenderStatusChange.userRole` - Role of user who changed status
- `ContractStatusChange.userRole` - Role of user who changed status

Timeline displays role information:
```
John Doe (Manager) → Changed status from Under Review → In Progress
Sarah Smith (Staff) → Changed status from Instruction Received → Work Complete ❌ (would fail)
```

---

## Error Responses

### API Returns 403 Forbidden when:
- STAFF attempts to transition from Under Review → In Progress
- STAFF attempts to convert tender to contract
- STAFF attempts to mark contract as Work Complete

Example response:
```json
{
  "error": "This transition requires Manager role. You are Staff.",
  "code": "INSUFFICIENT_ROLE",
  "requiredRole": "Manager",
  "userRole": "Staff"
}
```

### API Returns 400 Bad Request when:
- Attempting invalid state transition (role-agnostic validation)
- Status already set to requested value
- Unknown status value

---

## Testing - Dry Run Verification

### Test Case 1: STAFF User Cannot Convert Tender
```bash
# Assume user has staff role (role: 'staff' in session)
# Tender is in "Submitted" status

curl -X POST http://localhost:3000/api/tenders/123/convert-to-contract \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <staff-session-token>" \
  -d '{
    "appointmentStatus": "Appointed",
    "appointmentDate": "2026-05-15"
  }'

# Expected Response: 403 Forbidden
{
  "error": "Converting a tender to contract requires Manager role. You are Staff.",
  "code": "INSUFFICIENT_ROLE",
  "requiredRole": "Manager",
  "userRole": "Staff"
}
```

### Test Case 2: MANAGER Can Convert Tender ✅
```bash
# Assume user has manager role (role: 'manager' in session)
# Tender is in "Submitted" status

curl -X POST http://localhost:3000/api/tenders/123/convert-to-contract \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <manager-session-token>" \
  -d '{
    "appointmentStatus": "Appointed",
    "appointmentDate": "2026-05-15"
  }'

# Expected Response: 201 Created
{
  "success": true,
  "contractId": 456,
  "contract": { ... }
}
```

### Test Case 3: STAFF Cannot Change Tender to "In Progress"
```bash
# Assume user has staff role
# Tender is in "Under Review" status

curl -X PATCH http://localhost:3000/api/tenders/123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <staff-session-token>" \
  -d '{ "status": "In Progress" }'

# Expected Response: 403 Forbidden
{
  "error": "This transition requires Manager role. You are Staff.",
  "code": "INSUFFICIENT_ROLE",
  "requiredRole": "Manager",
  "userRole": "Staff"
}
```

### Test Case 4: STAFF Can Move to Under Review
```bash
# Assume user has staff role
# Tender is in "New" status

curl -X PATCH http://localhost:3000/api/tenders/123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <staff-session-token>" \
  -d '{ "status": "Under Review" }'

# Expected Response: 200 OK
{ ... tender object ... }
```

### Test Case 5: UI Shows Disabled Options
When a STAFF user edits a tender in "Under Review" status:
- "New" option (no backward transition) - Greyed out
- "Under Review" option - Current, selected
- "In Progress" option - **Disabled with tooltip "requires Manager"**
- "Submitted" option - **Disabled with tooltip "requires Manager"**

---

## Backward Compatibility

✅ **Zero Breaking Changes**
- All existing API calls continue to work
- Old code that doesn't pass userRole defaults to STAFF (safe-by-default)
- Non-restrictive transitions (e.g., New → Under Review) work for STAFF as before
- Existing data unaffected

✅ **Webhooks Preserved**
- Role information now included in webhook payloads
- Downstream integrations can see who approved (and at what role level)

✅ **Audit Trail Preserved**
- Status change history shows role of person who made change
- Timeline components display role badges

---

## Future Enhancements

1. **Role Assignment UI** - Admin panel to assign/revoke roles
2. **Audit Reports** - Track who changed what and at what role level
3. **Custom Workflows** - Allow admins to modify permission matrices
4. **Role-Based Notifications** - Send approval requests to managers
5. **SLA Tracking** - Track time in each stage by approver role

---

## Technical Notes

### Session Role Field
The implementation assumes `session.role` exists and contains one of:
- `'staff'` / `'user'` (case-insensitive)
- `'manager'` (case-insensitive)
- `'admin'` (case-insensitive)

If role is missing, defaults to STAFF (secure default).

### ADMIN Bypass
Line in every validation:
```javascript
if (userRole === ROLES.ADMIN) return { isValid: true }
```

Admins **always** pass all checks.

### Fail-Secure Design
Transitions not explicitly defined in permission matrices are **DENIED**:
```javascript
if (requiredRole === undefined) {
  return { isValid: false, code: 'PERMISSION_NOT_DEFINED' }
}
```

---

## Monitoring

All restricted transitions are logged:
```javascript
void logActivity(
  `Status changed from "${existing.status}" to "${body.status}" by ${userRoleName}`,
  { userId: session.userId, tenderId: updated.id }
)
```

Check activity log for:
- Who made status changes (role recorded)
- Failed attempts (403 errors in API logs)
- Approval workflow timeline
