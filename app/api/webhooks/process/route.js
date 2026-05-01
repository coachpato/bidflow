import prisma from '@/lib/prisma'
import { processQueuedWebhooks } from '@/lib/webhooks'

/**
 * POST /api/webhooks/process
 *
 * Cron endpoint to process queued webhooks
 * Should be called every minute by a Cron scheduler (e.g., EasyCron, AWS EventBridge)
 *
 * Authentication: Requires CRON_SECRET header
 * Usage: curl -X POST https://app.com/api/webhooks/process -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const startTime = Date.now()

    // Process queued webhooks
    await processQueuedWebhooks(prisma)

    const duration = Date.now() - startTime

    return Response.json(
      {
        success: true,
        message: 'Webhooks processed',
        duration: `${duration}ms`,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Webhook] Error processing queued webhooks:', error)
    return Response.json(
      {
        error: 'Failed to process webhooks',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/webhooks/process
 * Health check endpoint
 */
export async function GET() {
  const pending = await prisma.webhookDelivery.count({
    where: { status: 'pending' },
  })

  const failed = await prisma.webhookDelivery.count({
    where: { status: 'failed' },
  })

  return Response.json({
    status: 'healthy',
    pending,
    failed,
    timestamp: new Date().toISOString(),
  })
}
