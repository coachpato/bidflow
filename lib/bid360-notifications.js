import prisma from './prisma'
import { getAppUrl, sendEmail } from './email'
import { resolveAssignedRecipients } from './tender-assignment'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDateTime(value) {
  if (!value) return 'Not set'

  return new Date(value).toLocaleString('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function dedupeRecipients(recipients) {
  const seen = new Set()

  return recipients.filter(recipient => {
    const key = recipient.email.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function renderEmailShell({ eyebrow, title, intro, body, ctaHref, ctaLabel }) {
  const cta = ctaHref
    ? `
      <a href="${ctaHref}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;">
        ${escapeHtml(ctaLabel || 'Open in Bid360')}
      </a>
    `
    : ''

  return `
    <div style="margin:0;background:#f4efe6;padding:32px 0;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e6dfd0;border-radius:24px;overflow:hidden;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#0f766e 0%,#155e75 100%);color:#ffffff;">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;opacity:0.9;">${escapeHtml(eyebrow)}</div>
          <h1 style="margin:14px 0 0;font-size:28px;line-height:1.2;">${escapeHtml(title)}</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">${intro}</p>
          ${body}
          ${cta ? `<div style="margin-top:24px;">${cta}</div>` : ''}
          <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#64748b;">Bid360 keeps this alert in your inbox archive so the team can revisit it later.</p>
        </div>
      </div>
    </div>
  `
}

async function getOrganizationNotificationContext(organizationId) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      firmProfile: true,
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      },
    },
  })
}

async function createInboxArchive({
  organizationId,
  sourceKey,
  title,
  message,
  type,
  linkUrl,
  linkLabel,
  userIds = [],
}) {
  if (sourceKey) {
    const existing = await prisma.notification.findUnique({
      where: { sourceKey },
    })

    if (existing) {
      return prisma.notification.update({
        where: { id: existing.id },
        data: {
          title,
          message,
          type,
          linkUrl,
          linkLabel,
          read: false,
        },
      })
    }
  }

  if (userIds.length > 0) {
    await prisma.notification.createMany({
      data: userIds.map(userId => ({
        title,
        message,
        type,
        linkUrl,
        linkLabel,
        organizationId,
        userId,
        sourceKey: userIds.length === 1 && sourceKey ? sourceKey : null,
      })),
    })
    return null
  }

  return prisma.notification.create({
    data: {
      title,
      message,
      type,
      linkUrl,
      linkLabel,
      organizationId,
      sourceKey: sourceKey || null,
    },
  })
}

export async function sendOpportunityAlert({ organizationId, opportunities, sourceKey }) {
  const opportunityList = Array.isArray(opportunities) ? opportunities.filter(Boolean) : [opportunities].filter(Boolean)
  if (opportunityList.length === 0) return { sent: 0 }

  const organization = await getOrganizationNotificationContext(organizationId)
  if (!organization) return { sent: 0 }

  const primaryRecipients = [
    organization.firmProfile?.primaryContactEmail,
    ...organization.memberships
      .filter(membership => ['owner', 'admin'].includes(membership.role) || membership.user.role === 'admin')
      .map(membership => membership.user.email),
  ]
    .filter(Boolean)
    .map(email => ({ email, name: email.split('@')[0], id: null }))

  const recipients = dedupeRecipients(primaryRecipients)
  if (recipients.length === 0) return { sent: 0 }

  const appUrl = getAppUrl()
  const linkUrl = appUrl ? `${appUrl}/opportunities` : '/opportunities'
  const message = opportunityList.length === 1
    ? `Bid360 found an opportunity you may be interested in: ${opportunityList[0].title}.`
    : `Bid360 found ${opportunityList.length} opportunities you may be interested in.`

  const body = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">${escapeHtml(organization.name)} has new opportunity radar activity.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px;text-align:left;border-bottom:1px solid #e2e8f0;">Opportunity</th>
          <th style="padding:10px;text-align:left;border-bottom:1px solid #e2e8f0;">Entity</th>
          <th style="padding:10px;text-align:left;border-bottom:1px solid #e2e8f0;">Deadline</th>
        </tr>
      </thead>
      <tbody>
        ${opportunityList.map(opportunity => `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;"><strong>${escapeHtml(opportunity.title)}</strong></td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(opportunity.entity || 'Not set')}</td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(formatDateTime(opportunity.deadline))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `

  // Business event: opportunity radar found one or more matching opportunities after source records were saved.
  const emailResults = await Promise.allSettled(
    recipients.map(recipient => sendEmail({
      to: recipient.email,
      subject: opportunityList.length === 1
        ? 'Bid360 found an opportunity you may be interested in.'
        : 'Bid360 found opportunities you may be interested in.',
      html: renderEmailShell({
        eyebrow: 'Opportunity Alert',
        title: 'Bid360 found an opportunity you may be interested in.',
        intro: `Hello ${escapeHtml(recipient.name || recipient.email)},`,
        body,
        ctaHref: linkUrl,
        ctaLabel: 'Open opportunity radar',
      }),
      text: [
        `Hello ${recipient.name || recipient.email},`,
        '',
        message,
        ...opportunityList.map(opportunity => `- ${opportunity.title} | ${opportunity.entity || 'Unknown entity'} | ${formatDateTime(opportunity.deadline)}`),
        '',
        appUrl ? `Open radar: ${linkUrl}` : null,
      ].filter(Boolean).join('\n'),
    }))
  )

  const sentCount = emailResults.filter(result => result.status === 'fulfilled' && !result.value?.skipped).length

  for (const result of emailResults) {
    if (result.status === 'rejected') {
      console.error('Opportunity alert email failed:', result.reason)
    }
  }

  await createInboxArchive({
    organizationId,
    sourceKey,
    title: 'Opportunity alert',
    message,
    type: 'opportunity',
    linkUrl: '/opportunities',
    linkLabel: 'Open radar',
  })

  return { sent: sentCount }
}

export async function sendPursuitDeadlineAlert({ organizationId, pursuit }) {
  const organization = await getOrganizationNotificationContext(organizationId)
  if (!organization || !pursuit) return { sent: 0 }

  const assigneeRecipients = await resolveAssignedRecipients({
    assignedUserId: pursuit.assignedUserId,
    assignedTo: pursuit.assignedTo,
  })

  const fallbackRecipients = organization.firmProfile?.primaryContactEmail
    ? [{ email: organization.firmProfile.primaryContactEmail, name: organization.firmProfile.primaryContactName || 'Team', id: null }]
    : []

  const recipients = dedupeRecipients(
    assigneeRecipients.length > 0 ? assigneeRecipients : fallbackRecipients
  )

  if (recipients.length === 0) return { sent: 0 }

  const appUrl = getAppUrl()
  const linkUrl = appUrl ? `${appUrl}/pursuits/${pursuit.id}` : `/pursuits/${pursuit.id}`
  const message = `Submission deadline is approaching for ${pursuit.title}.`
  const body = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.7;"><strong>Pursuit:</strong> ${escapeHtml(pursuit.title)}</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.7;"><strong>Entity:</strong> ${escapeHtml(pursuit.entity || 'Not set')}</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.7;"><strong>Submission deadline:</strong> ${escapeHtml(formatDateTime(pursuit.deadline))}</p>
    <p style="margin:0;font-size:15px;line-height:1.7;">Review the pursuit, confirm the submission pack, and keep the owner aligned before the deadline closes.</p>
  `

  // Business event: a pursuit deadline entered the reminder window after the reminder scan succeeded.
  const emailResults = await Promise.allSettled(
    recipients.map(recipient => sendEmail({
      to: recipient.email,
      subject: `Submission deadline approaching: ${pursuit.title}`,
      html: renderEmailShell({
        eyebrow: 'Deadline Alert',
        title: 'Submission deadline approaching',
        intro: `Hello ${escapeHtml(recipient.name || recipient.email)},`,
        body,
        ctaHref: linkUrl,
        ctaLabel: 'Open pursuit',
      }),
      text: [
        `Hello ${recipient.name || recipient.email},`,
        '',
        message,
        `Pursuit: ${pursuit.title}`,
        `Entity: ${pursuit.entity || 'Not set'}`,
        `Submission deadline: ${formatDateTime(pursuit.deadline)}`,
        appUrl ? `Open pursuit: ${linkUrl}` : null,
      ].filter(Boolean).join('\n'),
    }))
  )

  const sentCount = emailResults.filter(result => result.status === 'fulfilled' && !result.value?.skipped).length

  for (const result of emailResults) {
    if (result.status === 'rejected') {
      console.error('Pursuit deadline email failed:', result.reason)
    }
  }

  await createInboxArchive({
    organizationId,
    sourceKey: `pursuit-deadline:${pursuit.id}:${new Date(pursuit.deadline).toISOString()}`,
    title: 'Deadline alert',
    message,
    type: 'warning',
    linkUrl: `/pursuits/${pursuit.id}`,
    linkLabel: 'Open pursuit',
    userIds: recipients.filter(recipient => recipient.id).map(recipient => recipient.id),
  })

  return { sent: sentCount }
}
