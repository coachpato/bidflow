import prisma from '@/lib/prisma'
import { expireCacheTags, tenderPackCacheTag } from '@/lib/cache-tags'
import { SUBMISSION_BACKUP_DOCUMENT_CATEGORY } from '@/lib/tender-document-categories'

function formatDate(value) {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function buildSubmissionPackState(backupDocuments) {
  const backupDocumentCount = backupDocuments.length
  const latestUploadedAt = backupDocuments[0]?.uploadedAt || null
  const hasBackup = backupDocumentCount > 0
  const missingItems = hasBackup
    ? []
    : ['Upload at least one final submitted file so Bid360 keeps a record of what was sent.']

  return {
    status: hasBackup ? 'Backed Up' : 'Awaiting Backup',
    readinessPercent: hasBackup ? 100 : 0,
    checklistCompletionPercent: hasBackup ? 100 : 0,
    backupDocumentCount,
    latestUploadedAt,
    summary: hasBackup
      ? `Bid360 is storing ${backupDocumentCount} submitted file${backupDocumentCount === 1 ? '' : 's'} for this pursuit${latestUploadedAt ? `, latest added on ${formatDate(latestUploadedAt)}` : ''}.`
      : 'Upload the exact files that were submitted so the firm keeps a clean audit trail of the final tender pack.',
    missingItems,
  }
}

async function fetchSubmissionBackupDocuments({ tenderId, organizationId }) {
  return prisma.tenderDocument.findMany({
    where: {
      tenderId,
      documentCategory: SUBMISSION_BACKUP_DOCUMENT_CATEGORY,
      tender: { organizationId },
    },
    orderBy: { uploadedAt: 'desc' },
  })
}

export async function getSubmissionPackData({ tenderId, organizationId }) {
  const backupDocuments = await fetchSubmissionBackupDocuments({
    tenderId,
    organizationId,
  })

  return {
    submissionPack: buildSubmissionPackState(backupDocuments),
    backupDocuments,
  }
}

export async function refreshSubmissionPack({
  tenderId,
  organizationId,
}) {
  const { submissionPack } = await getSubmissionPackData({
    tenderId,
    organizationId,
  })

  await expireCacheTags(tenderPackCacheTag(organizationId, tenderId))

  return submissionPack
}
