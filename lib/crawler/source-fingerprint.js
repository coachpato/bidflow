import { createHash } from 'node:crypto'
import * as cheerio from 'cheerio'
import { CrawlError, CRAWL_ERROR_TYPES } from '@/lib/errors'

const STRUCTURE_SELECTORS = [
  { selector: 'body', required: true },
  { selector: 'table', required: false },
  { selector: 'tbody tr', required: false },
  { selector: '.dataTables_wrapper', required: false },
  { selector: 'script[src*="DataTables"], script[src*="datatables"]', required: false },
]

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function getRawKeys(pageBatch) {
  const raw = pageBatch.tenders?.[0]?.raw || {}
  return Object.keys(raw).sort()
}

function getSelectorCounts(html) {
  if (!html) {
    return STRUCTURE_SELECTORS.map(item => ({
      ...item,
      count: 0,
    }))
  }

  const $ = cheerio.load(html)
  return STRUCTURE_SELECTORS.map(item => ({
    ...item,
    count: $(item.selector).length,
  }))
}

export function captureSourceFingerprint({ pageBatch, html = '' }) {
  const selectors = getSelectorCounts(html)
  const rawKeys = getRawKeys(pageBatch)
  const tenderCardsFound = Number(pageBatch.rowCount ?? pageBatch.tenders?.length ?? 0)
  const keyStructure = {
    selectors: selectors.map(({ selector, count, required }) => ({ selector, count, required })),
    rawKeys,
    tenderFields: Object.keys(pageBatch.tenders?.[0] || {}).filter(key => key !== 'raw').sort(),
    pageSize: pageBatch.pageSize,
  }

  return {
    version: 1,
    capturedFrom: 'etenders-json-and-html',
    tenderCardsFound,
    workingSelectors: selectors.filter(item => item.count > 0).map(item => item.selector),
    requiredSelectors: selectors.filter(item => item.required).map(({ selector, count }) => ({ selector, count })),
    selectorCounts: selectors.map(({ selector, count }) => ({ selector, count })),
    rawKeys,
    structureHash: stableHash(keyStructure),
  }
}

export function compareSourceFingerprints(previous, current) {
  if (!previous) {
    return { severity: 'none', changed: true, reasons: ['fingerprint-bootstrap'] }
  }

  if (current.tenderCardsFound === 0) {
    return { severity: 'fatal', changed: true, reasons: ['no-tender-cards-found'] }
  }

  const reasons = []
  if (
    previous.tenderCardsFound > 0
    && current.tenderCardsFound < previous.tenderCardsFound * 0.5
  ) {
    reasons.push('tender-count-dropped')
  }

  for (const requiredSelector of previous.requiredSelectors || []) {
    if (requiredSelector.count <= 0) continue
    const currentSelector = current.requiredSelectors.find(item => item.selector === requiredSelector.selector)
    if (!currentSelector || currentSelector.count === 0) {
      reasons.push(`required-selector-missing:${requiredSelector.selector}`)
    }
  }

  const changed = previous.structureHash !== current.structureHash
  return {
    severity: reasons.length > 0 ? 'warning' : 'none',
    changed,
    reasons: reasons.length > 0 ? reasons : changed ? ['structure-hash-changed'] : [],
  }
}

async function readStoredFingerprint({ db, sourceId }) {
  const row = await db.sourceFingerprint.findUnique({
    where: { sourceId },
  })

  return row?.fingerprint || null
}

async function upsertStoredFingerprint({ db, sourceId, fingerprint }) {
  return db.sourceFingerprint.upsert({
    where: { sourceId },
    create: {
      sourceId,
      fingerprint,
    },
    update: {
      fingerprint,
      capturedAt: new Date(),
    },
  })
}

/**
 * Detects source structure drift before a run commits to processing the crawled page.
 */
export async function validateAndStoreSourceFingerprint({
  db,
  sourceId,
  pageBatch,
  fetchHtml,
  diagnostics,
  logger = console,
}) {
  let html = ''

  try {
    html = fetchHtml ? await fetchHtml() : ''
  } catch (error) {
    logger.crawler?.({
      level: 'warn',
      phase: 'discovery',
      message: 'crawler_structure_html_fetch_failed',
      error,
      data: { sourceId },
    })
  }

  const previous = await readStoredFingerprint({ db, sourceId })
  const current = captureSourceFingerprint({ pageBatch, html })
  const comparison = compareSourceFingerprints(previous, current)
  const change = {
    severity: comparison.severity,
    changed: comparison.changed,
    reasons: comparison.reasons,
    previousTenderCardsFound: previous?.tenderCardsFound ?? null,
    currentTenderCardsFound: current.tenderCardsFound,
    previousHash: previous?.structureHash || null,
    currentHash: current.structureHash,
  }

  if (comparison.severity !== 'none' || comparison.changed) {
    diagnostics.recordStructureChange(change)
  }

  if (comparison.severity === 'fatal') {
    throw new CrawlError(
      'eTenders structure changed radically: no tender cards were found.',
      CRAWL_ERROR_TYPES.FATAL,
      null,
      change
    )
  }

  if (!previous || comparison.changed || comparison.severity === 'warning') {
    await upsertStoredFingerprint({ db, sourceId, fingerprint: current })
  }

  return {
    ...change,
    fingerprint: current,
  }
}
