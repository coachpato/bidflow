import axios from 'axios'
import * as cheerio from 'cheerio'
import { logger } from '@/lib/logger'

const BASE_URL = 'https://www.etenders.gov.za'
const OPPORTUNITIES_URL = `${BASE_URL}/Home/opportunities?id=1`
const PAGINATED_OPPORTUNITIES_URL = `${BASE_URL}/Home/PaginatedTenderOpportunities`
const PAGE_SIZE = 100

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
  return value?.replace(/\s+/g, ' ').trim() || ''
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

function mapOpportunityRow(item) {
  return {
    id: item.id,
    title: normalizeWhitespace(item.description) || normalizeWhitespace(item.tender_No),
    reference: normalizeWhitespace(item.tender_No) || String(item.id),
    description: buildTenderDescription(item),
    category: normalizeWhitespace(item.category),
    advertised: item.date_Published || null,
    deadline: item.closing_Date || null,
    // TODO: Map a stable eTenders detail URL when the JSON endpoint exposes one.
    url: null,
    sourceName: 'eTenders.gov.za',
    sourceUrl: OPPORTUNITIES_URL,
    tenderDetails: {
      entity: normalizeWhitespace(item.organ_of_State || item.department),
      briefingDate: item.compulsory_briefing_session || null,
      siteVisitDate: null,
      contactPerson: normalizeWhitespace(item.contactPerson),
      contactEmail: normalizeWhitespace(item.email),
      province: normalizeWhitespace(item.province),
      category: normalizeWhitespace(item.category),
    },
    pdfLinks: [],
    raw: item,
  }
}

/**
 * Executes a function with exponential backoff retry logic
 */
async function withRetry(fn, operationName, retryConfig = RETRY_CONFIG) {
  let lastError;
  let delayMs = retryConfig.initialDelayMs;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on 4xx errors (except 429 - rate limit)
      if (error.response?.status && error.response.status < 500 && error.response.status !== 429) {
        throw error;
      }

      if (attempt < retryConfig.maxRetries) {
        console.warn(
          `[${operationName}] Attempt ${attempt + 1}/${retryConfig.maxRetries + 1} failed: ${error.message}. Retrying in ${delayMs}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs = Math.min(delayMs * retryConfig.backoffMultiplier, retryConfig.maxDelayMs);
      }
    }
  }

  throw new Error(`${operationName} failed after ${retryConfig.maxRetries + 1} attempts: ${lastError.message}`);
}

async function fetchPaginatedPage(start, length) {
  return withRetry(
    async () => {
      const response = await axios.get(PAGINATED_OPPORTUNITIES_URL, {
        headers: getDefaultHeaders(),
        timeout: 45000,
        params: {
          draw: 1,
          start,
          length,
          status: 1,
        },
      });
      return response.data;
    },
    `Fetch paginated page (start=${start})`,
    { ...RETRY_CONFIG, maxRetries: 2 }
  );
}

/**
 * Fetches tender listings from the eTenders DataTables JSON endpoint with retry logic.
 * Returns array of tender objects with normalized fields.
 */
export async function crawlETenders() {
  try {
    logger.info('[Crawler] Starting eTenders portal crawl...')

    const tenders = []
    let start = 0
    let totalRecords = null
    let pagesFetched = 0

    while (totalRecords === null || start < totalRecords) {
      try {
        const page = await fetchPaginatedPage(start, PAGE_SIZE)
        const pageRows = Array.isArray(page?.data) ? page.data : []

        if (totalRecords === null) {
          totalRecords = Number(page?.recordsFiltered ?? page?.recordsTotal ?? pageRows.length)
          logger.info(`[Crawler] Total records to fetch: ${totalRecords}`)
        }

        if (pageRows.length === 0) {
          logger.info(`[Crawler] Page ${pagesFetched} returned no data, stopping pagination`)
          break
        }

        const mappedRows = pageRows
          .map(mapOpportunityRow)
          .filter(row => row.title && row.reference) // Validate required fields

        tenders.push(...mappedRows)
        pagesFetched += 1
        logger.info(`[Crawler] Page ${pagesFetched}: Fetched ${pageRows.length} rows, mapped ${mappedRows.length}`)

        start += pageRows.length
      } catch (error) {
        console.error(`[Crawler] Error fetching page starting at ${start}:`, error.message)
        // Continue with next page to be resilient
        start += PAGE_SIZE
      }
    }

    logger.info(`[Crawler] Successfully crawled ${tenders.length} tenders from eTenders in ${pagesFetched} pages`)
    return tenders
  } catch (error) {
    console.error('[Crawler] Fatal error crawling eTenders:', error.message)
    throw error
  }
}

/**
 * Gets the entity/organ of state from a tender page with retry logic.
 */
export async function getTenderDetails(tenderInput) {
  try {
    if (!tenderInput) return {}

    if (typeof tenderInput === 'object' && tenderInput.tenderDetails) {
      return tenderInput.tenderDetails
    }

    const tenderUrl = typeof tenderInput === 'string' ? tenderInput : tenderInput.url
    if (!tenderUrl) return {}

    return withRetry(
      async () => {
        const response = await axios.get(tenderUrl, {
          headers: getDefaultHeaders(),
          timeout: 45000,
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
      `Get tender details from ${tenderUrl}`,
      { ...RETRY_CONFIG, maxRetries: 1 }
    )
  } catch (error) {
    console.error('Error getting tender details:', error.message)
    return {}
  }
}

/**
 * Downloads a PDF from a given URL with retry logic and size validation.
 */
export async function downloadPDF(pdfUrl) {
  try {
    if (!pdfUrl) return null

    return await withRetry(
      async () => {
        const response = await axios.get(pdfUrl, {
          responseType: 'arraybuffer',
          timeout: 60000,
          headers: getDefaultHeaders(),
          maxContentLength: 50 * 1024 * 1024, // 50MB limit
        })

        const buffer = Buffer.from(response.data)
        logger.info(`[PDF] Downloaded ${buffer.length} bytes from ${pdfUrl.substring(0, 80)}...`)
        return buffer
      },
      `Download PDF from ${pdfUrl.substring(0, 80)}`,
      { ...RETRY_CONFIG, maxRetries: 2 }
    )
  } catch (error) {
    console.error(`Error downloading PDF:`, error.message)
    return null
  }
}

/**
 * Gets PDF links from a tender page with retry logic.
 */
export async function getPDFLinksFromTender(tenderInput) {
  try {
    if (!tenderInput) return []

    if (typeof tenderInput === 'object' && Array.isArray(tenderInput.pdfLinks)) {
      return tenderInput.pdfLinks
    }

    const tenderUrl = typeof tenderInput === 'string' ? tenderInput : tenderInput.url
    if (!tenderUrl) return []

    return await withRetry(
      async () => {
        const response = await axios.get(tenderUrl, {
          headers: getDefaultHeaders(),
          timeout: 45000,
        })

        const $ = cheerio.load(response.data)
        const pdfLinks = []

        $('a[href*=".pdf"], a[href*="download"]').each((index, element) => {
          const href = $(element).attr('href')
          if (href && (href.includes('.pdf') || href.includes('download'))) {
            const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`
            const text = $(element).text().trim()
            if (fullUrl && text) {
              pdfLinks.push({ url: fullUrl, text })
            }
          }
        })

        logger.info(`[PDF] Found ${pdfLinks.length} PDF links on tender page`)
        return pdfLinks
      },
      `Get PDF links from ${tenderUrl}`,
      { ...RETRY_CONFIG, maxRetries: 1 }
    )
  } catch (error) {
    console.error('Error getting PDF links:', error.message)
    return []
  }
}
