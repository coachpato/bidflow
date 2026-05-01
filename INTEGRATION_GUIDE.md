# Integration Guide: Status History & Validation

Quick reference for integrating the new status management features into your pages.

---

## 🔧 Adding Status History to Pages

### Tender Detail Page

```jsx
'use client'

import TenderStatusHistoryCard from '@/app/components/TenderStatusHistoryCard'

export default function TenderDetailPage({ params }) {
  const tenderId = parseInt(params.id, 10)

  return (
    <div className="space-y-6">
      {/* ... existing tender content ... */}

      {/* Add this section */}
      <section className="rounded-[24px] border border-slate-200 bg-white p-6">
        <TenderStatusHistoryCard tenderId={tenderId} />
      </section>
    </div>
  )
}
```

### Contract Detail Page

```jsx
'use client'

import ContractStatusHistoryCard from '@/app/components/ContractStatusHistoryCard'

export default function ContractDetailPage({ params }) {
  const contractId = parseInt(params.id, 10)

  return (
    <div className="space-y-6">
      {/* ... existing contract content ... */}

      {/* Add this section */}
      <section className="rounded-[24px] border border-slate-200 bg-white p-6">
        <ContractStatusHistoryCard contractId={contractId} />
      </section>
    </div>
  )
}
```

---

## 📝 Status Update Forms

### Tender Status Update

```jsx
'use client'

import { useState } from 'react'
import { getTenderNextStatuses, getTenderStatusDescription } from '@/lib/status-machine'

export function TenderStatusUpdater({ tender, onUpdate }) {
  const [newStatus, setNewStatus] = useState(tender.status)
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const allowedStatuses = getTenderNextStatuses(tender.status)

  async function handleUpdate() {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/tenders/${tender.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          statusChangeReason: reason || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update status')
      }

      const updated = await response.json()
      onUpdate(updated)
      setReason('') // Clear reason after success
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4 rounded-[20px] border border-slate-200 bg-white p-6">
      <div>
        <label className="block text-sm font-semibold text-slate-900">Status</label>
        <p className="mt-1 text-xs text-slate-600">
          {getTenderStatusDescription(tender.status)}
        </p>
        <select
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
          disabled={allowedStatuses.length === 0}
          className="mt-3 app-select"
        >
          <option value={tender.status}>{tender.status}</option>
          {allowedStatuses.map(status => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-900">Reason (Optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this status changing? e.g., 'Approved by review committee'"
          maxLength={200}
          className="mt-2 app-textarea"
          rows={2}
        />
        <p className="mt-1 text-xs text-slate-500">{reason.length}/200</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleUpdate}
        disabled={isLoading || newStatus === tender.status}
        className="app-button-primary w-full"
      >
        {isLoading ? 'Updating...' : 'Update Status'}
      </button>
    </div>
  )
}
```

### Contract Status Update

```jsx
'use client'

import { useState } from 'react'
import {
  getContractAppointmentNextStatuses,
  getContractInstructionNextStatuses,
  getContractAppointmentStatusDescription,
  getContractInstructionStatusDescription,
} from '@/lib/status-machine'

export function ContractStatusUpdater({ contract, onUpdate }) {
  const [appointmentStatus, setAppointmentStatus] = useState(contract.appointmentStatus)
  const [instructionStatus, setInstructionStatus] = useState(contract.instructionStatus)
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const allowedAppointmentStatuses = getContractAppointmentNextStatuses(contract.appointmentStatus)
  const allowedInstructionStatuses = getContractInstructionNextStatuses(contract.instructionStatus)

  async function handleUpdate() {
    try {
      setIsLoading(true)
      setError(null)

      const updates = {}
      if (appointmentStatus !== contract.appointmentStatus) {
        updates.appointmentStatus = appointmentStatus
      }
      if (instructionStatus !== contract.instructionStatus) {
        updates.instructionStatus = instructionStatus
      }
      if (reason) {
        updates.statusChangeReason = reason
      }

      if (Object.keys(updates).length === 0) {
        setError('No changes to save')
        return
      }

      const response = await fetch(`/api/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update status')
      }

      const updated = await response.json()
      onUpdate(updated)
      setReason('')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6 rounded-[20px] border border-slate-200 bg-white p-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Appointment Status */}
        <div>
          <label className="block text-sm font-semibold text-slate-900">
            Appointment Status
          </label>
          <p className="mt-1 text-xs text-slate-600">
            {getContractAppointmentStatusDescription(contract.appointmentStatus)}
          </p>
          <select
            value={appointmentStatus}
            onChange={(e) => setAppointmentStatus(e.target.value)}
            disabled={allowedAppointmentStatuses.length === 0}
            className="mt-3 app-select"
          >
            <option value={contract.appointmentStatus}>
              {contract.appointmentStatus}
            </option>
            {allowedAppointmentStatuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        {/* Instruction Status */}
        <div>
          <label className="block text-sm font-semibold text-slate-900">
            Instruction Status
          </label>
          <p className="mt-1 text-xs text-slate-600">
            {getContractInstructionStatusDescription(contract.instructionStatus)}
          </p>
          <select
            value={instructionStatus}
            onChange={(e) => setInstructionStatus(e.target.value)}
            disabled={allowedInstructionStatuses.length === 0}
            className="mt-3 app-select"
          >
            <option value={contract.instructionStatus}>
              {contract.instructionStatus}
            </option>
            {allowedInstructionStatuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-900">
          Reason (Optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are these statuses changing?"
          maxLength={200}
          className="mt-2 app-textarea"
          rows={2}
        />
        <p className="mt-1 text-xs text-slate-500">{reason.length}/200</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleUpdate}
        disabled={isLoading || (appointmentStatus === contract.appointmentStatus && instructionStatus === contract.instructionStatus)}
        className="app-button-primary w-full"
      >
        {isLoading ? 'Updating...' : 'Update Status'}
      </button>
    </div>
  )
}
```

---

## 🧪 Testing Status Transitions

### Test Valid Transition

```bash
curl -X PATCH http://localhost:3000/api/tenders/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Under Review",
    "statusChangeReason": "Internal review approved"
  }'

# Expected: 200 with updated tender
```

### Test Invalid Transition

```bash
curl -X PATCH http://localhost:3000/api/tenders/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "New"}'

# Expected: 400 with error message
# "Cannot transition from 'Under Review' to 'New'. Valid transitions: In Progress, Submitted"
```

### Test Status History

```bash
curl http://localhost:3000/api/tenders/1/status-history?limit=10

# Expected: 200 with paginated status changes
```

---

## 📊 State Management Quick Reference

### Import Helpers

```javascript
import {
  // Status enums
  TENDER_STATUSES,
  CONTRACT_APPOINTMENT_STATUSES,
  CONTRACT_INSTRUCTION_STATUSES,
  
  // Validation functions
  validateTenderTransition,
  validateContractAppointmentTransition,
  validateContractInstructionTransition,
  
  // Query functions
  getTenderNextStatuses,
  getContractAppointmentNextStatuses,
  getContractInstructionNextStatuses,
  
  // Display functions
  getTenderStatusDescription,
  getContractAppointmentStatusDescription,
  getContractInstructionStatusDescription,
  
  // Business logic
  getTenderProgressPercentage,
  canConvertTenderToContract,
  isContractComplete,
  isContractActive,
} from '@/lib/status-machine'
```

### Common Patterns

```javascript
// Check if status change is allowed
const { isValid, error } = validateTenderTransition('New', 'In Progress')
if (!isValid) {
  console.error(error) // Helpful message
}

// Get allowed next statuses
const nextStatuses = getTenderNextStatuses('Under Review')
// ['In Progress', 'Submitted']

// Calculate progress
const progress = getTenderProgressPercentage('In Progress') // 75

// Check if conversion allowed
if (canConvertTenderToContract(tender.status)) {
  // Show "Convert to Contract" button
}

// Check if contract is complete
const isComplete = isContractComplete(
  contract.appointmentStatus,
  contract.instructionStatus
)
```

---

## 🎨 Styling Customization

### Override Timeline Colors

```css
/* In your global CSS or Tailwind config */

/* Recent change indicator */
.timeline-event-recent .timeline-dot {
  @apply shadow-emerald-200;
}

.timeline-event-recent .timeline-pulse {
  @apply bg-emerald-400;
}

/* Custom theme color */
.timeline-event-primary .timeline-dot {
  @apply bg-gradient-to-br from-purple-400 to-purple-500;
}
```

### Adjust Spacing

```jsx
// TenderStatusHistoryCard with custom spacing
<section className="rounded-[24px] border border-slate-200 bg-white p-8">
  <TenderStatusHistoryCard tenderId={tenderId} />
</section>
```

---

## 🐛 Troubleshooting

### Issue: "Cannot fetch status history"

**Solution**: Check that tenderId/contractId is correctly passed as integer
```jsx
const tenderId = parseInt(params.id, 10) // Make sure it's a number!
<TenderStatusHistoryCard tenderId={tenderId} />
```

### Issue: "Status transition not allowed"

**Solution**: Check the TRANSITIONS rules in status-machine.js
```javascript
// Current status → allowed next statuses
const { isValid, error } = validateTenderTransition(current, desired)
console.log(error) // Read the helpful error message
```

### Issue: History not updating after status change

**Solution**: The API endpoint might be cached. Check cache headers:
```javascript
// In status-history endpoint
headers: {
  'Cache-Control': 'private, no-store', // Prevents caching
}
```

---

## 📚 Additional Resources

- **status-machine.js**: Complete state definition and helpers
- **StatusHistoryTimeline.js**: Timeline component (reusable)
- **PRODUCTION_READINESS_REPORT.md**: Full technical details
- **IMPLEMENTATION_PROGRESS.md**: API documentation

---

## ✅ Checklist: "I've Integrated Status History"

- [ ] Added TenderStatusHistoryCard to tender detail page
- [ ] Added ContractStatusHistoryCard to contract detail page
- [ ] Updated tender status form to show validation errors
- [ ] Updated contract status form to show validation errors
- [ ] Tested valid status transitions
- [ ] Tested invalid status transitions (confirm error message)
- [ ] Confirmed status history timeline appears
- [ ] Expanded a history event to see full details
- [ ] Tested reason field (optional)
- [ ] Confirmed dark mode works correctly

