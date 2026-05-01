import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { getSessionOrganizationId } from '@/lib/organization'

/**
 * PATCH /api/webhooks/endpoints/:id
 * Update webhook endpoint
 */
export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const { id } = await params
  const endpointId = parseInt(id, 10)

  // Verify ownership
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, organizationId },
  })

  if (!endpoint) {
    return Response.json({ error: 'Webhook endpoint not found' }, { status: 404 })
  }

  const body = await request.json()

  // Validate HTTPS if URL is being updated
  if (body.url && !body.url.startsWith('https://')) {
    return Response.json(
      { error: 'Webhook URLs must use HTTPS for security' },
      { status: 400 }
    )
  }

  try {
    const updated = await prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        url: body.url ?? endpoint.url,
        events: body.events ?? endpoint.events,
        isActive: body.isActive !== undefined ? body.isActive : endpoint.isActive,
      },
    })

    return Response.json(updated)
  } catch (error) {
    console.error('Error updating webhook endpoint:', error)
    return Response.json(
      { error: 'Failed to update webhook endpoint' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/webhooks/endpoints/:id
 * Delete webhook endpoint
 */
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const { id } = await params
  const endpointId = parseInt(id, 10)

  // Verify ownership
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, organizationId },
  })

  if (!endpoint) {
    return Response.json({ error: 'Webhook endpoint not found' }, { status: 404 })
  }

  try {
    await prisma.webhookEndpoint.delete({
      where: { id: endpointId },
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Error deleting webhook endpoint:', error)
    return Response.json(
      { error: 'Failed to delete webhook endpoint' },
      { status: 500 }
    )
  }
}
