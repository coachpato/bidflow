import prisma from './prisma'
import { getAppUrl, sendEmail } from './email'
import { resolveAssignedRecipients } from './tender-assignment'

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function recipientKey(recipient) {
  return recipient.id ? `user:${recipient.id}` : `email:${recipient.email.toLowerCase()}`
}

function formatContractDate(value) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-ZA', { dateStyle: 'medium' })
}

function getDaysRemainingLabel(value) {
  const diff = new Date(value).getTime() - Date.now()
  const daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (daysRemaining < 0) return `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} overdue`
  if (daysRemaining === 0) return 'today'
  return `in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`
}

export async function notifyContractAssignees({
  contract,
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

  const linkedUsers = newRecipients.filter(recipient => recipient.id)
  const message = `${actorName} allocated contract "${contract.title}" to you.`

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
  const contractUrl = appUrl ? `${appUrl}/contracts/${contract.id}` : null

  const emailResults = await Promise.allSettled(
    newRecipients.map(recipient => (
      sendEmail({
        to: recipient.email,
        subject: `Contract allocated: ${contract.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
            <p>Hello ${escapeHtml(recipient.name || recipient.email)},</p>
            <p>${escapeHtml(actorName)} allocated a contract to you in BidFlow.</p>
            <p><strong>Contract:</strong> ${escapeHtml(contract.title)}</p>
            <p><strong>Client:</strong> ${escapeHtml(contract.client || 'Not set')}</p>
            <p><strong>End date:</strong> ${escapeHtml(formatContractDate(contract.endDate))}</p>
            <p><strong>Renewal date:</strong> ${escapeHtml(formatContractDate(contract.renewalDate))}</p>
            ${contractUrl ? `<p><a href="${contractUrl}">Open this contract in BidFlow</a></p>` : ''}
          </div>
        `,
        text: [
          `Hello ${recipient.name || recipient.email},`,
          '',
          `${actorName} allocated a contract to you in BidFlow.`,
          `Contract: ${contract.title}`,
          `Client: ${contract.client || 'Not set'}`,
          `End date: ${formatContractDate(contract.endDate)}`,
          `Renewal date: ${formatContractDate(contract.renewalDate)}`,
          contractUrl ? `Open contract: ${contractUrl}` : null,
        ].filter(Boolean).join('\n'),
      })
    ))
  )

  let emailedRecipients = 0

  for (const result of emailResults) {
    if (result.status === 'fulfilled') {
      if (!result.value?.skipped) emailedRecipients += 1
      continue
    }

    console.error('Contract assignment email failed:', result.reason)
  }

  return {
    notifiedUsers: linkedUsers.length,
    emailedRecipients,
  }
}

export async function sendContractDateReminder({
  contract,
  dateField,
}) {
  const recipients = await resolveAssignedRecipients({
    assignedUserId: contract.assignedUserId,
    assignedTo: contract.assignedTo,
  })
  if (!recipients.length || !contract[dateField]) {
    return { notifiedUsers: 0, emailedRecipients: 0 }
  }

  const dateLabel = dateField === 'renewalDate' ? 'renewal date' : 'end date'
  const formattedDate = formatContractDate(contract[dateField])
  const countdownLabel = getDaysRemainingLabel(contract[dateField])
  const linkedUsers = recipients.filter(recipient => recipient.id)
  const message = `Contract "${contract.title}" has an upcoming ${dateLabel} ${countdownLabel}.`

  if (linkedUsers.length > 0) {
    await prisma.notification.createMany({
      data: linkedUsers.map(user => ({
        message,
        type: 'warning',
        userId: user.id,
      })),
    })
  }

  const appUrl = getAppUrl()
  const contractUrl = appUrl ? `${appUrl}/contracts/${contract.id}` : null

  const emailResults = await Promise.allSettled(
    recipients.map(recipient => (
      sendEmail({
        to: recipient.email,
        subject: `Contract reminder: ${contract.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
            <p>Hello ${escapeHtml(recipient.name || recipient.email)},</p>
            <p>The contract below has an upcoming ${escapeHtml(dateLabel)}.</p>
            <p><strong>Contract:</strong> ${escapeHtml(contract.title)}</p>
            <p><strong>Client:</strong> ${escapeHtml(contract.client || 'Not set')}</p>
            <p><strong>${escapeHtml(dateLabel)}:</strong> ${escapeHtml(formattedDate)} (${escapeHtml(countdownLabel)})</p>
            ${contractUrl ? `<p><a href="${contractUrl}">Open this contract in BidFlow</a></p>` : ''}
          </div>
        `,
        text: [
          `Hello ${recipient.name || recipient.email},`,
          '',
          `The contract below has an upcoming ${dateLabel}.`,
          `Contract: ${contract.title}`,
          `Client: ${contract.client || 'Not set'}`,
          `${dateLabel}: ${formattedDate} (${countdownLabel})`,
          contractUrl ? `Open contract: ${contractUrl}` : null,
        ].filter(Boolean).join('\n'),
      })
    ))
  )

  let emailedRecipients = 0

  for (const result of emailResults) {
    if (result.status === 'fulfilled') {
      if (!result.value?.skipped) emailedRecipients += 1
      continue
    }

    console.error('Contract reminder email failed:', result.reason)
  }

  return {
    notifiedUsers: linkedUsers.length,
    emailedRecipients,
  }
}
