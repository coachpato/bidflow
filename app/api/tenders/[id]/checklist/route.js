import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

// GET /api/tenders/:id/checklist
export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const items = await prisma.tenderChecklistItem.findMany({
    where: { tenderId: parseInt(id) },
    orderBy: { id: 'asc' },
  })

  return Response.json(items)
}

// POST /api/tenders/:id/checklist — add a new item
export async function POST(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { label, responsible, dueDate, notes } = await request.json()

  if (!label) return Response.json({ error: 'Label is required' }, { status: 400 })

  const item = await prisma.tenderChecklistItem.create({
    data: {
      label,
      responsible: responsible || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
      tenderId: parseInt(id),
    },
  })

  await logActivity(`Added checklist item: ${label}`, {
    userId: session.userId,
    tenderId: parseInt(id),
  })

  return Response.json(item, { status: 201 })
}
