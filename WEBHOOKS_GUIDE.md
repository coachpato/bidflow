# Webhooks System: Complete Integration Guide

**Status**: ✅ Production-Ready  
**Feature**: Automatic status change notifications to external systems  
**Build**: ✅ Passing

---

## Overview

Bid360's webhook system enables real-time integration with external services. When a tender or contract status changes, webhooks are automatically dispatched to registered endpoints.

**Perfect for**:
- Slack notifications
- Zapier/Make.com automations
- Custom backend integrations
- CRM synchronization
- Workflow automation

---

## Quick Start

### 1. Register a Webhook Endpoint

```bash
curl -X POST http://localhost:3000/api/webhooks/endpoints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "url": "https://your-api.com/webhooks/bid360",
    "events": [
      "tender.status_changed",
      "contract.appointment_status_changed",
      "contract.instruction_status_changed"
    ]
  }'

# Response: 201 Created
# {
#   "id": 1,
#   "url": "https://your-api.com/webhooks/bid360",
#   "events": ["tender.status_changed", ...],
#   "isActive": true,
#   "createdAt": "2026-04-21T18:30:00Z"
# }
```

### 2. Start Receiving Webhooks

Your endpoint will receive POST requests when status changes occur:

```json
{
  "event": "tender.status_changed",
  "organizationId": 5,
  "resourceType": "tender",
  "resourceId": 123,
  "webhookId": "tender.status_changed-123-1713706200000",
  "timestamp": "2026-04-21T18:30:00Z",
  "data": {
    "tender": {
      "id": 123,
      "title": "Electrical Engineering Services",
      "reference": "TENDER-2026-001",
      "entity": "Department of Transport",
      "status": "Submitted"
    },
    "previousStatus": "In Progress",
    "newStatus": "Submitted",
    "reason": "Ready for final submission after internal review",
    "changedBy": {
      "id": 7,
      "name": "John Doe",
      "email": "john@firm.com"
    }
  }
}
```

### 3. Enable Webhook Processing

Set up a cron job to process queued webhooks (run every minute):

```bash
# Add to your cron scheduler (EasyCron, AWS EventBridge, etc.)

*/1 * * * * curl -X POST https://your-app.com/api/webhooks/process \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## API Reference

### List Webhook Endpoints

```bash
GET /api/webhooks/endpoints

# Response: 200 OK
# [
#   {
#     "id": 1,
#     "url": "https://your-api.com/webhooks",
#     "events": ["tender.status_changed"],
#     "isActive": true,
#     "createdAt": "2026-04-21T18:30:00Z"
#   }
# ]
```

### Update Webhook Endpoint

```bash
PATCH /api/webhooks/endpoints/1 \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false,
    "events": ["tender.status_changed", "contract.completed"]
  }'

# Response: 200 OK
```

### Delete Webhook Endpoint

```bash
DELETE /api/webhooks/endpoints/1

# Response: 200 OK { "success": true }
```

### Process Queued Webhooks

```bash
POST /api/webhooks/process \
  -H "Authorization: Bearer $CRON_SECRET"

# Response: 200 OK
# {
#   "success": true,
#   "message": "Webhooks processed",
#   "duration": "234ms"
# }
```

### Webhook Health Check

```bash
GET /api/webhooks/process

# Response: 200 OK
# {
#   "status": "healthy",
#   "pending": 0,
#   "failed": 2,
#   "timestamp": "2026-04-21T18:30:00Z"
# }
```

---

## Webhook Events

### Tender Events

#### `tender.status_changed`
Fired when tender status transitions (New → Under Review → In Progress → Submitted)

```json
{
  "event": "tender.status_changed",
  "data": {
    "tender": { "id": 123, "title": "...", "status": "Submitted" },
    "previousStatus": "In Progress",
    "newStatus": "Submitted",
    "reason": "Ready for submission",
    "changedBy": { "id": 7, "name": "John Doe", "email": "john@firm.com" }
  }
}
```

### Contract Events

#### `contract.appointment_status_changed`
Fired when appointment status changes (Pending → Appointed → Not Appointed)

```json
{
  "event": "contract.appointment_status_changed",
  "data": {
    "contract": { "id": 456, "title": "...", "appointmentStatus": "Appointed" },
    "fieldChanged": "appointmentStatus",
    "previousValue": "Pending",
    "newValue": "Appointed",
    "reason": "Client confirmed appointment",
    "changedBy": { "id": 7, "name": "John Doe", "email": "john@firm.com" }
  }
}
```

#### `contract.instruction_status_changed`
Fired when instruction status changes (No Instruction → Instruction Received → Work Complete)

```json
{
  "event": "contract.instruction_status_changed",
  "data": {
    "contract": { "id": 456, "title": "...", "instructionStatus": "Work Complete" },
    "fieldChanged": "instructionStatus",
    "previousValue": "Instruction Received",
    "newValue": "Work Complete",
    "reason": "All deliverables completed",
    "changedBy": { "id": 7, "name": "John Doe", "email": "john@firm.com" }
  }
}
```

---

## Reliable Delivery

### How It Works

1. **Status changes** → Webhook queued to database
2. **Every minute** → Cron job processes queue
3. **Retry logic** → Exponential backoff (1s, 5s, 30s)
4. **Max retries** → 3 attempts total
5. **Failure tracking** → Failed deliveries recorded
6. **Idempotency** → Duplicate webhooks detected via `webhookId`

### Idempotency

Each webhook has a unique `webhookId`:

```
tender.status_changed-123-1713706200000
```

If your endpoint receives the same `webhookId` twice, it's a duplicate. Your endpoint should:

```javascript
// Example: Express.js
router.post('/webhooks/bid360', async (req, res) => {
  const { webhookId, event, data } = req.body

  // Check if already processed
  const existing = await db.webhookDelivery.findOne({ webhookId })
  if (existing) {
    return res.status(200).json({ message: 'Already processed' })
  }

  // Process webhook
  await processWebhook(event, data)

  // Store delivery record
  await db.webhookDelivery.create({ webhookId, processedAt: new Date() })

  res.status(200).json({ success: true })
})
```

### Retry Strategy

Webhooks are retried with exponential backoff:

- **Attempt 1**: Immediate
- **Attempt 2**: After 1 second
- **Attempt 3**: After 5 seconds  
- **Attempt 4**: After 30 seconds
- **Failed**: Marked as failed after 4th attempt

Server errors (5xx) are retried. Client errors (4xx) fail immediately.

---

## Integration Examples

### Slack Integration via Zapier

1. Create Zap: "Catch Webhook" → Slack message
2. Copy Zapier webhook URL
3. Register endpoint:

```bash
curl -X POST http://localhost:3000/api/webhooks/endpoints \
  -d '{
    "url": "https://hooks.zapier.com/hooks/catch/...",
    "events": ["tender.status_changed", "contract.appointment_status_changed"]
  }'
```

4. Zapier will send formatted Slack messages automatically

### Custom Backend Integration

```javascript
// Node.js + Express
const express = require('express')
const app = express()

app.post('/webhooks/bid360', express.json(), async (req, res) => {
  const { event, data, webhookId } = req.body

  try {
    // Prevent duplicate processing
    const processed = await cache.get(`webhook:${webhookId}`)
    if (processed) return res.status(200).json({ cached: true })

    // Handle different events
    switch (event) {
      case 'tender.status_changed':
        await handleTenderStatusChange(data)
        break
      case 'contract.appointment_status_changed':
        await handleContractStatusChange(data)
        break
    }

    // Mark as processed
    await cache.set(`webhook:${webhookId}`, true, { EX: 86400 })

    res.status(200).json({ success: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    // Return 5xx to trigger retry
    res.status(500).json({ error: error.message })
  }
})

async function handleTenderStatusChange(data) {
  const { tender, newStatus, changedBy } = data
  
  // Sync to your database
  await db.tenders.update(tender.id, {
    status: newStatus,
    syncedAt: new Date(),
  })

  // Send notifications
  await notifications.send({
    to: 'team@firm.com',
    subject: `Tender "${tender.title}" moved to ${newStatus}`,
    body: `Changed by ${changedBy.name} at ${new Date().toISOString()}`,
  })
}

app.listen(3000)
```

### Google Sheets Integration

Use Zapier or Integromat to:
1. Receive webhook from Bid360
2. Append row to Google Sheet
3. Automatically update KPI dashboard

---

## Monitoring & Debugging

### Check Webhook Health

```bash
curl http://localhost:3000/api/webhooks/process

# Response:
# {
#   "status": "healthy",
#   "pending": 2,       # Waiting to send
#   "failed": 0,        # Failed permanently
#   "timestamp": "2026-04-21T18:30:00Z"
# }
```

### View Failed Deliveries

```sql
SELECT * FROM "webhookDelivery"
WHERE status = 'failed'
ORDER BY createdAt DESC
LIMIT 10;
```

### Retry Failed Webhooks

```sql
UPDATE "webhookDelivery"
SET status = 'pending',
    attempts = 0,
    nextRetryAt = NOW()
WHERE id IN (...)
```

---

## Security Considerations

### HTTPS Required

All webhook URLs **must use HTTPS**. The API rejects HTTP endpoints.

```bash
# ✅ Allowed
https://your-api.com/webhooks

# ❌ Rejected
http://your-api.com/webhooks
```

### Authentication

Webhooks include the organization context. Verify:
1. `organizationId` matches your configuration
2. `webhookId` hasn't been processed before (idempotency)
3. Handle errors gracefully (return 5xx to retry)

### HMAC Signing (Future)

Future version will support HMAC-SHA256 signing. For now:
- Keep your webhook endpoint secret (not in public repos)
- Validate `webhookId` to prevent duplicates
- Use HTTPS to encrypt transmission

---

## Troubleshooting

### Webhooks Not Being Sent

1. **Check endpoint is active**:
   ```bash
   GET /api/webhooks/endpoints
   ```

2. **Check events are registered**:
   ```bash
   # Endpoint must have these events:
   # - tender.status_changed
   # - contract.appointment_status_changed
   # - contract.instruction_status_changed
   ```

3. **Check cron job is running**:
   ```bash
   GET /api/webhooks/process
   # Should show status: "healthy"
   ```

4. **Check webhook delivery status**:
   ```sql
   SELECT * FROM "webhookDelivery"
   WHERE webhookUrl = 'your-url'
   ORDER BY createdAt DESC
   LIMIT 5;
   ```

### Duplicate Webhooks

If receiving duplicate webhooks:
1. Check `webhookId` matches exactly
2. May be second retry attempt - implement idempotency
3. Check your endpoint returns 200 OK

### Endpoint Not Receiving Webhooks

1. Verify URL is HTTPS
2. Verify endpoint returns 2xx status code
3. Check firewall/network allows incoming requests
4. Enable request logging in webhook processor

---

## Best Practices

✅ **Do**:
- Implement idempotency check (use `webhookId`)
- Return 2xx for success, 5xx for transient errors
- Process webhooks asynchronously
- Log all webhook deliveries
- Monitor webhook health dashboard
- Set request timeout (webhook processing is fast, <1s)

❌ **Don't**:
- Use HTTP (only HTTPS allowed)
- Process webhooks synchronously in request handler
- Ignore `webhookId` (causes duplicate processing)
- Return 4xx on transient errors (won't retry)
- Store webhook credentials in code

---

## API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/webhooks/endpoints` | List registered endpoints |
| POST | `/api/webhooks/endpoints` | Register new endpoint |
| PATCH | `/api/webhooks/endpoints/:id` | Update endpoint |
| DELETE | `/api/webhooks/endpoints/:id` | Remove endpoint |
| POST | `/api/webhooks/process` | Process queued webhooks (cron) |
| GET | `/api/webhooks/process` | Health check |

---

## Environment Variables

```bash
# Required for cron processing
CRON_SECRET="your-secret-token"

# Used to authenticate webhook endpoints
# (Users authenticate with session, not directly)
```

---

## Next Steps

1. **Register your first endpoint** - Use the Quick Start section
2. **Set up cron job** - Configure to run `/api/webhooks/process` every minute
3. **Implement your handler** - Receive and process webhooks
4. **Test in staging** - Verify webhooks work before production
5. **Monitor health** - Watch `/api/webhooks/process` endpoint

---

**Support**: For issues or questions, check the webhook delivery records in the database or contact engineering.
