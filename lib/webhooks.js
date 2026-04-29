/**
 * Webhook System: Send status change notifications to external systems
 * Enables integrations with Slack, Zapier, custom backends, etc.
 */

import { logger } from './logger'

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 5000, 30000] // 1s, 5s, 30s (exponential backoff)

/**
 * Webhook event types
 */
export const WEBHOOK_EVENTS = {
  TENDER_CREATED: 'tender.created',
  TENDER_STATUS_CHANGED: 'tender.status_changed',
  TENDER_CONVERTED_TO_CONTRACT: 'tender.converted_to_contract',
  CONTRACT_CREATED: 'contract.created',
  CONTRACT_APPOINTMENT_STATUS_CHANGED: 'contract.appointment_status_changed',
  CONTRACT_INSTRUCTION_STATUS_CHANGED: 'contract.instruction_status_changed',
  CONTRACT_COMPLETED: 'contract.completed',
}

export function shouldSendWebhooks() {
  return process.env.ENABLE_OUTBOUND_WEBHOOKS === 'true'
}

/**
 * Webhook webhook payload structure
 */
export function buildWebhookPayload({
  event,
  organizationId,
  resourceType,
  resourceId,
  data,
  timestamp = new Date().toISOString(),
}) {
  return {
    event,
    organizationId,
    resourceType, // 'tender' | 'contract'
    resourceId,
    data,
    timestamp,
    webhookId: `${event}-${resourceId}-${Date.now()}`, // Idempotency key
  }
}

/**
 * Build tender status change webhook payload
 */
export function buildTenderStatusChangePayload({
  tender,
  fromStatus,
  toStatus,
  changedBy,
  reason,
  organizationId,
}) {
  return buildWebhookPayload({
    event: WEBHOOK_EVENTS.TENDER_STATUS_CHANGED,
    organizationId,
    resourceType: 'tender',
    resourceId: tender.id,
    data: {
      tender: {
        id: tender.id,
        title: tender.title,
        reference: tender.reference,
        entity: tender.entity,
        status: toStatus, // Current status
      },
      previousStatus: fromStatus,
      newStatus: toStatus,
      reason,
      changedBy: {
        id: changedBy.id,
        name: changedBy.name,
        email: changedBy.email,
      },
    },
  })
}

/**
 * Build contract status change webhook payload
 */
export function buildContractStatusChangePayload({
  contract,
  fieldName, // 'appointmentStatus' | 'instructionStatus'
  oldValue,
  newValue,
  changedBy,
  reason,
  organizationId,
}) {
  const eventMap = {
    appointmentStatus: WEBHOOK_EVENTS.CONTRACT_APPOINTMENT_STATUS_CHANGED,
    instructionStatus: WEBHOOK_EVENTS.CONTRACT_INSTRUCTION_STATUS_CHANGED,
  }

  return buildWebhookPayload({
    event: eventMap[fieldName] || WEBHOOK_EVENTS.CONTRACT_CREATED,
    organizationId,
    resourceType: 'contract',
    resourceId: contract.id,
    data: {
      contract: {
        id: contract.id,
        title: contract.title,
        client: contract.client,
        appointmentStatus: contract.appointmentStatus,
        instructionStatus: contract.instructionStatus,
      },
      fieldChanged: fieldName,
      previousValue: oldValue,
      newValue,
      reason,
      changedBy: {
        id: changedBy.id,
        name: changedBy.name,
        email: changedBy.email,
      },
    },
  })
}

/**
 * Dispatch webhook to external endpoint
 * Implements retry logic with exponential backoff
 */
export async function dispatchWebhook(webhookUrl, payload, attempt = 0) {
  if (!shouldSendWebhooks()) {
    logger.info('[Webhook] Outbound webhooks disabled by environment; skipping dispatch.')
    return { success: true, skipped: true, reason: 'Webhooks disabled by environment' }
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Bid360/1.0',
        'X-Webhook-Id': payload.webhookId,
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })

    if (response.ok) {
      return { success: true, statusCode: response.status }
    }

    // Retry on server errors (5xx) but not client errors (4xx)
    if (response.status >= 500 && attempt < MAX_RETRIES) {
      const delayMs = RETRY_DELAYS[attempt]
      logger.info(
        `[Webhook] ${response.status} from ${webhookUrl}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
      )
      await sleep(delayMs)
      return dispatchWebhook(webhookUrl, payload, attempt + 1)
    }

    return {
      success: false,
      statusCode: response.status,
      error: `HTTP ${response.status}: ${response.statusText}`,
    }
  } catch (error) {
    // Retry on network errors
    if (attempt < MAX_RETRIES) {
      const delayMs = RETRY_DELAYS[attempt]
      logger.info(
        `[Webhook] Network error: ${error.message}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
      )
      await sleep(delayMs)
      return dispatchWebhook(webhookUrl, payload, attempt + 1)
    }

    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Queue a webhook for async dispatch
 * Stores in database for reliable delivery
 */
export async function queueWebhook(prisma, {
  organizationId,
  event,
  payload,
  webhookUrl,
}) {
  try {
    if (!shouldSendWebhooks()) {
      logger.info('[Webhook] Outbound webhooks disabled by environment; skipping queue.')
      return { success: true, skipped: true, reason: 'Webhooks disabled by environment' }
    }

    // Check if webhook delivery already exists (idempotency)
    const existing = await prisma.webhookDelivery.findFirst({
      where: {
        webhookId: payload.webhookId,
      },
    })

    if (existing) {
      logger.info(`[Webhook] Duplicate webhook ${payload.webhookId}, skipping`)
      return existing
    }

    // Store webhook delivery record
    const delivery = await prisma.webhookDelivery.create({
      data: {
        organizationId,
        event,
        webhookUrl,
        payload,
        status: 'pending',
        attempts: 0,
        nextRetryAt: new Date(),
      },
    })

    return delivery
  } catch (error) {
    console.error('[Webhook] Error queuing webhook:', error)
    throw error
  }
}

/**
 * Process queued webhooks
 * Should be called by a background job (e.g., Cron)
 */
export async function processQueuedWebhooks(prisma) {
  if (!shouldSendWebhooks()) {
    logger.info('[Webhook] Outbound webhooks disabled by environment; skipping queued delivery processing.')
    return { processed: 0, skipped: true, reason: 'Webhooks disabled by environment' }
  }

  const now = new Date()

  // Find pending webhooks ready to retry
  const pending = await prisma.webhookDelivery.findMany({
    where: {
      status: 'pending',
      nextRetryAt: { lte: now },
      attempts: { lt: MAX_RETRIES },
    },
    take: 100, // Process in batches
  })

  logger.info(`[Webhook] Processing ${pending.length} queued webhooks`)

  for (const delivery of pending) {
    const result = await dispatchWebhook(delivery.webhookUrl, delivery.payload)

    const nextAttempt = delivery.attempts + 1
    const isSuccess = result.success
    const hasMoreRetries = nextAttempt < MAX_RETRIES

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: isSuccess ? 'delivered' : (hasMoreRetries ? 'pending' : 'failed'),
        attempts: nextAttempt,
        deliveredAt: isSuccess ? now : null,
        failureReason: !isSuccess ? result.error : null,
        nextRetryAt: hasMoreRetries
          ? new Date(now.getTime() + RETRY_DELAYS[nextAttempt - 1])
          : null,
      },
    })

    if (isSuccess) {
      logger.info(`[Webhook] Delivered ${delivery.event} to ${delivery.webhookUrl}`)
    } else if (hasMoreRetries) {
      logger.info(`[Webhook] Retrying ${delivery.event} (attempt ${nextAttempt}/${MAX_RETRIES})`)
    } else {
      console.error(`[Webhook] Failed ${delivery.event} after ${MAX_RETRIES} attempts`)
    }
  }

  return { processed: pending.length, skipped: false }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

