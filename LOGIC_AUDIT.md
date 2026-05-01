# Bid360: Logic & State Management Audit
## Opportunity → Pursuit → Contract Workflow

---

## 1. DATA MODEL ARCHITECTURE

### Core Flow
```
Opportunity (auto-discovered via scraper)
    ↓ (convert action)
Tender (pursuit - actively tracked)
    ↓ (win action)
Contract (appointment won & managed)
```

### Key Relationships
- **Opportunity → Tender**: One-to-One (optional, `opportunityId` UNIQUE on Tender)
- **Tender → Contract**: One-to-One (optional, `tenderId` UNIQUE on Contract)
- **Appeal**: Can attach to Tender at any stage

---

## 2. OPPORTUNITY STAGE (Discovery)

### Data Model
```prisma
model Opportunity {
  id: Int (PK)
  title: String
  reference: String?
  entity: String
  status: String ["New", "Watch", "Pursue", "Ignore", "Converted"]
  fitScore: Int?  // 0-100, AI-generated
  deadline: DateTime?
  briefingDate: DateTime?
  siteVisitDate: DateTime?
  practiceArea: String?
  summary: String?
  notes: String?
  estimatedValue: Float?
  
  // JSON fields for parsed data
  parsedRequirements: Json?
  parsedAppointments: Json?
  
  // Relationships
  organizationId: Int (FK)
  sourceId: Int? (FK) - Where it came from (eTenders.gov.za)
  sourceRunId: Int? (FK) - Which crawler run found it
  userId: Int? (FK) - Who created it (for manual entries)
  
  // Cascade relationships
  documents: OpportunityDocument[]
  matches: OpportunityMatch[]  // Matching scores per org
  tender: Tender? (ONE_TO_ONE)
}
```

### Creation Paths
1. **Auto-Discovery** (Scraper)
   - `POST /api/crawler` runs scheduled
   - Matches firm profile against tender details
   - Creates `OpportunityMatch` with fitScore
   - Auto-creates `Opportunity` if fitScore ≥ 40
   - Sends digest email with matches

2. **Manual Entry**
   - User creates via UI `/opportunities/new`
   - Sets status, deadline, entity manually
   - No fitScore (or manual score entry)

### Status Lifecycle
- **New**: Just discovered/created
- **Watch**: Firm is monitoring, not actively pursuing
- **Pursue**: Firm is actively working on this  
- **Ignore**: Firm decided not to pursue
- **Converted**: Converted to Tender (pursuit)

### ⚠️ ISSUES IDENTIFIED

1. **No Automatic Bidirectional Conversion**
   - If user changes Opportunity status to "Pursue", Tender is NOT auto-created
   - User must explicitly click "Convert to Pursuit" button
   - **Risk**: Multiple Tenders created for same Opportunity (not prevented)

2. **OpportunityMatch Mismatch**
   - `OpportunityMatch.reviewedAt` is only set when converting to Tender
   - If user changes status to "Ignored" or "Watched", `reviewedAt` never updates
   - **Impact**: Cannot track when opportunity was truly reviewed

3. **Missing Constraint**
   - Opportunity → Tender is UNIQUE but NOT ENFORCED
   - API returns 201 even if Tender already exists (idempotent but misleading)
   - No foreign key constraint prevents orphaned relationships

4. **No State Validation**
   - Can't convert "Ignored" or "Watch" opportunities to Tender
   - But no code checks this - relies on UI button hide logic
   - **Risk**: Direct API call can bypass validation

5. **Parsed Data Handling**
   - `parsedRequirements` and `parsedAppointments` are JSON fields
   - No schema validation for JSON content
   - Normalize functions in UI are defensive but brittle

---

## 3. TENDER STAGE (Pursuit)

### Data Model
```prisma
model Tender {
  id: Int (PK)
  title: String
  reference: String?
  entity: String
  description: String?
  status: String ["New", "Under Review", "In Progress", "Submitted"]
  deadline: DateTime?
  briefingDate: DateTime?
  contactPerson: String?
  contactEmail: String?
  
  // Assignment & tracking
  assignedTo: String?  // Name as string (DENORMALIZED - BAD)
  assignedUserId: Int? (FK) -> User
  notes: String?
  
  // Dates
  createdAt: DateTime
  updatedAt: DateTime
  
  // Relationships
  organizationId: Int (FK)
  userId: Int? (FK) - Created by user
  opportunityId: Int? (FK, UNIQUE) -> Opportunity
  assignedUser: User? -> User (TenderAssignee)
  
  // Cascade
  documents: TenderDocument[]
  checklistItems: TenderChecklistItem[]
  appeals: Appeal[]
  contract: Contract? (ONE_TO_ONE)
}
```

### Creation Path
When converting Opportunity to Tender (via `POST /opportunities/{id}/convert`):
1. Validates Opportunity exists & user has org access
2. Checks Tender not already created (idempotent)
3. Creates Tender with:
   - Title, reference, entity from Opportunity
   - Deadline, briefingDate from Opportunity
   - Status: "New"
   - assignedTo: Current user name
   - assignedUserId: Current user ID
   - notes: Compiled from Opportunity summary, source, fit score
4. Creates checklist items from:
   - Parsed requirements (as checklist items)
   - Briefing date (auto-add "Attend briefing" item)
   - Site visit date (auto-add "Attend site visit" item)
5. Copies documents from OpportunityDocument → TenderDocument
6. Updates Opportunity.status = "Converted"
7. Logs activity & invalidates cache

### State Lifecycle
- **New**: Just created from Opportunity
- **Under Review**: Internal review of viability
- **In Progress**: Actively working on submission
- **Submitted**: Submission complete, awaiting decision

### ⚠️ ISSUES IDENTIFIED

1. **Denormalized assignedTo Field**
   ```prisma
   assignedTo: String?      // DENORMALIZED (bad practice)
   assignedUserId: Int?     // Normalized (good)
   ```
   - `assignedTo` stores user NAME, not ID
   - If user name changes, `assignedTo` becomes stale
   - Expensive queries to find all tenders by user
   - **Solution**: Remove `assignedTo` field, use `assignedUserId` only

2. **No Validation on Status Transitions**
   - Can jump from "New" → "Submitted" directly
   - No enforcement of workflow (should be sequential)
   - **Code**: UI hides buttons, but API doesn't validate

3. **Checklist Item Generation is Lossy**
   - Only creates items for briefing & site visit dates
   - Other parsed requirements don't include due dates
   - Checklist items have no priority/importance weighting

4. **No Status History / Audit Trail**
   - Can't see when Tender status changed
   - `updatedAt` exists but no timestamp of actual changes
   - Must rely on `ActivityLog` (separate model) for history

5. **Missing Completion Indicators**
   - Tender has no `submittedAt` timestamp
   - Checklist items have `done` boolean but no `completedAt` date
   - Can't track when checklist items were actually completed

6. **No Contract Blocking**
   - Tender status can still change after Contract is created
   - No constraint preventing status change once Contract exists
   - **Risk**: Confusing state if Tender status changes after award

---

## 4. CONTRACT STAGE (Award & Management)

### Data Model
```prisma
model Contract {
  id: Int (PK)
  title: String
  client: String?
  
  // Appointment tracking
  appointmentStatus: String ["Appointed", "Not Appointed", "Pending"]
  appointmentDate: DateTime?
  
  // Work instruction tracking  
  instructionStatus: String ["No Instruction", "Instruction Received", "Work Complete"]
  firstInstructionDate: DateTime?
  
  // Contract lifecycle
  startDate: DateTime?
  endDate: DateTime?
  endDateReminderSentAt: DateTime?
  
  // Renewal tracking
  renewalDate: DateTime?
  renewalDateReminderSentAt: DateTime?
  cancelDate: DateTime?
  
  // Follow-up tracking
  lastFollowUpAt: DateTime?
  nextFollowUpAt: DateTime?
  nextFollowUpReminderSentAt: DateTime?
  dormantReminderSentAt: DateTime?
  
  // Business data
  value: Float?
  milestoneSummary: String?
  notes: String?
  
  // Relationships
  organizationId: Int (FK)
  tenderId: Int? (FK, UNIQUE) -> Tender
  assignedUserId: Int? (FK) -> User (ContractAssignee)
  
  // Cascade
  documents: ContractDocument[]
  milestones: ContractMilestone[]
  activities: ActivityLog[]
}

model ContractMilestone {
  id: Int (PK)
  title: String
  dueDate: DateTime?
  completedAt: DateTime?
  reminderSentAt: DateTime?
  notes: String?
}
```

### Creation Path
- NO API FOUND - Tender → Contract conversion must be manual
- Likely via UI form `/contracts/new` with tender link
- ⚠️ **CRITICAL**: Need to verify this exists

### State Complexity
- **Two parallel status tracks**:
  1. `appointmentStatus`: Appointed? (business outcome)
  2. `instructionStatus`: Got work? (engagement stage)
- **Timeline tracking**:
  - `startDate`, `endDate` (contract period)
  - `firstInstructionDate` (first work engagement)
  - `nextFollowUpAt` (proactive relationship management)
  - `renewalDate` (contract renewal)

### Reminder System
Multiple reminder timestamps suggest automated email system:
- `endDateReminderSentAt` - Contract expiring soon
- `renewalDateReminderSentAt` - Renewal deadline approaching
- `nextFollowUpReminderSentAt` - Follow-up due
- `dormantReminderSentAt` - No activity (reactivation)

### ⚠️ ISSUES IDENTIFIED

1. **No API Endpoint Found**
   - Searched `app/api/contracts/**` 
   - Found only fetch/list endpoints, no `POST /contracts`
   - **Risk**: Can't programmatically convert Tender → Contract
   - **Question**: Is this intentional (manual-only)?

2. **Two-Axis Status System is Confusing**
   - `appointmentStatus` + `instructionStatus` create 9 combinations
   - No clear state machine definition
   - Example: What does "Appointed, No Instruction" mean? For how long?
   - **UI Impact**: How do users select "status" if there are 2 independent fields?

3. **No Completion State**
   - Can't mark contract as "Complete" or "Closed"
   - `cancelDate` exists but no "status" to reflect cancellation
   - **Risk**: Active contracts list includes abandoned contracts

4. **Reminder System Lacks Verification**
   - Reminder sent `DateTime` is recorded but never cleared
   - If reminder email fails, system can't retry
   - No way to manually re-trigger reminders
   - **Question**: Is reminder system even implemented?

5. **No Validation on Milestones**
   - Can have 0 milestones
   - Milestones have no required fields except ID
   - `title` is String (required in schema) but no validation

6. **Missing Tender → Contract Transition Logic**
   - No check for contract already existing (unlike Opportunity → Tender)
   - Can create multiple contracts for same tender?
   - **Risk**: Data inconsistency

7. **No Audit Trail for Status Changes**
   - Like Tender, no timestamp of when appointmentStatus changed
   - Must infer from `firstInstructionDate` and other timestamps
   - Brittle and confusing

---

## 5. CROSS-CUTTING CONCERNS

### Activity Logging
✅ **Good**: `ActivityLog` model tracks major transitions
- Records user, timestamp, related entities
- Used in conversion endpoints
- Provides audit trail

⚠️ **Issues**:
- Not comprehensive (doesn't log all status changes)
- No rollback/audit capability
- Plain text `description` (hard to parse)

### Cache Invalidation
```javascript
await expireCacheTags(
  dashboardCacheTag(organizationId),
  tendersListCacheTag(organizationId),
  tenderDetailCacheTag(organizationId, tenderId)
)
```

✅ **Good**: Invalidates relevant caches on conversion
⚠️ **Issues**:
- Opportunity list cache not invalidated
- Could show stale data if user navigates back

### Document Management
- `OpportunityDocument` → `TenderDocument` (copied on conversion)
- `TenderDocument` → `ContractDocument` (manual copy? auto?)
- No deduplication or version control
- **Question**: How are documents linked between stages?

### User Assignment
- Opportunity: Optional `userId` (creator)
- Tender: Required `assignedUserId` (from conversion user)
- Contract: Optional `assignedUserId`
- **Problem**: Can't change assignment without separate update

---

## 6. MISSING FEATURES & RECOMMENDATIONS

### Critical Gaps
1. **Tender → Contract API**
   - No endpoint to convert Tender to Contract
   - Likely requires manual entry via UI
   - Should auto-transfer document references

2. **Status Machine Enforcement**
   - Add validation for allowed status transitions:
     ```
     Opportunity: New → (Watch | Pursue | Ignore) → Converted
     Tender: New → Under Review → In Progress → Submitted
     Contract: (Appointed|Pending) + (No Instruction|Instruction Received|Work Complete)
     ```

3. **Audit Trail / Event Sourcing**
   - Add timestamp to ALL status changes
   - Create separate `TenderStatusHistory`, `ContractStatusHistory`
   - Enable "Undo" capability for non-critical changes

4. **Workflow State Machine**
   - Define allowed transitions as code, not UI logic
   - Add pre-transition validation
   - Add post-transition side effects (emails, reminders)

5. **Reminder System Implementation**
   - Verify `endDateReminderSentAt` is actually used
   - Create scheduled job to send reminders
   - Track which reminders failed and retry
   - Make reminders retryable via admin UI

### Recommended Refactoring

#### 1. Remove Denormalized `assignedTo` Field
```prisma
// BEFORE
model Tender {
  assignedTo: String?        // User name (denormalized)
  assignedUserId: Int?       // User ID
}

// AFTER
model Tender {
  // Remove assignedTo field
  assignedUserId: Int?  @relation("TenderAssignee", ...)
}
```

#### 2. Add Status History Models
```prisma
model TenderStatusChange {
  id: Int @id @default(autoincrement())
  tenderId: Int
  fromStatus: String
  toStatus: String
  changedAt: DateTime @default(now())
  changedBy: Int (FK -> User)
  reason: String?
  metadata: Json?
}

model ContractStatusChange {
  id: Int @id @default(autoincrement())
  contractId: Int
  fieldName: String  // "appointmentStatus" | "instructionStatus"
  oldValue: String
  newValue: String
  changedAt: DateTime @default(now())
  changedBy: Int (FK -> User)
}
```

#### 3. Add Completion Tracking
```prisma
model Tender {
  // Add
  submittedAt: DateTime?
  submissionNotes: String?
}

model Contract {
  // Add
  completedAt: DateTime?
  statusLabel: String?  // "active" | "completed" | "cancelled"
}

model TenderChecklistItem {
  // Add
  completedAt: DateTime?
  completedBy: Int? (FK -> User)
}

model ContractMilestone {
  // Already has completedAt ✅
}
```

#### 4. Create Status Transition API
```typescript
// POST /api/tenders/{id}/status
async function updateTenderStatus(request, { params }) {
  const { status, reason } = await request.json()
  
  // Validate transition is allowed
  const allowed = TENDER_TRANSITIONS[currentStatus][status]
  if (!allowed) {
    return error(400, `Cannot transition from ${currentStatus} to ${status}`)
  }
  
  // Perform transition with side effects
  const tender = await prisma.tender.update({
    where: { id: tenderId },
    data: { status }
  })
  
  // Record history
  await prisma.tenderStatusChange.create({
    data: {
      tenderId,
      fromStatus: currentStatus,
      toStatus: status,
      changedBy: session.userId,
      reason,
      metadata: { timestamp: now() }
    }
  })
  
  // Trigger side effects
  if (status === 'Submitted') {
    await logActivity('Tender submitted', { tenderId })
    // TODO: send email notification
  }
}
```

#### 5. Tender → Contract Conversion Endpoint
```typescript
// POST /api/tenders/{id}/convert-to-contract
async function convertTenderToContract(request, { params }) {
  const { appointmentStatus, appointmentDate, value } = await request.json()
  
  // Prevent duplicate contracts
  const existing = await prisma.contract.findFirst({
    where: { tenderId: parseInt(params.id) }
  })
  if (existing) return error(400, 'Contract already exists')
  
  // Create contract
  const tender = await prisma.tender.findUnique({
    where: { id: parseInt(params.id) },
    include: { documents: true }
  })
  
  const contract = await prisma.contract.create({
    data: {
      title: tender.title,
      client: tender.entity,
      appointmentStatus,
      appointmentDate,
      value,
      organizationId: tender.organizationId,
      tenderId: tender.id,
      assignedUserId: session.userId,
      // Copy documents
      documents: {
        create: tender.documents.map(doc => ({
          filename: doc.filename,
          filepath: doc.filepath,
          documentType: 'SOURCE'
        }))
      },
      notes: `Converted from tender: ${tender.reference || tender.title}`
    }
  })
  
  // Update tender status
  await prisma.tender.update({
    where: { id: tender.id },
    data: { status: 'Submitted' }  // Or new status?
  })
  
  await logActivity('Tender converted to contract', { 
    tenderId: tender.id,
    contractId: contract.id
  })
  
  return { success: true, contractId: contract.id }
}
```

---

## 7. TESTING CHECKLIST

- [ ] Convert Opportunity with all fields to Tender
- [ ] Convert Opportunity that's already a Tender (idempotent)
- [ ] Can't convert "Ignored" Opportunity
- [ ] Checklist items created with correct dates
- [ ] Document references preserved
- [ ] Activity logged
- [ ] Cache invalidated
- [ ] Convert Tender to Contract
- [ ] Multiple Contracts per Tender prevented
- [ ] Status transitions validated
- [ ] Status history recorded
- [ ] Assignment changes tracked
- [ ] Reminders fire at correct times

---

## 8. SUMMARY

| Stage | Status | Data | Transitions | Issues |
|-------|--------|------|-------------|--------|
| Opportunity | ✅ Well modeled | Comprehensive | Limited validation | No bidirectional auto-convert |
| Tender | ⚠️ Has denormalization | Mostly good | No enforcement | Missing completion tracking |
| Contract | ⚠️ Two-axis status | Complex | No API | Reminder system unclear |

**Overall Assessment**: Logic is functional but lacks:
- Formal state machine
- Comprehensive audit trails
- Data consistency checks
- Automated workflows

**Priority Fixes**:
1. Add Tender → Contract API
2. Remove `assignedTo` denormalization
3. Add status history models
4. Enforce status transitions
5. Verify reminder system works
