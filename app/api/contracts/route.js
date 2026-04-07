import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

// GET /api/contracts
export async function GET(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const contracts = await prisma.contract.findMany({
    orderBy: { createdAt: 'desc' },
    include: { tender: { select: { title: true, id: true } } },
  })

  return Response.json(contracts)
}

// POST /api/contracts
export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  if (!body.title) {
    return Response.json({ error: 'Contract title is required' }, { status: 400 })
  }

  const contract = await prisma.contract.create({
    data: {
      title: body.title,
      client: body.client || null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      renewalDate: body.renewalDate ? new Date(body.renewalDate) : null,
      cancelDate: body.cancelDate ? new Date(body.cancelDate) : null,
      value: body.value ? parseFloat(body.value) : null,
      notes: body.notes || null,
      tenderId: body.tenderId ? parseInt(body.tenderId) : null,
    },
  })

  await logActivity(`Created contract: ${contract.title}`, {
    userId: session.userId,
    contractId: contract.id,
  })

  // Create an in-app notification for the team if end date is set
  if (contract.endDate) {
    await prisma.notification.create({
      data: {
        message: `New contract created: "${contract.title}" — ends ${new Date(contract.endDate).toLocaleDateString('en-ZA')}`,
        type: 'info',
      },
    })
  }

  return Response.json(contract, { status: 201 })
}
