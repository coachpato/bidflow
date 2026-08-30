import axios from 'axios'
import * as cheerio from 'cheerio'
import { isIP } from 'node:net'
import { classifyError, withRetry } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { requestWithRateLimit } from '@/lib/crawler/rate-limiter'
import {
  ETENDERS_ACTIVE_OPPORTUNITIES_URL,
  ETENDERS_BASE_URL,
  ETENDERS_GENERAL_OPPORTUNITIES_URL,
  buildEtendersTenderDetailsUrl,
  getEtendersDocumentMetadataFromSupportDocuments,
  getEtendersPdfLinksFromSupportDocuments,
  getEtendersSourceUrl,
} from '@/lib/crawler/etenders-links'

const BASE_URL = ETENDERS_BASE_URL
const OPPORTUNITIES_URL = ETENDERS_ACTIVE_OPPORTUNITIES_URL
const PAGINATED_OPPORTUNITIES_URL = `${BASE_URL}/Home/PaginatedTenderOpportunities`
const PAGE_SIZE = 100
const ALLOWED_HOSTS = new Set(['etenders.gov.za', 'www.etenders.gov.za'])

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
}

function getDefaultHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept': 'application/json, text/plain, */*',
    'Connection': 'keep-alive',
  }
}

function normalizeWhitespace(value) {
  const normalized = typeof value === 'string'
    ? value
    : (value === null || value === undefined ? '' : String(value))

  return normalized.replace(/\s+/g, ' ').trim()
}

function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '').replace(/\.$/, '')
}

function isPrivateIPv4Address(hostname) {
  const octets = hostname.split('.').map(value => Number.parseInt(value, 10))
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false
  }

  const [first, second] = octets

  return (
    first === 0
    || first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 198 && (second === 18 || second === 19))
    || first >= 224
  )
}

function isPrivateIPv6Address(hostname) {
  const normalized = hostname.toLowerCase()

  return (
    normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80')
    || normalized.startsWith('::ffff:127.')
    || normalized.startsWith('::ffff:10.')
    || normalized.startsWith('::ffff:192.168.')
  )
}

function getBlockedUrlReason(url) {
  const hostname = normalizeHostname(url.hostname)
  const ipVersion = isIP(hostname)

  if (ipVersion === 4) {
    return isPrivateIPv4Address(hostname) ? 'private-ipv4-host' : 'ip-host'
  }

  if (ipVersion === 6) {
    return isPrivateIPv6Address(hostname) ? 'private-ipv6-host' : 'ip-host'
  }

  if (!ALLOWED_HOSTS.has(hostname)) {
    return 'host-not-allowed'
  }

  if (url.protocol !== 'https:') {
    return 'protocol-not-allowed'
  }

  return null
}

export function resolveEtendersUrl(value) {
  try {
    const url = new URL(value, BASE_URL)
    const blockedReason = getBlockedUrlReason(url)

    if (blockedReason) {
      return { ok: false, reason: blockedReason, url: url.toString() }
    }

    return { ok: true, url: url.toString() }
  } catch {
    return { ok: false, reason: 'invalid-url', url: String(value || '') }
  }
}

function logBlockedEtendersUrl(value, reason) {
  logger.warn('[Crawler] Blocked non-eTenders URL', {
    reason,
    url: String(value || '').slice(0, 300),
  })
}

function buildTenderDescription(item) {
  return [
    item.description,
    item.type,
    item.category,
    item.conditions,
    item.department,
    item.organ_of_State,
    item.province,
  ]
    .map(normalizeWhitespace)
    .filter(Boolean)
    .join(' ')
}

function buildTenderLocation(item) {
  return [
    item.delivery,
    item.streetname,
    item.surburb,
    item.town,
    item.province,
  ]
    .map(normalizeWhitespace)
    .filter(Boolean)
    .join(' - ')
}

function buildBriefingDetails(item) {
  return [
    item.briefingSession,
    item.briefingVenue,
  ]
    .map(normalizeWhitespace)
    .filter(Boolean)
    .join(' - ')
}

export function mapOpportunityRow(item) {
  const sourceUrl = getEtendersSourceUrl(item)
  const sourceTenderId = item.id ? String(item.id) : null
  const sourceDetailUrl = buildEtendersTenderDetailsUrl(item.id)
  const documentMetadata = getEtendersDocumentMetadataFromSupportDocuments(item)

  return {
    id: item.id,
    sourceTenderId,
    title: normalizeWhitespace(item.description) || normalizeWhitespace(item.tender_No),
    reference: normalizeWhitespace(item.tender_No) || String(item.id),
    description: buildTenderDescription(item),
    category: normalizeWhitespace(item.category),
    advertised: item.date_Published || null,
    deadline: item.closing_Date || null,
    sourceStatus: normalizeWhitespace(item.status),
    url: sourceUrl,
    sourceName: 'eTenders.gov.za',
    sourceUrl,
    sourceDetailUrl,
    sourceFallbackUrl: ETENDERS_GENERAL_OPPORTUNITIES_URL,
    documentMetadata,
    tenderDetails: {
      entity: normalizeWhitespace(item.organ_of_State || item.department),
      briefingDate: item.compulsory_briefing_session || null,
      briefingDetails: buildBriefingDetails(item),
      siteVisitDate: null,
      contactPerson: normalizeWhitespace(item.contactPerson),
      contactEmail: normalizeWhitespace(item.email),
      province: normalizeWhitespace(item.province),
      location: buildTenderLocation(item),
      category: normalizeWhitespace(item.category),
    },
    pdfLinks: getEtendersPdfLinksFromSupportDocuments(item),
    raw: item,
  }
}

async function fetchPaginatedPage(start, length, { diagnostics = null } = {}) {
  const operationName = `Fetch paginated page (start=${start})`
  return withRetry(
    async () => {
      const response = await requestWithRateLimit({
        url: PAGINATED_OPPORTUNITIES_URL,
        operationName,
        request: () => axios.get(PAGINATED_OPPORTUNITIES_URL, {
          headers: getDefaultHeaders(),
          timeout: 45000,
          params: {
            draw: 1,
            start,
            length,
            status: 1,
          },
        }),
        onRateLimit: () => diagnostics?.recordRateLimitEvent(),
      })
      return response.data;
    },
    {
      operationName,
      baseDelayMs: RETRY_CONFIG.initialDelayMs,
      retryableAttempts: 3,
      rateLimitedAttempts: 1,
      logger,
    }
  );
}

export async function fetchETendersPage(pageNumber = 1, pageSize = PAGE_SIZE, options = {}) {
  const start = (pageNumber - 1) * pageSize
  const page = await fetchPaginatedPage(start, pageSize, options)
  const pageRows = Array.isArray(page?.data) ? page.data : []
  const totalRecords = Number(page?.recordsFiltered ?? page?.recordsTotal ?? pageRows.length)
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const tenders = pageRows
    .map(mapOpportunityRow)
    .filter(row => row.title && row.reference)

  return {
    pageNumber,
    pageSize,
    start,
    totalRecords,
    totalPages,
    rowCount: pageRows.length,
    tenders,
    firstRef: tenders[0]?.reference || null,
    lastRef: tenders[tenders.length - 1]?.reference || null,
    isLastPage: pageRows.length === 0 || pageNumber >= totalPages,
  }
}

export async function fetchETendersStructureHtml() {
  const operationName = 'Fetch eTenders structure HTML'
  return withRetry(
    async () => {
      const response = await requestWithRateLimit({
        url: OPPORTUNITIES_URL,
        operationName,
        request: () => axios.get(OPPORTUNITIES_URL, {
          headers: {
            ...getDefaultHeaders(),
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          timeout: 45000,
        }),
      })
      return response.data
    },
    {
      operationName,
      baseDelayMs: RETRY_CONFIG.initialDelayMs,
      retryableAttempts: 3,
      rateLimitedAttempts: 1,
      logger,
    }
  )
}

/**
 * Gets the entity/organ of state from a tender page with retry logic.
 */
export async function getTenderDetails(tenderInput) {
  let tenderUrl = null

  try {
    if (!tenderInput) return {}

    if (typeof tenderInput === 'object' && tenderInput.tenderDetails) {
      return tenderInput.tenderDetails
    }

    tenderUrl = typeof tenderInput === 'string' ? tenderInput : tenderInput.url
    if (!tenderUrl) return {}
    const validatedUrl = resolveEtendersUrl(tenderUrl)
    if (!validatedUrl.ok) {
      logBlockedEtendersUrl(tenderUrl, validatedUrl.reason)
      return {}
    }

    return withRetry(
      async () => {
        const response = await requestWithRateLimit({
          url: validatedUrl.url,
          operationName: `Get tender details from ${validatedUrl.url}`,
          request: () => axios.get(validatedUrl.url, {
            headers: getDefaultHeaders(),
            timeout: 45000,
          }),
        })

        const $ = cheerio.load(response.data)

        const details = {
          entity: '',
          briefingDate: null,
          siteVisitDate: null,
          contactPerson: '',
          contactEmail: '',
        }

        const pageText = $.text()
        const orgMatch = pageText.match(/(?:Organ of State|Department|Entity):\s*([^\n]+)/i)
        if (orgMatch) details.entity = orgMatch[1].trim()

        const emailMatch = pageText.match(/([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
        if (emailMatch) details.contactEmail = emailMatch[1]

        return details
      },
      {
        operationName: `Get tender details from ${validatedUrl.url}`,
        baseDelayMs: RETRY_CONFIG.initialDelayMs,
        retryableAttempts: 2,
        rateLimitedAttempts: 1,
        logger,
      }
    )
  } catch (error) {
    const classifiedError = classifyError(error)
    logger.crawler({
      level: 'error',
      message: 'Error getting tender details',
      phase: 'processing',
      error: classifiedError,
      data: {
        tenderUrl,
        errorType: classifiedError.type,
      },
    })
    return {}
  }
}

/**
 * Downloads a PDF from a given URL with retry logic and size validation.
 */
export async function downloadPDF(pdfUrl) {
  let validatedUrl = null

  try {
    if (!pdfUrl) return null
    validatedUrl = resolveEtendersUrl(pdfUrl)
    if (!validatedUrl.ok) {
      logBlockedEtendersUrl(pdfUrl, validatedUrl.reason)
      return null
    }

    return await withRetry(
      async () => {
        const response = await requestWithRateLimit({
          url: validatedUrl.url,
          operationName: `Download PDF from ${validatedUrl.url.substring(0, 80)}`,
          request: () => axios.get(validatedUrl.url, {
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: getDefaultHeaders(),
            maxContentLength: 50 * 1024 * 1024, // 50MB limit
          }),
        })

        const buffer = Buffer.from(response.data)
        logger.info(`[PDF] Downloaded ${buffer.length} bytes from ${validatedUrl.url.substring(0, 80)}...`)
        return buffer
      },
      {
        operationName: `Download PDF from ${validatedUrl.url.substring(0, 80)}`,
        baseDelayMs: RETRY_CONFIG.initialDelayMs,
        retryableAttempts: 3,
        rateLimitedAttempts: 1,
        logger,
      }
    )
  } catch (error) {
    const classifiedError = classifyError(error)
    logger.crawler({
      level: 'error',
      message: 'Error downloading PDF',
      phase: 'processing',
      error: classifiedError,
      data: {
        pdfUrl: validatedUrl?.url || pdfUrl,
        errorType: classifiedError.type,
      },
    })
    return null
  }
}

/**
 * Gets PDF links from a tender page with retry logic.
 */
export async function getPDFLinksFromTender(tenderInput) {
  let tenderUrl = null

  try {
    if (!tenderInput) return []

    if (typeof tenderInput === 'object' && Array.isArray(tenderInput.pdfLinks)) {
      return tenderInput.pdfLinks
    }

    tenderUrl = typeof tenderInput === 'string' ? tenderInput : tenderInput.url
    if (!tenderUrl) return []
    const validatedUrl = resolveEtendersUrl(tenderUrl)
    if (!validatedUrl.ok) {
      logBlockedEtendersUrl(tenderUrl, validatedUrl.reason)
      return []
    }

    return await withRetry(
      async () => {
        const response = await requestWithRateLimit({
          url: validatedUrl.url,
          operationName: `Get PDF links from ${validatedUrl.url}`,
          request: () => axios.get(validatedUrl.url, {
            headers: getDefaultHeaders(),
            timeout: 45000,
          }),
        })

        const $ = cheerio.load(response.data)
        const pdfLinks = []

        $('a[href*=".pdf"], a[href*="download"]').each((index, element) => {
          const href = $(element).attr('href')
          if (href && (href.includes('.pdf') || href.includes('download'))) {
            const validatedPdfUrl = resolveEtendersUrl(href)
            const text = $(element).text().trim()
            if (!validatedPdfUrl.ok) {
              logBlockedEtendersUrl(href, validatedPdfUrl.reason)
              return
            }
            if (validatedPdfUrl.url && text) {
              pdfLinks.push({ url: validatedPdfUrl.url, text })
            }
          }
        })

        logger.info(`[PDF] Found ${pdfLinks.length} PDF links on tender page`)
        return pdfLinks
      },
      {
        operationName: `Get PDF links from ${validatedUrl.url}`,
        baseDelayMs: RETRY_CONFIG.initialDelayMs,
        retryableAttempts: 2,
        rateLimitedAttempts: 1,
        logger,
      }
    )
  } catch (error) {
    const classifiedError = classifyError(error)
    logger.crawler({
      level: 'error',
      message: 'Error getting PDF links',
      phase: 'processing',
      error: classifiedError,
      data: {
        tenderUrl,
        errorType: classifiedError.type,
      },
    })
    return []
  }
}
