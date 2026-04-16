import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { buildTenderChecklistItems } from '@/lib/tender-defaults'
import { notifyTenderAssignees } from '@/lib/tender-assignment'

function formatMoney(value) {
  if (value === null || value === undefined) return null
  return `R ${Number(value).toLocaleString('en-ZA')}`
}

function buildTenderNotes(opportunity) {
  const lines = []

  if (opportunity.notes) lines.push(opportunity.notes)
  if (opportunity.summary) lines.push(`Opportunity summary: ${opportunity.summary}`)
  if (opportunity.sourceUrl) lines.push(`Source link: ${opportunity.sourceUrl}`)
  if (opportunity.practiceArea) lines.push(`Practice area: ${opportunity.practiceArea}`)
  if (opportunity.fitScore !== null && opportunity.fitScore !== undefined) {
    lines.push(`Fit score: ${opportunity.fitScore}/100`)
  }
  if (opportunity.estimatedValue !== null && opportunity.estimatedValue !== undefined) {
    lines.push(`Estimated value: ${formatMoney(opportunity.estimatedValue)}`)
  }

  return lines.filter(Boolean).join('\n\n') || null
}

function getParsedRequirements(opportunity) {
  if (!Array.isArray(opportunity.parsedRequirements)) return []

  return opportunity.parsedRequirements
    .map(item => {
      if (typeof item === 'string') return item
      return item?.label || null
    })
    .filter(Boolean)
}

function buildOpportunityChecklistItems(opportunity) {
  const customItems = getParsedRequirements(opportunity).map(label => ({
    label,
    notes: 'Imported from opportunity source pack.',
  }))

  if (opportunity.briefingDate) {
    customItems.push({
      label: 'Attend compulsory briefing',
      dueDate: opportunity.briefingDate,
      notes: 'Imported from opportunity timeline.',
    })
  }

  if (opportunity.siteVisitDate) {
    customItems.push({
      label: 'Attend site visit',
      dueDate: opportunity.siteVisitDate,
      notes: 'Imported from opportunity timeline.',
    })
  }

  return customItems
}

export async function POST(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const opportunityId = parseInt(id, 10)

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      documents: true,
      tender: { select: { id: true, title: true } },
    },
  })

  if (!opportunity) {
    return Response.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  if (opportunity.tender) {
    return Response.json({
      success: true,
      tenderId: opportunity.tender.id,
      message: 'Opportunity already converted.',
    })
  }

  const tender = await prisma.tender.create({
    data: {
      title: opportunity.title,
      reference: opportunity.reference,
      entity: opportunity.entity,
      description: opportunity.summary,
      deadline: opportunity.deadline,
      briefingDate: opportunity.briefingDate,
      contactPerson: opportunity.contactPerson,
      contactEmail: opportunity.contactEmail,
      status: 'New',
      assignedTo: session.name || session.email || null,
      assignedUserId: session.userId,
      notes: buildTenderNotes(opportunity),
      userId: session.userId,
      opportunityId: opportunity.id,
    },
  })

  await notifyTenderAssignees({
    tender,
    assignedUserId: tender.assignedUserId,
    assignedTo: tender.assignedTo,
    actorName: session.name || 'A teammate',
  })

  await prisma.tenderChecklistItem.createMany({
    data: buildTenderChecklistItems(buildOpportunityChecklistItems(opportunity)).map(item => ({
      ...item,
      tenderId: tender.id,
    })),
  })

  if (opportunity.documents.length > 0) {
    await prisma.tenderDocument.createMany({
      data: opportunity.documents.map(document => ({
        filename: document.filename,
        filepath: document.filepath,
        tenderId: tender.id,
      })),
    })
  }

  await prisma.opportunity.update({
    where: { id: opportunity.id },
    data: {
      status: 'Converted',
    },
  })

  await logActivity(`Converted opportunity to tender: ${opportunity.title}`, {
    userId: session.userId,
    tenderId: tender.id,
  })

  return Response.json({ success: true, tenderId: tender.id }, { status: 201 })
}
