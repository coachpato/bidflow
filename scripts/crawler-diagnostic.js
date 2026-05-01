const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { registerHooks } = require('node:module')
const axios = require('axios')

const rootDir = path.resolve(__dirname, '..')
const DIAGNOSTIC_REQUEST_TIMEOUT_MS = 15000
const MAX_SOURCE_REQUESTS_PER_RUN = 1

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const localPath = path.join(rootDir, `${specifier.slice(2)}.js`)
      return nextResolve(pathToFileURL(localPath).href, context)
    }

    return nextResolve(specifier, context)
  },
})

const SECTORS = [
  'LEGAL_SERVICES',
  'FINANCIAL_SERVICES',
  'GREEN_ENERGY',
  'BUILT_ENVIRONMENT',
]

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function stringifyLogPart(value) {
  if (value instanceof Error) return value.stack || value.message
  if (typeof value === 'string') return value

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

async function main() {
  const originalGet = axios.get.bind(axios)
  const capturedErrors = []
  const originalConsoleError = console.error
  let activeRun = null

  console.error = (...args) => {
    capturedErrors.push(args.map(stringifyLogPart).join(' '))
    originalConsoleError(...args)
  }

  axios.get = async (url, config = {}) => {
    const urlString = String(url)
    const isSourceRequest = urlString.includes('etenders.gov.za')

    if (!isSourceRequest || !activeRun) {
      return originalGet(url, config)
    }

    const diagnosticConfig = {
      ...config,
      timeout: Math.min(
        config.timeout || DIAGNOSTIC_REQUEST_TIMEOUT_MS,
        DIAGNOSTIC_REQUEST_TIMEOUT_MS
      ),
    }

    if (activeRun.sourceRequests.length >= activeRun.maxSourceRequests) {
      activeRun.syntheticStops += 1
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'x-diagnostic-synthetic-stop': 'true' },
        config: diagnosticConfig,
        data: {
          draw: diagnosticConfig.params?.draw || 1,
          recordsTotal: 0,
          recordsFiltered: 0,
          data: [],
        },
      }
    }

    const requestRecord = {
      url: urlString,
      params: diagnosticConfig.params || null,
      status: null,
      durationMs: null,
      rows: null,
      recordsTotal: null,
      recordsFiltered: null,
      error: null,
    }

    activeRun.sourceRequests.push(requestRecord)
    const startedAt = Date.now()

    try {
      const response = await originalGet(url, diagnosticConfig)
      requestRecord.status = response.status
      requestRecord.durationMs = Date.now() - startedAt
      requestRecord.rows = Array.isArray(response.data?.data) ? response.data.data.length : null
      requestRecord.recordsTotal = response.data?.recordsTotal ?? null
      requestRecord.recordsFiltered = response.data?.recordsFiltered ?? null

      if (urlString.includes('/Home/PaginatedTenderOpportunities') && Array.isArray(response.data?.data)) {
        activeRun.sourceRows += response.data.data.length
        response.data = {
          ...response.data,
          recordsTotal: response.data.data.length,
          recordsFiltered: response.data.data.length,
        }
      }

      return response
    } catch (error) {
      requestRecord.status = error.response?.status || null
      requestRecord.durationMs = Date.now() - startedAt
      requestRecord.error = error.message
      throw error
    }
  }

  const crawlerModule = await import(pathToFileURL(path.join(rootDir, 'lib/crawler/etenders-crawler.js')).href)
  const matcherModule = await import(pathToFileURL(path.join(rootDir, 'lib/crawler/keyword-matcher.js')).href)
  const sectorsModule = await import(pathToFileURL(path.join(rootDir, 'lib/service-sectors.js')).href)

  function classifyTender(tender) {
    const matches = SECTORS
      .map(sector => {
        const analysis = matcherModule.analyzeTenderForSector(
          sector,
          tender.title,
          tender.description,
          ''
        )
        const practiceArea = matcherModule.identifyPracticeAreaForSector(
          sector,
          analysis.matchedKeywords || []
        )

        return {
          sector,
          label: sectorsModule.getServiceSectorLabel(sector),
          score: analysis.score,
          matchCount: analysis.matchCount,
          practiceArea,
          matchedKeywords: analysis.matchedKeywords,
          isSectorOpportunity: analysis.isSectorOpportunity,
        }
      })
      .filter(item => item.isSectorOpportunity)
      .sort((left, right) => right.score - left.score || right.matchCount - left.matchCount)

    if (matches.length === 0) return null

    const best = matches[0]
    return {
      sector: best.sector,
      label: best.label,
      score: best.score,
      practiceArea: best.practiceArea,
      matchedKeywords: best.matchedKeywords.slice(0, 6),
    }
  }

  const runs = []

  for (let index = 1; index <= 3; index += 1) {
    const runErrorStart = capturedErrors.length
    activeRun = {
      index,
      maxSourceRequests: MAX_SOURCE_REQUESTS_PER_RUN,
      sourceRows: 0,
      sourceRequests: [],
      syntheticStops: 0,
    }

    const startedAt = Date.now()
    let tenders = []
    let thrownError = null

    try {
      tenders = await crawlerModule.crawlETenders()
    } catch (error) {
      thrownError = error.message
    }

    const durationMs = Date.now() - startedAt
    const runErrors = capturedErrors.slice(runErrorStart)
    const skippedItems = Math.max(0, activeRun.sourceRows - tenders.length)

    runs.push({
      run: index,
      durationMs,
      sourceRequests: activeRun.sourceRequests,
      syntheticStops: activeRun.syntheticStops,
      sourceRows: activeRun.sourceRows,
      tendersParsed: tenders.length,
      skippedItems,
      parseErrors: runErrors.filter(line => line.includes('[Crawler] Error fetching page')).length,
      errors: [
        ...runErrors,
        ...(thrownError ? [`Thrown error: ${thrownError}`] : []),
      ],
      firstFive: tenders.slice(0, 5).map(tender => ({
        title: tender.title,
        deadline: tender.deadline,
        sourceUrl: tender.url || tender.sourceUrl,
        sectorClassification: classifyTender(tender),
      })),
    })

    activeRun = null

    if (thrownError || tenders.length === 0) {
      break
    }

    if (index < 3) {
      await wait(30000)
    }
  }

  console.error = originalConsoleError

  console.log(JSON.stringify({
    diagnosticMode: 'crawler-imported-single-page-cap',
    capReason: 'Each crawlETenders() run is capped to the first live DataTables page to stay within the requested source-hit limit.',
    generatedAt: new Date().toISOString(),
    runs,
  }, null, 2))
}

main().catch(error => {
  console.error(error.stack || error.message)
  process.exit(1)
})
