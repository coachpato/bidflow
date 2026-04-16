import TendersClient from './TendersClient'

const VALID_FILTERS = new Set([
  'All',
  'active',
  'New',
  'Under Review',
  'In Progress',
  'Submitted',
  'Awarded',
  'Lost',
  'Cancelled',
])

function getSingleValue(value) {
  if (Array.isArray(value)) return value[0] || ''
  return typeof value === 'string' ? value : ''
}

export default async function TendersPage({ searchParams }) {
  const params = await searchParams
  const initialSearch = getSingleValue(params?.search)
  const rawStatus = getSingleValue(params?.status)
  const initialStatus = VALID_FILTERS.has(rawStatus) ? rawStatus : 'All'

  return (
    <TendersClient
      key={`${initialStatus}:${initialSearch}`}
      initialSearch={initialSearch}
      initialStatus={initialStatus}
    />
  )
}
