import axios from 'axios'
import * as cheerio from 'cheerio'

const BASE_URL = 'https://www.etenders.gov.za'
const OPPORTUNITIES_URL = `${BASE_URL}/Home/opportunities?id=1`
const PAGINATED_OPPORTUNITIES_URL = `${BASE_URL}/Home/PaginatedTenderOpportunities`
const PAGE_SIZE = 100

function getDefaultHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

async function fetchPaginatedPage(start, length) {
  const response = await axios.get(PAGINATED_OPPORTUNITIES_URL, {
    headers: getDefaultHeaders(),
    timeout: 30000,
    params: {
      draw: 1,
      start,
      length,
      status: 1,
    },
  })

  return response.data
}

/**
 * Fetches tender listings from the current DataTables JSON endpoint.
 * Returns array of tender objects with normalized fields used by the radar.
 */
export async function crawlETenders() {
  try {
    console.log('Fetching eTenders portal...')

    const tenders = []
    let start = 0
    let totalRecords = null

    while (totalRecords === null || start < totalRecords) {
      const page = await fetchPaginatedPage(start, PAGE_SIZE)
      const pageRows = Array.isArray(page?.data) ? page.data : []

      if (totalRecords === null) {
        totalRecords = Number(page?.recordsFiltered ?? page?.recordsTotal ?? pageRows.length)
      }

      if (pageRows.length === 0) break

      tenders.push(...pageRows.map(mapOpportunityRow))
      start += pageRows.length
    }

    console.log(`Successfully crawled ${tenders.length} tenders from eTenders`)
    return tenders
  } catch (error) {
    console.error('Error crawling eTenders:', error.message)
    throw error
  }
}

/**
 * Gets the entity/organ of state from a tender page.
 * If upstream crawl data already carries rich details, reuse them first.
 */
export async function getTenderDetails(tenderInput) {
  try {
    if (!tenderInput) return {}

    if (typeof tenderInput === 'object' && tenderInput.tenderDetails) {
      return tenderInput.tenderDetails
    }

    const tenderUrl = typeof tenderInput === 'string' ? tenderInput : tenderInput.url
    if (!tenderUrl) return {}

    const response = await axios.get(tenderUrl, {
      headers: getDefaultHeaders(),
      timeout: 30000,
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
  } catch (error) {
    console.error('Error getting tender details:', error.message)
    return {}
  }
}

/**
 * Downloads a PDF from a given URL.
 * Returns buffer of PDF content.
 */
export async function downloadPDF(pdfUrl) {
  try {
    if (!pdfUrl) return null

    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: getDefaultHeaders(),
    })

    return Buffer.from(response.data)
  } catch (error) {
    console.error(`Error downloading PDF from ${pdfUrl}:`, error.message)
    return null
  }
}

/**
 * Gets PDF links from a tender page.
 * If upstream crawl data already carries support docs, return those links.
 */
export async function getPDFLinksFromTender(tenderInput) {
  try {
    if (!tenderInput) return []

    if (typeof tenderInput === 'object' && Array.isArray(tenderInput.pdfLinks)) {
      return tenderInput.pdfLinks
    }

    const tenderUrl = typeof tenderInput === 'string' ? tenderInput : tenderInput.url
    if (!tenderUrl) return []

    const response = await axios.get(tenderUrl, {
      headers: getDefaultHeaders(),
      timeout: 30000,
    })

    const $ = cheerio.load(response.data)
    const pdfLinks = []

    $('a[href*=".pdf"], a[href*="download"]').each((index, element) => {
      const href = $(element).attr('href')
      if (href && (href.includes('.pdf') || href.includes('download'))) {
        const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`
        pdfLinks.push({
          url: fullUrl,
          text: $(element).text().trim(),
        })
      }
    })

    return pdfLinks
  } catch (error) {
    console.error('Error getting PDF links:', error.message)
    return []
  }
}
