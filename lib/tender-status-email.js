import prisma from './prisma'
import { getAppUrl, isEmailConfigured, sendEmail } from './email'
import { getTenderStatusDescription, isHighValueTenderStatus } from './status-machine'
import { resolveAssignedRecipients } from './tender-assignment'

const DEMO_STATUS_ALERT_BCC = 'buntu.pato@gmail.com'

function escapeHtml(value) {
  return String(value)
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

async function getFallbackRecipient({ organizationId, actorEmail }) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      firmProfile: {
        select: {
          primaryContactName: true,
          primaryContactEmail: true,
        },
      },
    },
  })

  const primaryContactEmail = organization?.firmProfile?.primaryContactEmail?.trim().toLowerCase()
  if (primaryContactEmail) {
    return {
      name: organization.firmProfile.primaryContactName || organization.name || primaryContactEmail,
      email: primaryContactEmail,
    }
  }

  const normalizedActorEmail = actorEmail?.trim().toLowerCase()
  if (normalizedActorEmail) {
    return {
      name: 'Bid360 team',
      email: normalizedActorEmail,
    }
  }

  return null
}

async function resolveTenderStatusRecipients({ tender, organizationId, actorEmail }) {
  const recipients = await resolveAssignedRecipients({
    assignedUserId: tender.assignedUserId,
    assignedTo: tender.assignedTo,
  })

  const uniqueRecipients = new Map()

  for (const recipient of recipients) {
    const normalizedEmail = recipient.email?.trim().toLowerCase()
    if (!normalizedEmail) continue

    uniqueRecipients.set(normalizedEmail, {
      name: recipient.name || normalizedEmail,
      email: normalizedEmail,
    })
  }

  if (uniqueRecipients.size === 0) {
    const fallbackRecipient = await getFallbackRecipient({ organizationId, actorEmail })
    if (fallbackRecipient) {
      uniqueRecipients.set(fallbackRecipient.email, fallbackRecipient)
    }
  }

  return Array.from(uniqueRecipients.values())
}

export async function notifyHighValueTenderStatusChange({
  tender,
  fromStatus,
  toStatus,
  changedBy,
  reason,
  organizationId,
}) {
  if (!isHighValueTenderStatus(toStatus)) {
    return { skipped: true, reason: 'status_not_high_value' }
  }

  if (!isEmailConfigured()) {
    return { skipped: true, reason: 'email_not_configured' }
  }

  const recipients = await resolveTenderStatusRecipients({
    tender,
    organizationId,
    actorEmail: changedBy?.email || null,
  })

  if (recipients.length === 0) {
    return { skipped: true, reason: 'no_recipients' }
  }

  const appUrl = getAppUrl()
  const tenderUrl = appUrl ? `${appUrl}/pursuits/${tender.id}` : null
  const actorLabel = changedBy?.name || changedBy?.email || 'A Bid360 teammate'
  const reasonLabel = reason?.trim() || 'No reason provided.'
  const statusSummary = getTenderStatusDescription(toStatus)
  const recipientEmails = recipients.map(recipient => recipient.email)

  // Business event: a high-value pursuit status changed after the database update succeeded.
  await sendEmail({
    to: recipientEmails,
    bcc: DEMO_STATUS_ALERT_BCC,
    subject: `Bid360 status update: ${tender.title} is now ${toStatus}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <p>Hello team,</p>
        <p>A high-value tender status update just happened in Bid360.</p>
        <p><strong>Pursuit:</strong> ${escapeHtml(tender.title)}</p>
        <p><strong>Entity:</strong> ${escapeHtml(tender.entity)}</p>
        <p><strong>Status change:</strong> ${escapeHtml(fromStatus)} → ${escapeHtml(toStatus)}</p>
        <p><strong>Summary:</strong> ${escapeHtml(statusSummary)}</p>
        <p><strong>Changed by:</strong> ${escapeHtml(actorLabel)}</p>
        <p><strong>Reason:</strong> ${escapeHtml(reasonLabel)}</p>
        <p><strong>Deadline:</strong> ${escapeHtml(formatDateTime(tender.deadline))}</p>
        ${tender.reference ? `<p><strong>Reference:</strong> ${escapeHtml(tender.reference)}</p>` : ''}
        ${tenderUrl ? `<p><a href="${tenderUrl}">Open this pursuit in Bid360</a></p>` : ''}
      </div>
    `,
    text: [
      'Hello team,',
      '',
      'A high-value tender status update just happened in Bid360.',
      `Pursuit: ${tender.title}`,
      `Entity: ${tender.entity}`,
      `Status change: ${fromStatus} -> ${toStatus}`,
      `Summary: ${statusSummary}`,
      `Changed by: ${actorLabel}`,
      `Reason: ${reasonLabel}`,
      `Deadline: ${formatDateTime(tender.deadline)}`,
      tender.reference ? `Reference: ${tender.reference}` : null,
      tenderUrl ? `Open pursuit: ${tenderUrl}` : null,
    ].filter(Boolean).join('\n'),
  })

  return {
    sent: true,
    recipients: recipientEmails,
    bcc: DEMO_STATUS_ALERT_BCC,
  }
}
