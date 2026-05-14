export function getTenderResumeRef(tender) {
  return tender?.reference || tender?.url || tender?.title || null
}

export function createCursorFromPage(pageBatch) {
  const refs = pageBatch.tenders.map(getTenderResumeRef).filter(Boolean)
  const lastProcessedRef = refs[refs.length - 1] || null

  return {
    lastProcessedPage: pageBatch.pageNumber,
    nextPage: pageBatch.isLastPage ? null : pageBatch.pageNumber + 1,
    lastProcessedRef,
    firstRefOnPage: refs[0] || null,
    lastRefOnPage: lastProcessedRef,
    totalPagesExpected: pageBatch.totalPages,
    pageSize: pageBatch.pageSize,
    savedAt: new Date().toISOString(),
  }
}

export function getResumeStartPage(cursor) {
  if (!cursor) return 1
  if (Number.isInteger(cursor.nextPage) && cursor.nextPage > 0) return cursor.nextPage
  if (Number.isInteger(cursor.lastProcessedPage) && cursor.lastProcessedPage > 0) {
    return cursor.lastProcessedPage + 1
  }
  return 1
}

/**
 * Validates a resume cursor against the source page before trusting it to skip earlier pages.
 */
export async function validateCursor({
  cursor,
  fetchPage,
  logger = console,
} = {}) {
  if (!cursor?.lastProcessedPage || !cursor.lastProcessedRef) {
    return { valid: false, reason: 'missing-cursor' }
  }

  const page = await fetchPage(cursor.lastProcessedPage)
  const refs = page.tenders.map(getTenderResumeRef).filter(Boolean)
  const hasReference = refs.includes(cursor.lastProcessedRef)

  if (!hasReference) {
    logger.warn?.('crawler_cursor_invalid', {
      page: cursor.lastProcessedPage,
      ref: cursor.lastProcessedRef,
      reason: 'reference-not-found',
    })
    return { valid: false, reason: 'reference-not-found', page }
  }

  const firstRef = refs[0] || null
  const lastRef = refs[refs.length - 1] || null
  const pageBoundaryChanged = Boolean(
    cursor.firstRefOnPage
    && cursor.lastRefOnPage
    && (cursor.firstRefOnPage !== firstRef || cursor.lastRefOnPage !== lastRef)
  )

  if (pageBoundaryChanged) {
    logger.warn?.('crawler_cursor_page_boundary_changed', {
      page: cursor.lastProcessedPage,
      expectedFirstRef: cursor.firstRefOnPage,
      expectedLastRef: cursor.lastRefOnPage,
      actualFirstRef: firstRef,
      actualLastRef: lastRef,
    })
  }

  return {
    valid: true,
    reason: pageBoundaryChanged ? 'reference-found-boundary-changed' : 'reference-found',
    page,
  }
}
