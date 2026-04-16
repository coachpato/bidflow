import OpportunitiesClient from './OpportunitiesClient'

const VALID_FILTERS = new Set([
  'All',
  'New',
  'Watch',
  'Pursue',
  'Ignore',
  'Converted',
])

function getSingleValue(value) {
  if (Array.isArray(value)) return value[0] || ''
  return typeof value === 'string' ? value : ''
}

export default async function OpportunitiesPage({ searchParams }) {
  const params = await searchParams
  const initialSearch = getSingleValue(params?.search)
  const rawStatus = getSingleValue(params?.status)
  const initialStatus = VALID_FILTERS.has(rawStatus) ? rawStatus : 'All'

  return (
    <OpportunitiesClient
      key={`${initialStatus}:${initialSearch}`}
      initialSearch={initialSearch}
      initialStatus={initialStatus}
    />
  )
}
