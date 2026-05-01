import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { dashboardCacheTag, expireCacheTags, tenderDetailCacheTag, tendersListCacheTag } from '@/lib/cache-tags'
import { buildTenderChecklistItems } from '@/lib/tender-defaults'
import { getSessionOrganizationId } from '@/lib/organization'
import { findAssignedUser, notifyTenderAssignees } from '@/lib/tender-assignment'

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

function parseAssignedUserId(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

async function resolveAssignedFields(body, session) {
  const assignedUserId = parseAssignedUserId(body.assignedUserId)

  if (assignedUserId) {
    const assignedUser = await findAssignedUser(assignedUserId)
    if (assignedUser) {
      return {
        assignedUserId: assignedUser.id,
        assignedTo: assignedUser.name || assignedUser.email,
      }
    }
  }

  return {
    assignedUserId: session.userId,
    assignedTo: body.assignedTo?.trim() || session.name || session.email || null,
  }
}

export async function POST(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const { id } = await params
  const opportunityId = parseInt(id, 10)

  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id: opportunityId,
      organizationId,
    },
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

  if (opportunity.dislikedAt || opportunity.status === 'Disliked') {
    return Response.json({ error: 'Disliked opportunities cannot be converted to pursuits.' }, { status: 400 })
  }

  if (!body.deadline && !opportunity.deadline) {
    return Response.json({ error: 'A submission deadline is required before this opportunity can become a pursuit.' }, { status: 400 })
  }

  const assignment = await resolveAssignedFields(body, session)

  const checklistItems = buildTenderChecklistItems(buildOpportunityChecklistItems(opportunity))
  const tenderDocuments = opportunity.documents.map(document => ({
    filename: document.filename,
    filepath: document.filepath,
  }))

  const convertedOpportunity = await prisma.opportunity.update({
    where: { id: opportunity.id },
    data: {
      status: 'Pursued',
      pursuedAt: new Date(),
      likedAt: opportunity.likedAt || new Date(),
      dislikedAt: null,
      dislikedByUserId: null,
      tender: {
        create: {
          title: opportunity.title,
          reference: opportunity.reference,
          entity: opportunity.entity,
          description: opportunity.summary,
          deadline: body.deadline ? new Date(body.deadline) : opportunity.deadline,
          briefingDate: opportunity.briefingDate,
          contactPerson: opportunity.contactPerson,
          contactEmail: opportunity.contactEmail,
          status: 'New',
          assignedTo: assignment.assignedTo,
          assignedUserId: assignment.assignedUserId,
          notes: buildTenderNotes(opportunity),
          organizationId,
          userId: session.userId,
          checklistItems: checklistItems.length > 0
            ? {
                create: checklistItems,
              }
            : undefined,
          documents: tenderDocuments.length > 0
            ? {
                create: tenderDocuments,
              }
            : undefined,
        },
      },
    },
    select: {
      tender: {
        select: {
          id: true,
        },
      },
    },
  })

  const tenderId = convertedOpportunity.tender?.id
  if (!tenderId) {
    return Response.json({ error: 'Could not create the pursuit.' }, { status: 500 })
  }

  const createdTender = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  })

  void logActivity(`Converted opportunity to pursuit: ${opportunity.title}`, {
    userId: session.userId,
    tenderId,
  })
  if (createdTender) {
    await notifyTenderAssignees({
      tender: createdTender,
      assignedUserId: createdTender.assignedUserId,
      assignedTo: createdTender.assignedTo,
      actorName: session.name,
    })
  }
  await expireCacheTags(
    dashboardCacheTag(organizationId),
    tendersListCacheTag(organizationId),
    tenderDetailCacheTag(organizationId, tenderId)
  )

  return Response.json({ success: true, tenderId }, { status: 201 })
}
