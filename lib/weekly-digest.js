import { getAppUrl, sendEmail } from './email'
import prisma from './prisma'
import { getServiceSectorLabels } from './service-sectors'

const DIGEST_LOOKBACK_DAYS = 7
const DEADLINE_WINDOW_DAYS = 7
const ACTIVE_OPPORTUNITY_STATUSES = ['New', 'Watch', 'Pursue']

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function startOfDay(value = new Date()) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(value, days) {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date
}

function formatDate(value) {
  if (!value) return 'No deadline'
  return new Date(value).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatFitScore(value) {
  if (value === null || value === undefined) return 'Not scored'
  return `${value}/100`
}

function getRecipients(organization) {
  const seen = new Set()

  return organization.memberships
    .map(membership => membership.user)
    .filter(user => user?.email && user.emailVerified)
    .filter(user => {
      const key = user.email.trim().toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function getOpportunityUrl(opportunity) {
  const appUrl = getAppUrl()
  if (!appUrl) return `/opportunities/${opportunity.id}`
  return `${appUrl}/opportunities/${opportunity.id}`
}

function renderOpportunityText(opportunity) {
  return [
    `- ${opportunity.title}`,
    `  Entity: ${opportunity.entity || 'Not set'}`,
    `  Deadline: ${formatDate(opportunity.deadline)}`,
    `  Fit: ${formatFitScore(opportunity.fitScore)}`,
    `  Link: ${getOpportunityUrl(opportunity)}`,
  ].join('\n')
}

function renderOpportunityList(title, opportunities) {
  if (opportunities.length === 0) {
    return `
      <h2 style="margin:28px 0 10px;font-size:18px;line-height:1.3;color:#18314a;">${escapeHtml(title)}</h2>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#475569;">No items for this section.</p>
    `
  }

  const items = opportunities.map(opportunity => `
    <li style="margin:0 0 16px;padding:0 0 16px;border-bottom:1px solid #e2e8f0;">
      <p style="margin:0 0 6px;font-size:15px;line-height:1.5;font-weight:700;color:#0f172a;">${escapeHtml(opportunity.title)}</p>
      <p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:#475569;">Entity: ${escapeHtml(opportunity.entity || 'Not set')}</p>
      <p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:#475569;">Deadline: ${escapeHtml(formatDate(opportunity.deadline))}</p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#475569;">Fit: ${escapeHtml(formatFitScore(opportunity.fitScore))}</p>
      <a href="${escapeHtml(getOpportunityUrl(opportunity))}" style="font-size:13px;font-weight:700;color:#18314a;">Open opportunity</a>
    </li>
  `).join('')

  return `
    <h2 style="margin:28px 0 10px;font-size:18px;line-height:1.3;color:#18314a;">${escapeHtml(title)}</h2>
    <ul style="margin:0;padding:0;list-style:none;">${items}</ul>
  `
}

async function getDigestOpportunities({ organizationId, since, today, deadlineWindowEnd }) {
  return prisma.$transaction([
    prisma.opportunity.findMany({
      where: {
        organizationId,
        status: { in: ACTIVE_OPPORTUNITY_STATUSES },
        createdAt: { gte: since },
      },
      orderBy: [{ createdAt: 'desc' }, { deadline: 'asc' }],
      select: {
        id: true,
        title: true,
        entity: true,
        deadline: true,
        fitScore: true,
        createdAt: true,
      },
    }),
    prisma.opportunity.findMany({
      where: {
        organizationId,
        status: { in: ACTIVE_OPPORTUNITY_STATUSES },
        createdAt: { lt: since },
        deadline: {
          gte: today,
          lte: deadlineWindowEnd,
        },
      },
      orderBy: [{ deadline: 'asc' }, { fitScore: 'desc' }],
      select: {
        id: true,
        title: true,
        entity: true,
        deadline: true,
        fitScore: true,
        createdAt: true,
      },
    }),
  ])
}

async function sendOrganizationDigest({ organization, now, since, today, deadlineWindowEnd }) {
  const recipients = getRecipients(organization)
  if (recipients.length === 0) {
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      recipients: 0,
      emailsSent: 0,
      skipped: true,
      reason: 'No verified workspace users.',
    }
  }

  const [newOpportunities, upcomingDeadlines] = await getDigestOpportunities({
    organizationId: organization.id,
    since,
    today,
    deadlineWindowEnd,
  })

  if (newOpportunities.length === 0 && upcomingDeadlines.length === 0) {
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      recipients: recipients.length,
      emailsSent: 0,
      skipped: true,
      reason: 'No digest items.',
    }
  }

  const sectorLabel = getServiceSectorLabels(organization.firmProfile?.serviceSectors).join(', ') ||
    'your selected sectors'
  const appUrl = getAppUrl()
  const subject = `Bid360 weekly digest: ${newOpportunities.length + upcomingDeadlines.length} update(s)`
  const periodLabel = `${formatDate(since)} to ${formatDate(now)}`
  const openRadarLink = appUrl ? `${appUrl}/opportunities` : null

  const text = [
    'Bid360 weekly digest',
    '',
    `${organization.name}`,
    `Sector focus: ${sectorLabel}`,
    `Period: ${periodLabel}`,
    '',
    'New matched opportunities this week',
    newOpportunities.length > 0
      ? newOpportunities.map(renderOpportunityText).join('\n\n')
      : 'No new matched opportunities this week.',
    '',
    'Existing opportunities with deadlines approaching this week',
    upcomingDeadlines.length > 0
      ? upcomingDeadlines.map(renderOpportunityText).join('\n\n')
      : 'No existing opportunity deadlines are approaching this week.',
    '',
    openRadarLink ? `Open Bid360: ${openRadarLink}` : null,
    'Reply to this email if you want us to pause weekly digests for your pilot workspace.',
  ].filter(Boolean).join('\n')

  const html = `
    <div style="margin:0;background:#f7f5ef;padding:32px 0;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e6dfd0;border-radius:24px;overflow:hidden;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="padding:28px 32px;background:#18314a;color:#ffffff;">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;opacity:0.85;">Weekly digest</div>
          <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;">Bid360 opportunity update</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 8px;font-size:15px;line-height:1.7;">${escapeHtml(organization.name)}</p>
          <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#475569;">Sector focus: ${escapeHtml(sectorLabel)}</p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#475569;">Period: ${escapeHtml(periodLabel)}</p>
          ${renderOpportunityList('New matched opportunities this week', newOpportunities)}
          ${renderOpportunityList('Existing opportunities with deadlines approaching this week', upcomingDeadlines)}
          ${openRadarLink ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(openRadarLink)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#18314a;color:#ffffff;text-decoration:none;font-weight:700;">Open opportunity radar</a></p>` : ''}
          <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#64748b;">Reply to this email if you want us to pause weekly digests for your pilot workspace.</p>
        </div>
      </div>
    </div>
  `

  const emailResults = await Promise.allSettled(
    recipients.map(recipient => sendEmail({
      to: recipient.email,
      subject,
      html,
      text,
    }))
  )

  let emailsSent = 0
  let emailsSkipped = 0
  let emailErrors = 0

  for (const result of emailResults) {
    if (result.status === 'fulfilled') {
      if (result.value?.skipped) {
        emailsSkipped += 1
      } else {
        emailsSent += 1
      }
      continue
    }

    emailErrors += 1
    console.error('Weekly digest email failed:', result.reason)
  }

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    recipients: recipients.length,
    newOpportunities: newOpportunities.length,
    upcomingDeadlines: upcomingDeadlines.length,
    emailsSent,
    emailsSkipped,
    emailErrors,
    skipped: false,
  }
}

export function isWeeklyDigestDue(value = new Date()) {
  return new Date(value).getUTCDay() === 1
}

export async function sendWeeklyOpportunityDigest({ now = new Date() } = {}) {
  const since = addDays(now, -DIGEST_LOOKBACK_DAYS)
  const today = startOfDay(now)
  const deadlineWindowEnd = addDays(today, DEADLINE_WINDOW_DAYS)

  const organizations = await prisma.organization.findMany({
    include: {
      firmProfile: true,
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              emailVerified: true,
            },
          },
        },
      },
    },
    orderBy: { id: 'asc' },
  })

  const organizationResults = []

  for (const organization of organizations) {
    organizationResults.push(await sendOrganizationDigest({
      organization,
      now,
      since,
      today,
      deadlineWindowEnd,
    }))
  }

  const totals = organizationResults.reduce((summary, result) => ({
    organizationsEmailed: summary.organizationsEmailed + (result.emailsSent > 0 ? 1 : 0),
    emailsSent: summary.emailsSent + (result.emailsSent || 0),
    emailsSkipped: summary.emailsSkipped + (result.emailsSkipped || 0),
    emailErrors: summary.emailErrors + (result.emailErrors || 0),
    newOpportunities: summary.newOpportunities + (result.newOpportunities || 0),
    upcomingDeadlines: summary.upcomingDeadlines + (result.upcomingDeadlines || 0),
  }), {
    organizationsEmailed: 0,
    emailsSent: 0,
    emailsSkipped: 0,
    emailErrors: 0,
    newOpportunities: 0,
    upcomingDeadlines: 0,
  })

  console.log('Weekly digest scan complete.', {
    organizationsScanned: organizations.length,
    ...totals,
  })

  return {
    organizationsScanned: organizations.length,
    ...totals,
    organizationResults,
  }
}
