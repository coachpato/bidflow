import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { ensureOrganizationContext } from '@/lib/organization'
import { logActivity } from '@/lib/activity'
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { syncComplianceExpiryNotifications } from '@/lib/compliance-documents'

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

async function getAuthorizedDocument(id, userId) {
  const organizationContext = await ensureOrganizationContext(userId)
  const document = await prisma.complianceDocument.findFirst({
    where: {
      id,
      organizationId: organizationContext.organization.id,
    },
  })

  return { organizationContext, document }
}

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const documentId = Number.parseInt(id, 10)
  if (Number.isNaN(documentId)) return Response.json({ error: 'Invalid document id.' }, { status: 400 })

  const { organizationContext, document } = await getAuthorizedDocument(documentId, session.userId)
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
          organizationId: organizationContext.organization.id,
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

  await syncComplianceExpiryNotifications(organizationContext.organization.id)
  await logActivity(`Updated compliance document: ${updated.documentType} - ${updated.filename}`, {
    userId: session.userId,
  })

  return Response.json(updated)
}

export async function DELETE(_request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const documentId = Number.parseInt(id, 10)
  if (Number.isNaN(documentId)) return Response.json({ error: 'Invalid document id.' }, { status: 400 })

  const { organizationContext, document } = await getAuthorizedDocument(documentId, session.userId)
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

  await syncComplianceExpiryNotifications(organizationContext.organization.id)
  await logActivity(`Removed compliance document: ${document.documentType} - ${document.filename}`, {
    userId: session.userId,
  })

  return Response.json({ success: true })
}
