import { after } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { dashboardCacheTag, expireCacheTags } from '@/lib/cache-tags'
import { getSessionOrganizationId } from '@/lib/organization'
import { logActivity } from '@/lib/activity'
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { syncComplianceExpiryNotificationsSafely } from '@/lib/compliance-documents'

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

async function getAuthorizedDocument(id, organizationId) {
  const document = await prisma.complianceDocument.findFirst({
    where: {
      id,
      organizationId,
    },
  })

  return document
}

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const documentId = Number.parseInt(id, 10)
  if (Number.isNaN(documentId)) return Response.json({ error: 'Invalid document id.' }, { status: 400 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const document = await getAuthorizedDocument(documentId, organizationId)
  if (!document) return Response.json({ error: 'Document not found.' }, { status: 404 })

  const payload = await request.json()
  const documentType = normalizeString(payload.documentType)

  if (!documentType) {
    return Response.json({ error: 'Document type is required.' }, { status: 400 })
  }

  const isDefault = normalizeBoolean(payload.isDefault)

  const updated = await prisma.$transaction(async tx => {
    if (isDefault) {
      await tx.complianceDocument.updateMany({
        where: {
          organizationId,
          documentType,
          isDefault: true,
          id: { not: documentId },
        },
        data: { isDefault: false },
      })
    }

    return tx.complianceDocument.update({
      where: { id: documentId },
      data: {
        documentType,
        description: normalizeString(payload.description),
        issueDate: normalizeDate(payload.issueDate),
        expiryDate: normalizeDate(payload.expiryDate),
        notes: normalizeString(payload.notes),
        isDefault,
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

  void logActivity(`Updated compliance document: ${updated.documentType} - ${updated.filename}`, {
    userId: session.userId,
  })
  await expireCacheTags(dashboardCacheTag(organizationId))
  after(async () => {
    const syncedDocuments = await syncComplianceExpiryNotificationsSafely(organizationId)
    if (syncedDocuments) {
      await expireCacheTags(dashboardCacheTag(organizationId))
    }
  })

  return Response.json(updated)
}

export async function DELETE(_request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const documentId = Number.parseInt(id, 10)
  if (Number.isNaN(documentId)) return Response.json({ error: 'Invalid document id.' }, { status: 400 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const document = await getAuthorizedDocument(documentId, organizationId)
  if (!document) return Response.json({ error: 'Document not found.' }, { status: 404 })

  if (document.storagePath) {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([document.storagePath])

    if (error) {
      console.error('Compliance document removal failed:', error.message)
    }
  }

  await prisma.complianceDocument.delete({
    where: { id: documentId },
  })

  void logActivity(`Removed compliance document: ${document.documentType} - ${document.filename}`, {
    userId: session.userId,
  })
  await expireCacheTags(dashboardCacheTag(organizationId))
  after(async () => {
    const syncedDocuments = await syncComplianceExpiryNotificationsSafely(organizationId)
    if (syncedDocuments) {
      await expireCacheTags(dashboardCacheTag(organizationId))
    }
  })

  return Response.json({ success: true })
}
