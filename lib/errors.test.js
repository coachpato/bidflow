import {
  CRAWL_ERROR_TYPES,
  CrawlError,
  classifyError,
  withRetry,
} from './errors'

function createTestLogger() {
  return {
    warn: jest.fn(),
    error: jest.fn(),
  }
}

describe('crawler error classification', () => {
  it('classifies HTTP 429 as rate limited and reads Retry-After', () => {
    const error = new Error('Too many requests')
    error.response = {
      status: 429,
      headers: { 'retry-after': '2' },
    }

    const classified = classifyError(error)

    expect(classified).toBeInstanceOf(CrawlError)
    expect(classified.type).toBe(CRAWL_ERROR_TYPES.RATE_LIMITED)
    expect(classified.retryAfterMs).toBe(2000)
  })

  it('classifies HTTP 500 as retryable', () => {
    const error = new Error('Service unavailable')
    error.response = { status: 503 }

    expect(classifyError(error).type).toBe(CRAWL_ERROR_TYPES.RETRYABLE)
  })

  it('classifies network throws as retryable', () => {
    const error = new TypeError('fetch failed')

    expect(classifyError(error).type).toBe(CRAWL_ERROR_TYPES.RETRYABLE)
  })

  it('classifies parse failures as source data invalid', () => {
    const error = new SyntaxError('Unexpected token in JSON')

    expect(classifyError(error).type).toBe(CRAWL_ERROR_TYPES.SOURCE_DATA_INVALID)
  })
})

describe('withRetry', () => {
  it('retries retryable errors with exponential backoff and jitter hook', async () => {
    const logger = createTestLogger()
    const delays = []
    const fn = jest.fn()
      .mockRejectedValueOnce(Object.assign(new Error('Temporary failure'), { response: { status: 500 } }))
      .mockRejectedValueOnce(Object.assign(new Error('Still failing'), { response: { status: 500 } }))
      .mockResolvedValueOnce('ok')

    await expect(withRetry(fn, {
      operationName: 'fetch page',
      sleep: async delayMs => delays.push(delayMs),
      random: () => 0,
      logger,
    })).resolves.toBe('ok')

    expect(fn).toHaveBeenCalledTimes(3)
    expect(delays).toEqual([1000, 2000])
    expect(logger.warn).toHaveBeenCalledTimes(2)
  })

  it('respects Retry-After for rate-limited errors', async () => {
    const logger = createTestLogger()
    const delays = []
    const rateLimit = Object.assign(new Error('Too many requests'), {
      response: {
        status: 429,
        headers: { 'retry-after': '3' },
      },
    })
    const fn = jest.fn()
      .mockRejectedValueOnce(rateLimit)
      .mockResolvedValueOnce('ok')

    await expect(withRetry(fn, {
      operationName: 'fetch page',
      sleep: async delayMs => delays.push(delayMs),
      random: () => 0,
      logger,
    })).resolves.toBe('ok')

    expect(fn).toHaveBeenCalledTimes(2)
    expect(delays).toEqual([3000])
  })

  it('retries network timeouts before failing the crawl operation', async () => {
    const logger = createTestLogger()
    const delays = []
    const timeout = Object.assign(new Error('connect ETIMEDOUT 164.151.136.188:443'), {
      code: 'ETIMEDOUT',
    })
    const fn = jest.fn()
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce('ok')

    await expect(withRetry(fn, {
      operationName: 'fetch page',
      sleep: async delayMs => delays.push(delayMs),
      random: () => 0,
      logger,
    })).resolves.toBe('ok')

    expect(fn).toHaveBeenCalledTimes(2)
    expect(delays).toEqual([1000])
    expect(logger.warn).toHaveBeenCalledWith(
      'crawl_retry_scheduled',
      expect.objectContaining({ operationName: 'fetch page', errorType: CRAWL_ERROR_TYPES.TIMEOUT })
    )
  })

  it('does not retry source data errors', async () => {
    const logger = createTestLogger()
    const fn = jest.fn().mockRejectedValue(new SyntaxError('Invalid JSON'))

    await expect(withRetry(fn, {
      operationName: 'parse page',
      sleep: async () => {},
      logger,
    })).rejects.toMatchObject({
      type: CRAWL_ERROR_TYPES.SOURCE_DATA_INVALID,
    })

    expect(fn).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith(
      'crawl_error_not_retryable',
      expect.objectContaining({ type: CRAWL_ERROR_TYPES.SOURCE_DATA_INVALID }),
      expect.objectContaining({ operationName: 'parse page' })
    )
  })
})
