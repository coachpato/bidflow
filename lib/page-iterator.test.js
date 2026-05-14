import {
  createCursorFromPage,
  getResumeStartPage,
  validateCursor,
} from './page-iterator'

function page(pageNumber, refs) {
  return {
    pageNumber,
    pageSize: 100,
    totalPages: 3,
    isLastPage: pageNumber === 3,
    tenders: refs.map(reference => ({ reference })),
  }
}

describe('page cursor validation', () => {
  it('creates a cursor after a completed page and resumes from the next page', () => {
    const cursor = createCursorFromPage(page(2, ['A', 'B', 'C']))

    expect(cursor).toMatchObject({
      lastProcessedPage: 2,
      nextPage: 3,
      lastProcessedRef: 'C',
      firstRefOnPage: 'A',
      lastRefOnPage: 'C',
      totalPagesExpected: 3,
    })
    expect(getResumeStartPage(cursor)).toBe(3)
  })

  it('validates a cursor when the reference tender still exists on the expected page', async () => {
    const fetchPage = jest.fn(async () => page(2, ['A', 'B', 'C']))
    const logger = { warn: jest.fn() }

    const result = await validateCursor({
      cursor: {
        lastProcessedPage: 2,
        nextPage: 3,
        lastProcessedRef: 'B',
        firstRefOnPage: 'A',
        lastRefOnPage: 'C',
      },
      fetchPage,
      logger,
    })

    expect(result.valid).toBe(true)
    expect(result.reason).toBe('reference-found')
    expect(fetchPage).toHaveBeenCalledWith(2)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('detects when the old cursor reference is no longer on the expected source page', async () => {
    const fetchPage = jest.fn(async () => page(2, ['X', 'Y', 'Z']))
    const logger = { warn: jest.fn() }

    const result = await validateCursor({
      cursor: {
        lastProcessedPage: 2,
        nextPage: 3,
        lastProcessedRef: 'B',
        firstRefOnPage: 'A',
        lastRefOnPage: 'C',
      },
      fetchPage,
      logger,
    })

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('reference-not-found')
    expect(logger.warn).toHaveBeenCalledWith(
      'crawler_cursor_invalid',
      expect.objectContaining({ page: 2, ref: 'B' })
    )
  })
})
