const DEFAULT_MIN_INTERVAL_MS = 2000
const DEFAULT_INITIAL_429_BACKOFF_MS = 2000
const DEFAULT_MAX_429_BACKOFF_MS = 60_000
const DEFAULT_MAX_429_ATTEMPTS = 5

function defaultSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getHost(url) {
  return new URL(url).host
}

function parseRetryAfterMs(value, now) {
  if (!value) return null
  const retryAfter = Array.isArray(value) ? value[0] : value
  const seconds = Number.parseInt(retryAfter, 10)

  if (Number.isFinite(seconds)) {
    return seconds * 1000
  }

  const dateMs = new Date(retryAfter).getTime()
  return Number.isNaN(dateMs) ? null : Math.max(0, dateMs - now())
}

function getRetryAfterMs(error, now) {
  const headers = error?.response?.headers || error?.headers
  if (!headers) return null

  if (typeof headers.get === 'function') {
    return parseRetryAfterMs(headers.get('retry-after'), now)
  }

  return parseRetryAfterMs(headers['retry-after'] || headers['Retry-After'], now)
}

function isHttp429(error) {
  return error?.response?.status === 429 || error?.status === 429 || error?.statusCode === 429
}

function calculateJitteredBackoffMs(attempt, random) {
  const baseDelay = Math.min(
    DEFAULT_MAX_429_BACKOFF_MS,
    DEFAULT_INITIAL_429_BACKOFF_MS * (2 ** Math.max(0, attempt - 1))
  )
  const jitterMultiplier = 0.75 + (random() * 0.5)
  return Math.round(Math.min(DEFAULT_MAX_429_BACKOFF_MS, baseDelay * jitterMultiplier))
}

function logRateLimitEvent(logger, payload) {
  logger.crawler?.({
    level: payload.level || 'warn',
    phase: payload.phase || 'discovery',
    message: payload.message,
    data: payload.data,
  })
}

export function createHostRateLimiter({
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
  sleep = defaultSleep,
  now = () => Date.now(),
  random = Math.random,
  logger = console,
} = {}) {
  const hosts = new Map()

  function getState(host) {
    if (!hosts.has(host)) {
      hosts.set(host, {
        lastRequestAt: null,
        consecutive429s: 0,
        queue: Promise.resolve(),
      })
    }

    return hosts.get(host)
  }

  async function waitForHost(host, operationName) {
    const state = getState(host)
    const waitMs = state.lastRequestAt === null
      ? 0
      : Math.max(0, state.lastRequestAt + minIntervalMs - now())

    if (waitMs > 0) {
      logRateLimitEvent(logger, {
        message: 'crawler_rate_limit_spacing_wait',
        data: { host, operationName, waitMs },
      })
      await sleep(waitMs)
    }

    state.lastRequestAt = now()
  }

  async function schedule(url, operationName) {
    const host = getHost(url)
    const state = getState(host)
    const scheduled = state.queue.then(() => waitForHost(host, operationName))
    state.queue = scheduled.catch(() => {})
    await scheduled
    return host
  }

  async function handle429({ host, error, attempt, operationName }) {
    const state = getState(host)
    state.consecutive429s += 1
    const retryAfterMs = getRetryAfterMs(error, now)
    const backoffMs = retryAfterMs ?? calculateJitteredBackoffMs(attempt, random)
    const delayMs = state.consecutive429s >= 3 ? Math.max(backoffMs, 60_000) : backoffMs

    logRateLimitEvent(logger, {
      message: state.consecutive429s >= 3
        ? 'crawler_rate_limit_consecutive_pause'
        : 'crawler_rate_limit_429_backoff',
      data: {
        host,
        operationName,
        attempt,
        consecutive429s: state.consecutive429s,
        retryAfterMs,
        delayMs,
      },
    })

    await sleep(delayMs)
  }

  function recordSuccess(host) {
    getState(host).consecutive429s = 0
  }

  function reset() {
    hosts.clear()
  }

  return {
    schedule,
    handle429,
    recordSuccess,
    reset,
  }
}

export const defaultCrawlerRateLimiter = createHostRateLimiter()

export async function requestWithRateLimit({
  url,
  operationName,
  request,
  limiter = defaultCrawlerRateLimiter,
  max429Attempts = DEFAULT_MAX_429_ATTEMPTS,
  onRateLimit = null,
}) {
  let attempt = 0

  while (true) {
    const host = await limiter.schedule(url, operationName)

    try {
      const response = await request()
      limiter.recordSuccess(host)
      return response
    } catch (error) {
      if (!isHttp429(error)) {
        throw error
      }

      attempt += 1
      onRateLimit?.(error)
      if (attempt >= max429Attempts) {
        throw error
      }

      await limiter.handle429({ host, error, attempt, operationName })
    }
  }
}
