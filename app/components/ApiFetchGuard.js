'use client'

const UNSAFE_METHODS = new Set(['POST', 'PATCH', 'DELETE'])
const PATCH_MARKER = '__bid360ApiFetchGuardInstalled'

function getRequestUrl(input) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url
  return ''
}

function getRequestMethod(input, init) {
  if (init?.method) return init.method.toUpperCase()
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase()
  }
  return 'GET'
}

function isApiRequest(input) {
  const url = getRequestUrl(input)
  if (!url) return false
  if (url.startsWith('/api/')) return true

  try {
    const parsed = new URL(url, window.location.origin)
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

function installApiFetchGuard() {
  if (typeof window === 'undefined' || window[PATCH_MARKER]) return

  const originalFetch = window.fetch.bind(window)

  window.fetch = (input, init) => {
    const method = getRequestMethod(input, init)

    if (!UNSAFE_METHODS.has(method) || !isApiRequest(input)) {
      return originalFetch(input, init)
    }

    const requestHeaders = typeof Request !== 'undefined' && input instanceof Request
      ? input.headers
      : undefined
    const headers = new Headers(init?.headers || requestHeaders)
    headers.set('X-Requested-With', 'XMLHttpRequest')

    return originalFetch(input, {
      ...(init || {}),
      headers,
    })
  }

  window[PATCH_MARKER] = true
}

installApiFetchGuard()

export default function ApiFetchGuard({ children }) {
  return children
}
