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
  const message = `${actorName} allocated appointment "${contract.title}" to you.`
  const title = 'Appointment allocated'

  if (linkedUsers.length > 0) {
    await prisma.notification.createMany({
      data: linkedUsers.map(user => ({
        title,
        message,
        type: 'info',
        userId: user.id,
        organizationId: contract.organizationId,
        linkUrl: `/appointments/${contract.id}`,
        linkLabel: 'Open appointment',
      })),
    })
  }

  const appUrl = getAppUrl()
  const contractUrl = appUrl ? `${appUrl}/appointments/${contract.id}` : null

  const emailResults = await Promise.allSettled(
    newRecipients.map(recipient => (
      sendEmail({
        to: recipient.email,
        subject: `Appointment allocated: ${contract.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
            <p>Hello ${escapeHtml(recipient.name || recipient.email)},</p>
            <p>${escapeHtml(actorName)} allocated an appointment to you in BidFlow.</p>
            <p><strong>Appointment:</strong> ${escapeHtml(contract.title)}</p>
            <p><strong>Client:</strong> ${escapeHtml(contract.client || 'Not set')}</p>
            <p><strong>Appointment date:</strong> ${escapeHtml(formatContractDate(contract.appointmentDate))}</p>
            <p><strong>End date:</strong> ${escapeHtml(formatContractDate(contract.endDate))}</p>
            <p><strong>Renewal date:</strong> ${escapeHtml(formatContractDate(contract.renewalDate))}</p>
            ${contractUrl ? `<p><a href="${contractUrl}">Open this appointment in BidFlow</a></p>` : ''}
          </div>
        `,
        text: [
          `Hello ${recipient.name || recipient.email},`,
          '',
          `${actorName} allocated an appointment to you in BidFlow.`,
          `Appointment: ${contract.title}`,
          `Client: ${contract.client || 'Not set'}`,
          `Appointment date: ${formatContractDate(contract.appointmentDate)}`,
          `End date: ${formatContractDate(contract.endDate)}`,
          `Renewal date: ${formatContractDate(contract.renewalDate)}`,
          contractUrl ? `Open appointment: ${contractUrl}` : null,
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
  const message = `Appointment "${contract.title}" has an upcoming ${dateLabel} ${countdownLabel}.`
  const title = dateField === 'renewalDate' ? 'Appointment renewal reminder' : 'Appointment end-date reminder'

  if (linkedUsers.length > 0) {
    await prisma.notification.createMany({
      data: linkedUsers.map(user => ({
        title,
        message,
        type: 'warning',
        userId: user.id,
        organizationId: contract.organizationId,
        linkUrl: `/appointments/${contract.id}`,
        linkLabel: 'Open appointment',
      })),
    })
  }

  const appUrl = getAppUrl()
  const contractUrl = appUrl ? `${appUrl}/appointments/${contract.id}` : null

  const emailResults = await Promise.allSettled(
    recipients.map(recipient => (
      sendEmail({
        to: recipient.email,
        subject: `Appointment reminder: ${contract.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
            <p>Hello ${escapeHtml(recipient.name || recipient.email)},</p>
            <p>The appointment below has an upcoming ${escapeHtml(dateLabel)}.</p>
            <p><strong>Appointment:</strong> ${escapeHtml(contract.title)}</p>
            <p><strong>Client:</strong> ${escapeHtml(contract.client || 'Not set')}</p>
            <p><strong>${escapeHtml(dateLabel)}:</strong> ${escapeHtml(formattedDate)} (${escapeHtml(countdownLabel)})</p>
            ${contractUrl ? `<p><a href="${contractUrl}">Open this appointment in BidFlow</a></p>` : ''}
          </div>
        `,
        text: [
          `Hello ${recipient.name || recipient.email},`,
          '',
          `The appointment below has an upcoming ${dateLabel}.`,
          `Appointment: ${contract.title}`,
          `Client: ${contract.client || 'Not set'}`,
          `${dateLabel}: ${formattedDate} (${countdownLabel})`,
          contractUrl ? `Open appointment: ${contractUrl}` : null,
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

export async function sendAppointmentFollowUpReminder({
  contract,
}) {
  const recipients = await resolveAssignedRecipients({
    assignedUserId: contract.assignedUserId,
    assignedTo: contract.assignedTo,
  })
  if (!recipients.length || !contract.nextFollowUpAt) {
    return { notifiedUsers: 0, emailedRecipients: 0 }
  }

  const formattedDate = formatContractDate(contract.nextFollowUpAt)
  const countdownLabel = getDaysRemainingLabel(contract.nextFollowUpAt)
  const linkedUsers = recipients.filter(recipient => recipient.id)
  const title = 'Appointment follow-up due'
  const message = `Appointment "${contract.title}" needs follow-up ${countdownLabel}.`

  if (linkedUsers.length > 0) {
    await prisma.notification.createMany({
      data: linkedUsers.map(user => ({
        title,
        message,
        type: 'warning',
        userId: user.id,
        organizationId: contract.organizationId,
        linkUrl: `/appointments/${contract.id}`,
        linkLabel: 'Open appointment',
      })),
    })
  }

  const appUrl = getAppUrl()
  const contractUrl = appUrl ? `${appUrl}/appointments/${contract.id}` : null

  const emailResults = await Promise.allSettled(
    recipients.map(recipient => (
      sendEmail({
        to: recipient.email,
        subject: `Appointment follow-up due: ${contract.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
            <p>Hello ${escapeHtml(recipient.name || recipient.email)},</p>
            <p>The appointment below needs a follow-up action.</p>
            <p><strong>Appointment:</strong> ${escapeHtml(contract.title)}</p>
            <p><strong>Client:</strong> ${escapeHtml(contract.client || 'Not set')}</p>
            <p><strong>Instruction status:</strong> ${escapeHtml(contract.instructionStatus || 'No Instruction')}</p>
            <p><strong>Follow-up date:</strong> ${escapeHtml(formattedDate)} (${escapeHtml(countdownLabel)})</p>
            ${contractUrl ? `<p><a href="${contractUrl}">Open this appointment in BidFlow</a></p>` : ''}
          </div>
        `,
        text: [
          `Hello ${recipient.name || recipient.email},`,
          '',
          'The appointment below needs a follow-up action.',
          `Appointment: ${contract.title}`,
          `Client: ${contract.client || 'Not set'}`,
          `Instruction status: ${contract.instructionStatus || 'No Instruction'}`,
          `Follow-up date: ${formattedDate} (${countdownLabel})`,
          contractUrl ? `Open appointment: ${contractUrl}` : null,
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

    console.error('Appointment follow-up email failed:', result.reason)
  }

  return {
    notifiedUsers: linkedUsers.length,
    emailedRecipients,
  }
}
