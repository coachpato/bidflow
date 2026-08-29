import { createHash } from 'node:crypto'
import { buildAppUrl } from '@/lib/config/app-url'

const DEFAULT_ARCHIVE_MONTHS_AFTER_CLOSE = 12
const CLOSING_SOON_DAYS = 7

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizeIdentityPart(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'na'
}

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDateKey(value) {
  return toDate(value)?.toISOString().slice(0, 10) || 'no-date'
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    ).join(',')}}`
  }

  return JSON.stringify(value ?? null)
}

function getDocumentIdentity(document = {}) {
  return {
    sourceDocumentId: document.sourceDocumentId || document.supportDocumentID || document.documentID || null,
    name: document.name || document.fileName || document.text || null,
    extension: document.extension || null,
    lastModified: document.dateModified || document.lastModified || document.lastVerifiedAt || null,
  }
}

export function getTenderSourceTenderId(tender = {}) {
  const candidate = tender.sourceTenderId ?? tender.sourceTenderID ?? tender.id ?? tender.tendersID ?? null
  const normalized = String(candidate ?? '').trim()
  return normalized || null
}

export function computeTenderContentHash({
  tender = {},
  tenderDetails = {},
  documents = [],
} = {}) {
  const sourceDocuments = Array.isArray(documents) && documents.length > 0
    ? documents
    : [
        ...(Array.isArray(tender.documentMetadata) ? tender.documentMetadata : []),
        ...(Array.isArray(tender.pdfLinks) ? tender.pdfLinks : []),
      ]

  const stableFields = {
    sourceTenderId: getTenderSourceTenderId(tender),
    reference: tender.reference || null,
    title: tender.title || null,
    description: tender.description || tender.summary || null,
    issuer: tenderDetails.entity || tender.entity || null,
    category: tender.category || tenderDetails.category || null,
    publishedAt: tender.advertised || tender.publishedAt || null,
    deadline: tender.deadline || null,
    briefingDate: tenderDetails.briefingDate || tender.briefingDate || null,
    briefingDetails: tenderDetails.briefingDetails || tender.briefingDetails || null,
    location: tenderDetails.location || tender.location || tenderDetails.province || null,
    contactPerson: tenderDetails.contactPerson || tender.contactPerson || null,
    contactEmail: tenderDetails.contactEmail || tender.contactEmail || null,
    sourceStatus: tender.sourceStatus || tender.status || null,
    documents: sourceDocuments.map(getDocumentIdentity).sort((left, right) =>
      stableStringify(left).localeCompare(stableStringify(right))
    ),
  }

  return createHash('sha256').update(stableStringify(stableFields)).digest('hex')
}

export function buildTenderSourceIdentityKey({
  sourceKey = null,
  tender = {},
  tenderDetails = {},
  contentHash = null,
} = {}) {
  const sourcePart = normalizeIdentityPart(sourceKey || tender.sourceName || 'unknown-source')
  const sourceTenderId = getTenderSourceTenderId(tender)

  if (sourceTenderId) {
    return `${sourcePart}:source-id:${normalizeIdentityPart(sourceTenderId)}`
  }

  const reference = tender.reference || tender.tender_No || tender.externalId || null
  const issuer = tenderDetails.entity || tender.entity || tender.organ_of_State || tender.department || null
  const publishedAt = tender.advertised || tender.publishedAt || tender.date_Published || null
  const deadline = tender.deadline || tender.closing_Date || null

  if (reference && issuer) {
    return [
      sourcePart,
      'reference',
      normalizeIdentityPart(reference),
      'issuer',
      normalizeIdentityPart(issuer),
      'published',
      toDateKey(publishedAt),
    ].join(':')
  }

  return [
    sourcePart,
    'weak',
    normalizeIdentityPart(reference || 'no-reference'),
    normalizeIdentityPart(issuer || 'unknown-issuer'),
    toDateKey(publishedAt),
    toDateKey(deadline),
    normalizeIdentityPart(contentHash || computeTenderContentHash({ tender, tenderDetails })),
  ].join(':')
}

export function slugifyTenderTitle(title) {
  const slug = normalizeText(title)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/g, '')

  return slug || 'tender'
}

export function buildBid360TenderPath(id, title) {
  const tenderId = Number.parseInt(String(id), 10)
  if (!Number.isInteger(tenderId) || tenderId <= 0) return null
  return `/tenders/${tenderId}/${slugifyTenderTitle(title)}`
}

export function buildBid360TenderUrl(id, title) {
  const path = buildBid360TenderPath(id, title)
  return path ? buildAppUrl(path) : null
}

export function parseTenderRouteId(value) {
  const id = Number.parseInt(String(value ?? ''), 10)
  return Number.isInteger(id) && id > 0 && String(id) === String(value) ? id : null
}

export function getTenderArchiveMonths() {
  const parsed = Number.parseInt(process.env.TENDER_ARCHIVE_MONTHS_AFTER_CLOSE || '', 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_ARCHIVE_MONTHS_AFTER_CLOSE
}

export function deriveTenderLifecycleStatus(tender = {}, {
  now = new Date(),
  archiveMonths = getTenderArchiveMonths(),
} = {}) {
  const sourceStatus = normalizeText(tender.sourceStatus || tender.status)
  const deadline = toDate(tender.deadline)
  const archivedAt = toDate(tender.archivedAt)
  const sourceMissingAt = toDate(tender.sourceMissingAt)
  const nowDate = toDate(now) || new Date()

  if (sourceStatus.includes('cancel')) {
    return { label: 'Cancelled', tone: 'danger', closed: true, archived: Boolean(archivedAt), sourceMissing: Boolean(sourceMissingAt) }
  }

  if (sourceStatus.includes('award')) {
    return { label: 'Awarded', tone: 'success', closed: true, archived: Boolean(archivedAt), sourceMissing: Boolean(sourceMissingAt) }
  }

  if (archivedAt) {
    return { label: 'Archived', tone: 'muted', closed: true, archived: true, sourceMissing: Boolean(sourceMissingAt) }
  }

  if (sourceMissingAt) {
    return { label: 'No longer found at source', tone: 'warning', closed: Boolean(deadline && deadline < nowDate), archived: false, sourceMissing: true }
  }

  if (deadline && deadline < nowDate) {
    const archiveCutoff = new Date(deadline)
    archiveCutoff.setMonth(archiveCutoff.getMonth() + archiveMonths)

    if (archiveCutoff < nowDate) {
      return { label: 'Archived', tone: 'muted', closed: true, archived: true, sourceMissing: false }
    }

    return { label: 'Closed', tone: 'muted', closed: true, archived: false, sourceMissing: false }
  }

  if (deadline) {
    const closingSoonThreshold = nowDate.getTime() + (CLOSING_SOON_DAYS * 24 * 60 * 60 * 1000)
    if (deadline.getTime() <= closingSoonThreshold) {
      return { label: 'Closing soon', tone: 'warning', closed: false, archived: false, sourceMissing: false }
    }
  }

  return { label: 'Open', tone: 'success', closed: false, archived: false, sourceMissing: false }
}
