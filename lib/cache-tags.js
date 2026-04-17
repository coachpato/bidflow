import { revalidateTag } from 'next/cache'

export function dashboardCacheTag(organizationId) {
  return `organization:${organizationId}:dashboard`
}

export function organizationCacheTag(organizationId) {
  return `organization:${organizationId}:profile`
}

export function pilotLeadsCacheTag() {
  return 'pilot-leads'
}

export function tendersListCacheTag(organizationId) {
  return `organization:${organizationId}:tenders`
}

export function tenderDetailCacheTag(organizationId, tenderId) {
  return `organization:${organizationId}:tender:${tenderId}`
}

export function tenderPackCacheTag(organizationId, tenderId) {
  return `organization:${organizationId}:tender-pack:${tenderId}`
}

export async function expireCacheTags(...tags) {
  const uniqueTags = Array.from(
    new Set(
      tags
        .flat()
        .filter(Boolean)
        .map(tag => String(tag))
    )
  )

  for (const tag of uniqueTags) {
    revalidateTag(tag, { expire: 0 })
  }
}
