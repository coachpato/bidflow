import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { notifyTenderAssignees } from '@/lib/tender-assignment'

// GET /api/tenders — list all tenders (with optional search/filter)
export async function GET(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const where = {}

  if (status && status !== 'active') {
    where.status = status
  } else if (status === 'active') {
    where.status = { in: ['New', 'Under Review', 'In Progress'] }
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { reference: { contains: search } },
      { entity: { contains: search } },
    ]
  }

  const tenders = await prisma.tender.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { checklistItems: true, documents: true } },
    },
  })

  return Response.json(tenders)
}

// POST /api/tenders — create a new tender
export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  if (!body.title || !body.entity) {
    return Response.json({ error: 'Title and issuing entity are required' }, { status: 400 })
  }

  const tender = await prisma.tender.create({
    data: {
      title: body.title,
      reference: body.reference || null,
      entity: body.entity,
      description: body.description || null,
      deadline: body.deadline ? new Date(body.deadline) : null,
      briefingDate: body.briefingDate ? new Date(body.briefingDate) : null,
      contactPerson: body.contactPerson || null,
      contactEmail: body.contactEmail || null,
      status: body.status || 'New',
      assignedTo: body.assignedTo || null,
      notes: body.notes || null,
      userId: session.userId,
    },
  })

  // Create default SA checklist items for every new tender
  const defaultItems = [
    'Tax Clearance Certificate (SARS)',
    'CSD (Central Supplier Database) Registration',
    'B-BBEE Certificate',
    'Company Registration Documents (CIPC)',
    'Pricing Schedule',
    'SBD 1 — Invitation to Bid',
    'SBD 4 — Declaration of Interest',
    'SBD 6.1 — Preference Points Claim',
    'SBD 8 — Declaration of Bidder\'s Past Supply Chain Management Practices',
    'Technical Proposal / Methodology',
  ]

  await prisma.tenderChecklistItem.createMany({
    data: defaultItems.map(label => ({
      label,
      tenderId: tender.id,
      done: false,
    })),
  })

  await logActivity(`Created tender: ${tender.title}`, {
    userId: session.userId,
    tenderId: tender.id,
  })

  await notifyTenderAssignees({
    tender,
    assignedTo: tender.assignedTo,
    actorName: session.name,
  })

  return Response.json(tender, { status: 201 })
}
