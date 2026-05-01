import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { getSessionOrganizationId } from '@/lib/organization'

/**
 * GET /api/webhooks/endpoints
 * List all webhook endpoints for the organization
 */
export async function GET(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { organizationId },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return Response.json(endpoints)
}

/**
 * POST /api/webhooks/endpoints
 * Register a new webhook endpoint
 *
 * Request body:
 * - url: string (HTTPS URL where webhooks will be sent)
 * - events: string[] (events to subscribe to, e.g., ["tender.status_changed"])
 * - secret: string? (optional, for HMAC signing in future)
 */
export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const body = await request.json()

  // Validate
  if (!body.url) {
    return Response.json({ error: 'URL is required' }, { status: 400 })
  }

  if (!body.url.startsWith('https://')) {
    return Response.json(
      { error: 'Webhook URLs must use HTTPS for security' },
      { status: 400 }
    )
  }

  if (!Array.isArray(body.events) || body.events.length === 0) {
    return Response.json({ error: 'At least one event must be specified' }, { status: 400 })
  }

  try {
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        organizationId,
        url: body.url,
        events: body.events,
        secret: body.secret || null,
        isActive: true,
      },
    })

    return Response.json(endpoint, { status: 201 })
  } catch (error) {
    console.error('Error creating webhook endpoint:', error)
    return Response.json(
      { error: 'Failed to create webhook endpoint' },
      { status: 500 }
    )
  }
}
