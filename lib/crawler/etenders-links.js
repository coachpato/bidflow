export const ETENDERS_BASE_URL = 'https://www.etenders.gov.za'
export const ETENDERS_ACTIVE_OPPORTUNITIES_URL = `${ETENDERS_BASE_URL}/Home/opportunities?id=1`
export const ETENDERS_GENERAL_OPPORTUNITIES_URL = `${ETENDERS_BASE_URL}/Home?myTab=1`
export const ETENDERS_TENDER_DETAILS_PATH = '/Home/tenderDetails'
export const ETENDERS_DOWNLOAD_PATH = '/home/Download/'

const ETENDERS_HOSTS = new Set(['etenders.gov.za', 'www.etenders.gov.za'])

function normalizeString(value) {
  return String(value ?? '').trim()
}

function parseEtendersUrl(value) {
  const normalized = normalizeString(value)
  if (!normalized) return null

  try {
    const url = new URL(normalized, ETENDERS_BASE_URL)
    if (url.protocol !== 'https:') return null
    if (!ETENDERS_HOSTS.has(url.hostname.toLowerCase())) return null

    return url
  } catch {
    return null
  }
}

function normalizePathname(value) {
  return normalizeString(value).toLowerCase().replace(/\/+$/, '') || '/'
}

export function isFabricatedEtendersOpportunityUrl(value) {
  const url = parseEtendersUrl(value)
  if (!url) return false

  return (
    normalizePathname(url.pathname) === '/home/opportunities'
    && url.searchParams.has('id')
  )
}

export function isGeneralEtendersOpportunityUrl(value) {
  const url = parseEtendersUrl(value)
  if (!url) return false

  return (
    normalizePathname(url.pathname) === '/home'
    && url.searchParams.get('myTab') === '1'
  )
}

export function isTenderSpecificEtendersUrl(value) {
  const url = parseEtendersUrl(value)
  if (!url || isFabricatedEtendersOpportunityUrl(url.toString())) return false

  const pathname = normalizePathname(url.pathname)

  if (pathname === normalizePathname(ETENDERS_TENDER_DETAILS_PATH)) {
    return Boolean(normalizeString(url.searchParams.get('ID') || url.searchParams.get('id')))
  }

  if (pathname === normalizePathname(ETENDERS_DOWNLOAD_PATH)) {
    return Boolean(normalizeString(url.searchParams.get('blobName')))
  }

  return !isGeneralEtendersOpportunityUrl(url.toString())
}

export function normalizeEtendersSourceUrl(value) {
  const url = parseEtendersUrl(value)
  if (!url) return null
  if (isFabricatedEtendersOpportunityUrl(url.toString())) return null

  return url.toString()
}

export function normalizeEtendersDigestUrl(value) {
  return normalizeEtendersSourceUrl(value) || ETENDERS_GENERAL_OPPORTUNITIES_URL
}

export function buildEtendersTenderDetailsUrl(id) {
  const tenderId = normalizeString(id)
  if (!/^\d+$/.test(tenderId)) return null

  const url = new URL(ETENDERS_TENDER_DETAILS_PATH, ETENDERS_BASE_URL)
  url.searchParams.set('ID', tenderId)
  return url.toString()
}

export function getEtendersSourceUrl(item = {}) {
  const candidateFields = [
    item.url,
    item.sourceUrl,
    item.detailUrl,
    item.detailURL,
    item.tenderUrl,
    item.tenderURL,
    item.href,
    item.link,
  ]

  for (const candidate of candidateFields) {
    const sourceUrl = normalizeEtendersSourceUrl(candidate)
    if (sourceUrl) return sourceUrl
  }

  return buildEtendersTenderDetailsUrl(item.id) || ETENDERS_GENERAL_OPPORTUNITIES_URL
}

export function normalizeDocumentExtension(document = {}) {
  const extension = normalizeString(document.extension)
  if (extension) return extension.startsWith('.') ? extension : `.${extension}`

  const fileName = normalizeString(document.fileName)
  const match = fileName.match(/(\.[a-z0-9]+)$/i)
  return match ? match[1] : ''
}

export function buildEtendersDocumentDownloadUrl(document = {}) {
  const documentId = normalizeString(document.supportDocumentID || document.documentID)
  const extension = normalizeDocumentExtension(document)
  if (!documentId || !extension) return null

  const url = new URL(ETENDERS_DOWNLOAD_PATH, ETENDERS_BASE_URL)
  url.searchParams.set('blobName', `${documentId}${extension}`)

  const fileName = normalizeString(document.fileName)
  if (fileName) {
    url.searchParams.set('downloadedFileName', fileName)
  }

  return url.toString()
}

export function getEtendersDocumentMetadataFromSupportDocuments(item = {}) {
  const documents = Array.isArray(item.supportDocument) ? item.supportDocument : []

  return documents
    .filter(document => document?.active !== false)
    .map(document => {
      const sourceUrl = normalizeEtendersSourceUrl(buildEtendersDocumentDownloadUrl(document))
      const extension = normalizeDocumentExtension(document)
      const sourceDocumentId = normalizeString(document.supportDocumentID || document.documentID)

      if (!sourceDocumentId || !sourceUrl) return null

      const fileSize = document.fileSize === undefined || document.fileSize === null || document.fileSize === ''
        ? null
        : Number(document.fileSize)

      return {
        name: normalizeString(document.fileName) || 'Tender document',
        documentType: extension.toLowerCase() === '.pdf' ? 'PDF' : 'SOURCE',
        sourceUrl,
        sourceDocumentId,
        extension: extension || null,
        fileSize: Number.isFinite(fileSize) ? fileSize : null,
        checksum: normalizeString(document.checksum) || null,
        firstSeenAt: null,
        lastVerifiedAt: document.dateModified || null,
        sourceMetadata: {
          tendersID: document.tendersID || null,
          active: document.active !== false,
          dateModified: document.dateModified || null,
        },
      }
    })
    .filter(Boolean)
}

export function getEtendersPdfLinksFromSupportDocuments(item = {}) {
  return getEtendersDocumentMetadataFromSupportDocuments(item)
    .filter(document => document.extension?.toLowerCase() === '.pdf')
    .map(document => ({
      url: document.sourceUrl,
      text: document.name,
      sourceDocumentId: document.sourceDocumentId,
    }))
}
