import { createHostRateLimiter, requestWithRateLimit } from './rate-limiter'

function createRateLimitError(retryAfter = null) {
  return {
    message: 'Too many requests',
    response: {
      status: 429,
      headers: retryAfter ? { 'retry-after': retryAfter } : {},
    },
  }
}

describe('crawler host rate limiter', () => {
  it('enforces two second spacing for requests to the same host', async () => {
    let currentTime = 0
    const sleeps = []
    const limiter = createHostRateLimiter({
      now: () => currentTime,
      sleep: async ms => {
        sleeps.push(ms)
        currentTime += ms
      },
      logger: { crawler: jest.fn() },
    })

    await requestWithRateLimit({
      url: 'https://www.etenders.gov.za/a',
      operationName: 'first',
      request: jest.fn(async () => ({ data: 'ok' })),
      limiter,
    })
    await requestWithRateLimit({
      url: 'https://www.etenders.gov.za/b',
      operationName: 'second',
      request: jest.fn(async () => ({ data: 'ok' })),
      limiter,
    })

    expect(sleeps).toEqual([2000])
  })

  it('does not serialize unrelated hosts behind the same timestamp', async () => {
    const sleeps = []
    const limiter = createHostRateLimiter({
      now: () => 0,
      sleep: async ms => sleeps.push(ms),
      logger: { crawler: jest.fn() },
    })

    await requestWithRateLimit({
      url: 'https://source-a.example/a',
      operationName: 'a',
      request: jest.fn(async () => ({ data: 'ok' })),
      limiter,
    })
    await requestWithRateLimit({
      url: 'https://source-b.example/b',
      operationName: 'b',
      request: jest.fn(async () => ({ data: 'ok' })),
      limiter,
    })

    expect(sleeps).toEqual([])
  })

  it('honors Retry-After on 429 before retrying', async () => {
    let currentTime = 0
    const sleeps = []
    const request = jest
      .fn()
      .mockRejectedValueOnce(createRateLimitError('3'))
      .mockResolvedValueOnce({ data: 'ok' })
    const limiter = createHostRateLimiter({
      now: () => currentTime,
      sleep: async ms => {
        sleeps.push(ms)
        currentTime += ms
      },
      logger: { crawler: jest.fn() },
    })

    await requestWithRateLimit({
      url: 'https://www.etenders.gov.za/a',
      operationName: 'retry-after',
      request,
      limiter,
    })

    expect(request).toHaveBeenCalledTimes(2)
    expect(sleeps).toEqual([3000])
  })

  it('pauses for sixty seconds after three consecutive 429 responses', async () => {
    let currentTime = 0
    const sleeps = []
    const request = jest
      .fn()
      .mockRejectedValueOnce(createRateLimitError())
      .mockRejectedValueOnce(createRateLimitError())
      .mockRejectedValueOnce(createRateLimitError())
      .mockResolvedValueOnce({ data: 'ok' })
    const limiter = createHostRateLimiter({
      now: () => currentTime,
      random: () => 0,
      sleep: async ms => {
        sleeps.push(ms)
        currentTime += ms
      },
      logger: { crawler: jest.fn() },
    })

    await requestWithRateLimit({
      url: 'https://www.etenders.gov.za/a',
      operationName: 'three-429s',
      request,
      limiter,
    })

    expect(request).toHaveBeenCalledTimes(4)
    expect(sleeps).toContain(60_000)
  })
})
