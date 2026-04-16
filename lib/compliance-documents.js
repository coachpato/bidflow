import prisma from '@/lib/prisma'
import { getDaysUntil } from '@/lib/compliance-status'

const COMPLIANCE_ALERT_WINDOW_DAYS = 30

export function getComplianceAlertCutoff() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + COMPLIANCE_ALERT_WINDOW_DAYS)
  return cutoff
}

function buildComplianceSourceKey(documentId) {
  return `compliance-expiry:${documentId}`
}

export async function syncComplianceExpiryNotifications(organizationId) {
  const cutoff = getComplianceAlertCutoff()

  const documents = await prisma.complianceDocument.findMany({
    where: {
      organizationId,
      expiryDate: {
        not: null,
        lte: cutoff,
      },
    },
    orderBy: { expiryDate: 'asc' },
  })

  const activeSourceKeys = documents.map(document => buildComplianceSourceKey(document.id))

  await prisma.notification.deleteMany({
    where: {
      organizationId,
      ...(activeSourceKeys.length > 0
        ? {
            sourceKey: {
              startsWith: 'compliance-expiry:',
              notIn: activeSourceKeys,
            },
          }
        : {
            sourceKey: {
              startsWith: 'compliance-expiry:',
            },
          }),
    },
  })

  for (const document of documents) {
    const daysUntilExpiry = getDaysUntil(document.expiryDate)
    const message = daysUntilExpiry < 0
      ? `${document.documentType} "${document.filename}" has expired.`
      : daysUntilExpiry === 0
        ? `${document.documentType} "${document.filename}" expires today.`
        : `${document.documentType} "${document.filename}" expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}.`

    await prisma.notification.upsert({
      where: { sourceKey: buildComplianceSourceKey(document.id) },
      update: {
        title: 'Compliance document alert',
        message,
        type: daysUntilExpiry < 0 ? 'error' : 'warning',
        linkUrl: '/vault',
        linkLabel: 'Open vault',
      },
      create: {
        title: 'Compliance document alert',
        message,
        type: daysUntilExpiry < 0 ? 'error' : 'warning',
        organizationId,
        sourceKey: buildComplianceSourceKey(document.id),
        linkUrl: '/vault',
        linkLabel: 'Open vault',
      }
    })
  }

  return documents
}
