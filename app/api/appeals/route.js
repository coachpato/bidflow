import { logActivity } from '@/lib/activity'
import prisma from '@/lib/prisma'
import { dashboardCacheTag, expireCacheTags, tenderDetailCacheTag } from '@/lib/cache-tags'
import { getSessionOrganizationId } from '@/lib/organization'
import { getUserRoleFromSession } from '@/lib/roles'
import { getSession } from '@/lib/session'
import { ensureStorageBucket, getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { recordTenderStatusChange } from '@/lib/status-changes'
import { notifyChallengeCreated } from '@/lib/challenge-notifications'
import { ROLE_NAMES, TENDER_STATUSES, validateTenderTransition } from '@/lib/status-machine'

const DEFAULT_APPEAL_TYPE = 'Administrative Appeal'
const REGRET_LETTER_DOCUMENT_TYPE = 'Regret Letter'

function toNullableString(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function toNullableDate(value) {
  if (!value) return null

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toNullableInt(value) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number.parseInt(String(value), 10)
  return Number.isNaN(parsed) ? null : parsed
}

function toBoolean(value) {
  return value === true || value === 'true' || value === '1'
}

function isMultipartRequest(request) {
  return request.headers.get('content-type')?.includes('multipart/form-data')
}

function normalizeChecklist(value) {
  if (Array.isArray(value)) {
    return value.map(item => toNullableString(item)).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean)
  }

  return null
}

async function readPayload(request) {
  if (!isMultipartRequest(request)) {
    const body = await request.json()
    return { body, file: null }
  }

  const formData = await request.formData()

  const file = formData.get('file')
  const evidenceChecklist = formData.getAll('evidenceChecklist')
  const checklistValue = evidenceChecklist.length > 1 ? evidenceChecklist : formData.get('evidenceChecklist')

  return {
    file: file && typeof file.name === 'string' ? file : null,
    body: {
      reason: formData.get('reason'),
      challengeType: formData.get('challengeType'),
      exclusionReason: formData.get('exclusionReason'),
      exclusionDate: formData.get('exclusionDate'),
      deadline: formData.get('deadline'),
      status: formData.get('status'),
      submittedAt: formData.get('submittedAt'),
      resolvedAt: formData.get('resolvedAt'),
      requestedRelief: formData.get('requestedRelief'),
      nextStep: formData.get('nextStep'),
      notes: formData.get('notes'),
      template: formData.get('template'),
      tenderId: formData.get('tenderId'),
      markTenderLost: formData.get('markTenderLost'),
      evidenceChecklist: checklistValue,
    },
  }
}

async function uploadAppealDocument({ organizationId, file }) {
  if (!file) return null

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `appeals/${organizationId}/${Date.now()}_${safeName}`
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  await ensureStorageBucket()

  const supabase = getSupabaseAdmin()
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`File upload failed: ${uploadError.message}`)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)

  return {
    filename: file.name,
    filepath: publicUrl,
    documentType: REGRET_LETTER_DOCUMENT_TYPE,
  }
}

// GET /api/appeals
export async function GET() {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const appeals = await prisma.appeal.findMany({
    where: {
      organizationId,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      tender: {
        select: {
          title: true,
          id: true,
          entity: true,
          assignedUserId: true,
          assignedTo: true,
        },
      },
      _count: { select: { documents: true } },
    },
  })

  return Response.json(appeals, {
    headers: {
      'Cache-Control': 'private, no-store',
    },
  })
}

// POST /api/appeals
export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const { body, file } = await readPayload(request)
  const reason = toNullableString(body.reason)
  const tenderId = toNullableInt(body.tenderId)
  const markTenderLost = toBoolean(body.markTenderLost) || Boolean(tenderId)
  const evidenceChecklist = normalizeChecklist(body.evidenceChecklist)

  if (!reason) {
    return Response.json({ error: 'Appeal reason is required.' }, { status: 400 })
  }

  if (markTenderLost && !file) {
    return Response.json({ error: 'Upload the regret letter before opening the appeal intake.' }, { status: 400 })
  }

  const userRole = getUserRoleFromSession(session)
  const userRoleName = ROLE_NAMES[userRole]

  let linkedTender = null

  if (tenderId) {
    linkedTender = await prisma.tender.findFirst({
      where: {
        id: tenderId,
        organizationId,
      },
      select: {
        id: true,
        title: true,
        entity: true,
        status: true,
        assignedUserId: true,
        assignedTo: true,
      },
    })

    if (!linkedTender) {
      return Response.json({ error: 'Linked pursuit not found.' }, { status: 404 })
    }

    if (markTenderLost) {
      const validation = validateTenderTransition(linkedTender.status, TENDER_STATUSES.LOST, userRole)
      if (!validation.isValid) {
        const statusCode = validation.code === 'INSUFFICIENT_ROLE' ? 403 : 400
        return Response.json(
          {
            error: validation.error,
            code: validation.code,
            ...(validation.code === 'INSUFFICIENT_ROLE' && {
              requiredRole: ROLE_NAMES[validation.requiredRole],
              userRole: ROLE_NAMES[validation.userRole],
            }),
          },
          { status: statusCode }
        )
      }
    }
  }

  let uploadedDocument = null

  try {
    uploadedDocument = await uploadAppealDocument({
      organizationId,
      file,
    })
  } catch (error) {
    return Response.json({ error: error.message || 'Could not upload the regret letter.' }, { status: 500 })
  }

  const appeal = await prisma.$transaction(async tx => {
    const createdAppeal = await tx.appeal.create({
      data: {
        organizationId,
        reason,
        challengeType: toNullableString(body.challengeType) || DEFAULT_APPEAL_TYPE,
        exclusionReason: toNullableString(body.exclusionReason),
        exclusionDate: toNullableDate(body.exclusionDate),
        deadline: toNullableDate(body.deadline),
        status: toNullableString(body.status) || 'Pending',
        submittedAt: toNullableDate(body.submittedAt),
        resolvedAt: toNullableDate(body.resolvedAt),
        requestedRelief: toNullableString(body.requestedRelief),
        nextStep: toNullableString(body.nextStep),
        evidenceChecklist,
        notes: toNullableString(body.notes),
        template: toNullableString(body.template),
        tenderId,
        documents: uploadedDocument
          ? {
              create: uploadedDocument,
            }
          : undefined,
      },
      include: {
        tender: {
          select: {
            title: true,
            id: true,
            entity: true,
            assignedUserId: true,
            assignedTo: true,
          },
        },
        documents: true,
      },
    })

    if (linkedTender && markTenderLost) {
      await tx.tender.update({
        where: { id: linkedTender.id },
        data: {
          status: TENDER_STATUSES.LOST,
          outcomeRecordedAt: new Date(),
        },
      })
    }

    return createdAppeal
  })

  if (linkedTender && markTenderLost) {
    await recordTenderStatusChange({
      tenderId: linkedTender.id,
      fromStatus: linkedTender.status,
      toStatus: TENDER_STATUSES.LOST,
      changedByUserId: session.userId,
      reason: 'Loss recorded and appeal intake opened.',
      metadata: {
        appealId: appeal.id,
        userRole: userRoleName,
      },
    })
  }

  await logActivity(
    `${linkedTender && markTenderLost ? 'Opened appeal intake and recorded loss' : 'Created appeal'}: ${reason.substring(0, 60)}`,
    {
      userId: session.userId,
      appealId: appeal.id,
      tenderId: tenderId || null,
    }
  )

  await prisma.notification.create({
    data: {
      title: 'Appeal intake opened',
      message: `New appeal created${tenderId ? ' and linked to the pursuit record' : ''}: ${reason.substring(0, 80)}`,
      type: 'warning',
      organizationId,
      linkUrl: `/appeals/${appeal.id}`,
      linkLabel: 'Open appeal',
    },
  })

  await notifyChallengeCreated({
    challenge: {
      ...appeal,
      organizationId,
    },
  })

  await expireCacheTags(
    dashboardCacheTag(organizationId),
    tenderId ? tenderDetailCacheTag(organizationId, tenderId) : null
  )

  return Response.json(appeal, { status: 201 })
}
