const rateLimitBuckets = new Map()

export const TOO_MANY_ATTEMPTS_ERROR = 'Too many attempts. Try again later.'

function getHeaderValue(headers, name) {
  return headers.get(name) || headers.get(name.toLowerCase()) || ''
}

export function getClientIp(request) {
  const forwardedFor = getHeaderValue(request.headers, 'x-forwarded-for')
  const forwardedIp = forwardedFor.split(',').map(value => value.trim()).find(Boolean)

  return (
    forwardedIp
    || getHeaderValue(request.headers, 'x-real-ip').trim()
    || getHeaderValue(request.headers, 'cf-connecting-ip').trim()
    || 'unknown'
  )
}

function cleanupExpiredBuckets(now) {
  if (rateLimitBuckets.size < 1000) return

  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetTime <= now) {
      rateLimitBuckets.delete(key)
    }
  }
}

export function checkRateLimit(key, { limit, windowMs }) {
  const now = Date.now()
  cleanupExpiredBuckets(now)

  const existing = rateLimitBuckets.get(key)

  if (!existing || existing.resetTime <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetTime: now + windowMs,
    })

    return { allowed: true, remaining: Math.max(limit - 1, 0), resetTime: now + windowMs }
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: existing.resetTime }
  }

  existing.count += 1
  return { allowed: true, remaining: Math.max(limit - existing.count, 0), resetTime: existing.resetTime }
}

export function rateLimitResponse() {
  return Response.json({ error: TOO_MANY_ATTEMPTS_ERROR }, { status: 429 })
}

export function enforceRateLimit(request, { scope, limit, windowMs, identifier }) {
  const keyIdentifier = identifier || getClientIp(request)
  const key = `${scope}:${keyIdentifier}`
  const result = checkRateLimit(key, { limit, windowMs })

  return result.allowed ? null : rateLimitResponse()
}

export function resetRateLimitsForTest() {
  if (process.env.NODE_ENV === 'test') {
    rateLimitBuckets.clear()
  }
}
