function normalizeBaseUrl(url) {
  return url ? url.replace(/\/+$/, '') : null
}

export const APP_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  'http://localhost:3000'
)

export function buildAppUrl(path = '') {
  const normalizedPath = String(path || '')
  if (!normalizedPath) return APP_URL
  return `${APP_URL}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`
}
