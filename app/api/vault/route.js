import { after } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { dashboardCacheTag, expireCacheTags } from '@/lib/cache-tags'
import { getSessionOrganizationId } from '@/lib/organization'
import { logActivity } from '@/lib/activity'
import { ensureStorageBucket, getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import {
  syncComplianceExpiryNotificationsIfNeededSafely,
  syncComplianceExpiryNotificationsSafely,
} from '@/lib/compliance-documents'

function normalizeString(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeDate(value) {
  const normalized = normalizeString(value)
  if (!normalized) return null
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    return ['1', 'true', 'on', 'yes'].includes(value.toLowerCase())
  }
  return false
}

export async function GET(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  after(async () => {
    const syncedDocuments = await syncComplianceExpiryNotificationsIfNeededSafely(organizationId)
    if (syncedDocuments) {
      await expireCacheTags(dashboardCacheTag(organizationId))
    }
  })

  const { searchParams } = new URL(request.url)
  const expiringOnly = searchParams.get('expiring') === '1'
  const documentType = normalizeString(searchParams.get('documentType'))
  const expiryCutoff = new Date()
  expiryCutoff.setDate(expiryCutoff.getDate() + 30)

  const documents = await prisma.complianceDocument.findMany({
    where: {
      organizationId,
      ...(documentType ? { documentType } : {}),
      ...(expiringOnly ? {
        expiryDate: {
          not: null,
          lte: expiryCutoff,
        },
      } : {}),
    },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [
      { expiryDate: 'asc' },
      { documentType: 'asc' },
      { createdAt: 'desc' },
    ],
  })

  return Response.json(documents)
}

export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })
  const formData = await request.formData()
  const file = formData.get('file')
  const documentType = normalizeString(formData.get('documentType'))

  if (!file || typeof file.name !== 'string' || typeof file.arrayBuffer !== 'function') {
    return Response.json({ error: 'A file is required.' }, { status: 400 })
  }

  if (!documentType) {
    return Response.json({ error: 'Document type is required.' }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `compliance/${organizationId}/${Date.now()}_${safeName}`
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
    return Response.json({ error: uploadError.message || 'File upload failed.' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath)

  const isDefault = normalizeBoolean(formData.get('isDefault'))

  const document = await prisma.$transaction(async tx => {
    if (isDefault) {
      await tx.complianceDocument.updateMany({
        where: {
          organizationId,
          documentType,
          isDefault: true,
        },
        data: { isDefault: false },
      })
    }

    return tx.complianceDocument.create({
      data: {
        organizationId,
        filename: file.name,
        filepath: publicUrl,
        storagePath,
        documentType,
        description: normalizeString(formData.get('description')),
        issueDate: normalizeDate(formData.get('issueDate')),
        expiryDate: normalizeDate(formData.get('expiryDate')),
        notes: normalizeString(formData.get('notes')),
        isDefault,
        uploadedByUserId: session.userId,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })
  })

  void logActivity(`Uploaded compliance document: ${document.documentType} - ${document.filename}`, {
    userId: session.userId,
  })
  await expireCacheTags(dashboardCacheTag(organizationId))
  after(async () => {
    const syncedDocuments = await syncComplianceExpiryNotificationsSafely(organizationId)
    if (syncedDocuments) {
      await expireCacheTags(dashboardCacheTag(organizationId))
    }
  })

  return Response.json(document, { status: 201 })
}
