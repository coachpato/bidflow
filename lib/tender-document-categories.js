export const TENDER_SOURCE_DOCUMENT_CATEGORY = 'SOURCE'
export const SUBMISSION_BACKUP_DOCUMENT_CATEGORY = 'SUBMISSION_BACKUP'

const VALID_TENDER_DOCUMENT_CATEGORIES = new Set([
  TENDER_SOURCE_DOCUMENT_CATEGORY,
  SUBMISSION_BACKUP_DOCUMENT_CATEGORY,
])

export function normalizeTenderDocumentCategory(value) {
  if (typeof value !== 'string') return TENDER_SOURCE_DOCUMENT_CATEGORY

  const normalized = value.trim().toUpperCase()
  return VALID_TENDER_DOCUMENT_CATEGORIES.has(normalized)
    ? normalized
    : TENDER_SOURCE_DOCUMENT_CATEGORY
}

export function isSubmissionBackupDocumentCategory(value) {
  return normalizeTenderDocumentCategory(value) === SUBMISSION_BACKUP_DOCUMENT_CATEGORY
}

export function getTenderDocumentCategoryLabel(value) {
  return isSubmissionBackupDocumentCategory(value)
    ? 'Submission backup'
    : 'Tender source'
}
