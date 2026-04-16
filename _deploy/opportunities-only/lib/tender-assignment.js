import prisma from './prisma'
import { getAppUrl, sendEmail } from './email'

function tokenizeAssignments(assignedTo) {
  if (!assignedTo) return []

  return assignedTo
    .split(/[,\n;]+/)
    .map(token => token.trim().toLowerCase())
    .filter(Boolean)
}

function userMatchesAssignment(user, token) {
  const normalizedName = user.name.trim().toLowerCase()
  const normalizedEmail = user.email.trim().toLowerCase()
  const nameParts = normalizedName.split(/\s+/)

  if (token.includes('@')) {
    return normalizedEmail === token
  }

  return (
    normalizedName === token ||
    normalizedName.includes(token) ||
    nameParts.includes(token)
  )
}

function recipientKey(recipient) {
  return recipient.id ? `user:${recipient.id}` : `email:${recipient.email.toLowerCase()}`
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatAssigneeLabel(record) {
  return record?.assignedUser?.name || record?.assignedTo || 'Unassigned'
}

export async function findAssignedUser(assignedUserId) {
  if (!assignedUserId) return null

  return prisma.user.findUnique({
    where: { id: assignedUserId },
    select: { id: true, name: true, email: true },
  })
}

export async function resolveAssignedRecipients({ assignedUserId, assignedTo }) {
  if (assignedUserId) {
    const user = await findAssignedUser(assignedUserId)
    return user ? [user] : []
  }

  const tokens = tokenizeAssignments(assignedTo)
  if (!tokens.length) return []

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
  })

  const recipients = new Map()

  for (const token of tokens) {
    const matchingUsers = users.filter(user => userMatchesAssignment(user, token))

    if (matchingUsers.length > 0) {
      for (const user of matchingUsers) {
        recipients.set(recipientKey(user), user)
      }
      continue
    }

    if (token.includes('@')) {
      recipients.set(`email:${token}`, {
        id: null,
        name: token.split('@')[0],
        email: token,
      })
    }
  }

  return Array.from(recipients.values())
}

export async function notifyTenderAssignees({
  tender,
  assignedUserId,
  assignedTo,
  previousAssignedUserId = null,
  previousAssignedTo = null,
  actorName = 'A teammate',
}) {
  const nextRecipients = await resolveAssignedRecipients({ assignedUserId, assignedTo })
  if (!nextRecipients.length) return { notifiedUsers: 0, emailedRecipients: 0 }

  const previousRecipients = previousAssignedUserId || previousAssignedTo
    ? await resolveAssignedRecipients({ assignedUserId: previousAssignedUserId, assignedTo: previousAssignedTo })
    : []
  const previousKeys = new Set(previousRecipients.map(recipientKey))
  const newRecipients = nextRecipients.filter(recipient => !previousKeys.has(recipientKey(recipient)))

  if (!newRecipients.length) return { notifiedUsers: 0, emailedRecipients: 0 }

  const message = `${actorName} assigned you to tender "${tender.title}".`
  const linkedUsers = newRecipients.filter(recipient => recipient.id)

  if (linkedUsers.length > 0) {
    await prisma.notification.createMany({
      data: linkedUsers.map(user => ({
        message,
        type: 'info',
        userId: user.id,
      })),
    })
  }

  const appUrl = getAppUrl()
  const tenderUrl = appUrl ? `${appUrl}/tenders/${tender.id}` : null

  const emailResults = await Promise.allSettled(
    newRecipients.map(async recipient => {
      const subject = `Tender assigned: ${tender.title}`
      const intro = `${escapeHtml(actorName)} assigned you to a tender in BidFlow.`
      const deadline = tender.deadline
        ? new Date(tender.deadline).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
        : 'Not set'
      const details = [
        `<p><strong>Tender:</strong> ${escapeHtml(tender.title)}</p>`,
        `<p><strong>Entity:</strong> ${escapeHtml(tender.entity)}</p>`,
        `<p><strong>Deadline:</strong> ${escapeHtml(deadline)}</p>`,
      ].join('')
      const link = tenderUrl
        ? `<p><a href="${tenderUrl}">Open this tender in BidFlow</a></p>`
        : ''

      return sendEmail({
        to: recipient.email,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
            <p>Hello ${escapeHtml(recipient.name || recipient.email)},</p>
            <p>${intro}</p>
            ${details}
            ${link}
          </div>
        `,
        text: [
          `Hello ${recipient.name || recipient.email},`,
          '',
          `${actorName} assigned you to a tender in BidFlow.`,
          `Tender: ${tender.title}`,
          `Entity: ${tender.entity}`,
          `Deadline: ${deadline}`,
          tenderUrl ? `Open tender: ${tenderUrl}` : null,
        ].filter(Boolean).join('\n'),
      })
    })
  )

  let emailedRecipients = 0

  for (const result of emailResults) {
    if (result.status === 'fulfilled') {
      if (!result.value?.skipped) emailedRecipients += 1
      continue
    }

    console.error('Tender assignment email failed:', result.reason)
  }

  return {
    notifiedUsers: linkedUsers.length,
    emailedRecipients,
  }
}
