function getOrganizationPayload(organizationContext) {
  if (!organizationContext?.organization || !organizationContext?.membership) return null

  return {
    id: organizationContext.organization.id,
    name: organizationContext.organization.name,
    role: organizationContext.membership.role,
  }
}

export function buildAuthUserPayload(user, organizationContext) {
  const organization = getOrganizationPayload(organizationContext)

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: organizationContext?.user?.role || user.role,
    avatarUrl: user.avatarUrl || null,
    organization,
    organizationId: organization?.id || null,
    organizationName: organization?.name || null,
    organizationRole: organization?.role || null,
    serviceSector: organizationContext?.firmProfile?.serviceSector || null,
  }
}
