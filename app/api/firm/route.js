import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { dashboardCacheTag, expireCacheTags, organizationCacheTag } from '@/lib/cache-tags'
import { getAppUrl, sendEmail } from '@/lib/email'
import { getSessionOrganizationId } from '@/lib/organization'
import { normalizeServiceSector } from '@/lib/service-sectors'

function normalizeString(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map(item => normalizeString(item)).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(/[\n,]/)
      .map(item => item.trim())
      .filter(Boolean)
  }

  return []
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeServiceSectorList(value) {
  return Array.from(
    new Set(
      normalizeList(value)
        .map(item => normalizeServiceSector(item))
        .filter(Boolean)
    )
  )
}

function listsMatch(left, right) {
  const normalizedLeft = Array.isArray(left) ? left : []
  const normalizedRight = Array.isArray(right) ? right : []

  if (normalizedLeft.length !== normalizedRight.length) return false

  return normalizedLeft.every((item, index) => item === normalizedRight[index])
}

function formatSettingValue(value) {
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'Not set'
  if (value === null || value === undefined || value === '') return 'Not set'
  return String(value)
}

function valuesMatch(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return listsMatch(left, right)
  }

  return formatSettingValue(left) === formatSettingValue(right)
}

function addChange(changes, label, before, after) {
  if (valuesMatch(before, after)) return

  changes.push({
    label,
    before: formatSettingValue(before),
    after: formatSettingValue(after),
  })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function sendSettingsChangedEmail({ user, organizationName, changes }) {
  if (!user?.email || changes.length === 0) return

  const appUrl = getAppUrl()
  const rows = changes.map(change => `
    <li style="margin:0 0 12px;">
      <strong>${escapeHtml(change.label)}:</strong>
      ${escapeHtml(change.before)} to ${escapeHtml(change.after)}
    </li>
  `).join('')

  const html = `
    <div style="margin:0;background:#f7f5ef;padding:32px 0;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e6dfd0;border-radius:24px;overflow:hidden;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="padding:28px 32px;background:#18314a;color:#ffffff;">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;opacity:0.85;">Settings</div>
          <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;">Workspace settings changed</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hello ${escapeHtml(user.name || user.email)},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">The settings for ${escapeHtml(organizationName)} were updated in Bid360.</p>
          <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.7;color:#334155;">${rows}</ul>
          ${appUrl ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(`${appUrl}/manage`)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#18314a;color:#ffffff;text-decoration:none;font-weight:700;">Manage subscription</a></p>` : ''}
          <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#64748b;">If you did not make this change, reply to this email so we can help secure the workspace.</p>
        </div>
      </div>
    </div>
  `

  const text = [
    'Workspace settings changed',
    '',
    `Hello ${user.name || user.email},`,
    '',
    `The settings for ${organizationName} were updated in Bid360.`,
    '',
    ...changes.map(change => `- ${change.label}: ${change.before} to ${change.after}`),
    '',
    appUrl ? `Manage subscription: ${appUrl}/manage` : null,
    'If you did not make this change, reply to this email so we can help secure the workspace.',
  ].filter(Boolean).join('\n')

  await sendEmail({
    to: user.email,
    subject: `Bid360 settings changed: ${organizationName}`,
    html,
    text,
  })
}

export async function GET() {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organisation context is missing.' }, { status: 400 })

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      firmProfile: true,
    },
  })

  if (!organization) {
    return Response.json({ error: 'Organisation not found.' }, { status: 404 })
  }

  return Response.json({
    organization,
    membership: {
      organizationId,
      role: session.organizationRole || 'member',
    },
    firmProfile: organization.firmProfile,
  })
}

export async function PUT(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organisation context is missing.' }, { status: 400 })
  const payload = await request.json()

  const displayName = normalizeString(payload.displayName)
  const serviceSectors = normalizeServiceSectorList(payload.serviceSectors)
  const serviceSector = normalizeServiceSector(payload.serviceSector) || serviceSectors[0] || null
  const nextServiceSectors = serviceSectors.length > 0
    ? serviceSectors
    : (serviceSector ? [serviceSector] : [])
  const practiceAreas = normalizeList(payload.practiceAreas)
  const preferredEntities = normalizeList(payload.preferredEntities)
  const targetWorkTypes = normalizeList(payload.targetWorkTypes)
  const targetProvinces = normalizeList(payload.targetProvinces)

  if (!displayName) {
    return Response.json({ error: 'Firm display name is required.' }, { status: 400 })
  }

  const currentOrganization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      firmProfile: true,
    },
  })
  const currentProfile = currentOrganization?.firmProfile

  const radarSettingsChanged = Boolean(currentProfile) && (
    currentProfile.serviceSector !== serviceSector ||
    !listsMatch(currentProfile.serviceSectors, nextServiceSectors) ||
    !listsMatch(currentProfile.practiceAreas, practiceAreas) ||
    !listsMatch(currentProfile.preferredEntities, preferredEntities) ||
    !listsMatch(currentProfile.targetWorkTypes, targetWorkTypes) ||
    !listsMatch(currentProfile.targetProvinces, targetProvinces)
  )
  const changes = []

  addChange(changes, 'Firm display name', currentProfile?.displayName || currentOrganization?.name, displayName)
  addChange(changes, 'Sector focus', currentProfile?.serviceSectors || [], nextServiceSectors)
  addChange(changes, 'Primary sector', currentProfile?.serviceSector, serviceSector)
  addChange(changes, 'Legal entity name', currentProfile?.legalName, normalizeString(payload.legalName))
  addChange(changes, 'Registration number', currentProfile?.registrationNumber, normalizeString(payload.registrationNumber))
  addChange(changes, 'Primary contact name', currentProfile?.primaryContactName, normalizeString(payload.primaryContactName))
  addChange(changes, 'Primary contact email', currentProfile?.primaryContactEmail, normalizeString(payload.primaryContactEmail))
  addChange(changes, 'Primary contact phone', currentProfile?.primaryContactPhone, normalizeString(payload.primaryContactPhone))
  addChange(changes, 'Website', currentProfile?.website, normalizeString(payload.website))
  addChange(changes, 'Overview', currentProfile?.overview, normalizeString(payload.overview))
  addChange(changes, 'Practice areas', currentProfile?.practiceAreas || [], practiceAreas)
  addChange(changes, 'Preferred entities', currentProfile?.preferredEntities || [], preferredEntities)
  addChange(changes, 'Target work types', currentProfile?.targetWorkTypes || [], targetWorkTypes)
  addChange(changes, 'Target provinces', currentProfile?.targetProvinces || [], targetProvinces)
  addChange(changes, 'Minimum contract value', currentProfile?.minimumContractValue, normalizeNumber(payload.minimumContractValue))
  addChange(changes, 'Maximum contract value', currentProfile?.maximumContractValue, normalizeNumber(payload.maximumContractValue))

  const updated = await prisma.$transaction(async tx => {
    const organization = await tx.organization.update({
      where: { id: organizationId },
      data: { name: displayName },
    })

    const firmProfile = await tx.firmProfile.update({
      where: { organizationId },
      data: {
        displayName,
        serviceSector,
        serviceSectors: nextServiceSectors,
        legalName: normalizeString(payload.legalName),
        registrationNumber: normalizeString(payload.registrationNumber),
        primaryContactName: normalizeString(payload.primaryContactName),
        primaryContactEmail: normalizeString(payload.primaryContactEmail),
        primaryContactPhone: normalizeString(payload.primaryContactPhone),
        website: normalizeString(payload.website),
        overview: normalizeString(payload.overview),
        practiceAreas,
        preferredEntities,
        targetWorkTypes,
        targetProvinces,
        minimumContractValue: normalizeNumber(payload.minimumContractValue),
        maximumContractValue: normalizeNumber(payload.maximumContractValue),
      },
    })

    return { organization, firmProfile }
  })

  await expireCacheTags(
    dashboardCacheTag(organizationId),
    organizationCacheTag(organizationId)
  )

  if (changes.length > 0) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        name: true,
        email: true,
      },
    })

    try {
      await sendSettingsChangedEmail({
        user,
        organizationName: updated.organization.name,
        changes,
      })
    } catch (error) {
      console.error('Settings confirmation email failed:', error)
    }
  }

  return Response.json({
    ...updated,
    opportunityRefresh: radarSettingsChanged
      ? { disabled: true, reason: 'organization matching disabled for sector subscriptions' }
      : null,
  })
}
