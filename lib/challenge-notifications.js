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

function formatDate(value) {
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

async function resolveChallengeRecipients(challenge) {
  const recipients = await resolveAssignedRecipients({
    assignedUserId: challenge.tender?.assignedUserId || null,
    assignedTo: challenge.tender?.assignedTo || null,
  })

  if (recipients.length > 0) return recipients

  const firmProfile = await prisma.firmProfile.findUnique({
    where: { organizationId: challenge.organizationId },
    select: {
      primaryContactName: true,
      primaryContactEmail: true,
    },
  })

  if (!firmProfile?.primaryContactEmail) return []

  return [{
    id: null,
    name: firmProfile.primaryContactName || firmProfile.primaryContactEmail,
    email: firmProfile.primaryContactEmail,
  }]
}

export async function notifyChallengeCreated({
  challenge,
}) {
  const recipients = await resolveChallengeRecipients(challenge)
  if (!recipients.length) return { notifiedUsers: 0, emailedRecipients: 0 }

  const linkedUsers = recipients.filter(recipient => recipient.id)
  const title = 'Challenge opened'
  const message = `Challenge "${challenge.reason}" was opened for ${challenge.tender?.title || 'an unlinked matter'}.`

  if (linkedUsers.length > 0) {
    await prisma.notification.createMany({
      data: linkedUsers.map(user => ({
        title,
        message,
        type: 'warning',
        userId: user.id,
        organizationId: challenge.organizationId,
        linkUrl: `/challenges/${challenge.id}`,
        linkLabel: 'Open challenge',
      })),
    })
  }

  const appUrl = getAppUrl()
  const challengeUrl = appUrl ? `${appUrl}/challenges/${challenge.id}` : null

  const emailResults = await Promise.allSettled(
    recipients.map(recipient => (
      sendEmail({
        to: recipient.email,
        subject: `Challenge opened: ${challenge.reason}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
            <p>Hello ${escapeHtml(recipient.name || recipient.email)},</p>
  <p>A challenge has been opened in Bid360.</p>
            <p><strong>Challenge:</strong> ${escapeHtml(challenge.reason)}</p>
            <p><strong>Type:</strong> ${escapeHtml(challenge.challengeType || 'Administrative Appeal')}</p>
            <p><strong>Deadline:</strong> ${escapeHtml(formatDate(challenge.deadline))}</p>
${challengeUrl ? `<p><a href="${challengeUrl}">Open this challenge in Bid360</a></p>` : ''}
          </div>
        `,
        text: [
          `Hello ${recipient.name || recipient.email},`,
          '',
    'A challenge has been opened in Bid360.',
          `Challenge: ${challenge.reason}`,
          `Type: ${challenge.challengeType || 'Administrative Appeal'}`,
          `Deadline: ${formatDate(challenge.deadline)}`,
          challengeUrl ? `Open challenge: ${challengeUrl}` : null,
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

    console.error('Challenge creation email failed:', result.reason)
  }

  return {
    notifiedUsers: linkedUsers.length,
    emailedRecipients,
  }
}

export async function sendChallengeDeadlineReminder({
  challenge,
}) {
  const recipients = await resolveChallengeRecipients(challenge)
  if (!recipients.length || !challenge.deadline) {
    return { notifiedUsers: 0, emailedRecipients: 0 }
  }

  const linkedUsers = recipients.filter(recipient => recipient.id)
  const formattedDate = formatDate(challenge.deadline)
  const countdownLabel = getDaysRemainingLabel(challenge.deadline)
  const title = 'Challenge deadline approaching'
  const message = `Challenge "${challenge.reason}" is due ${countdownLabel}.`

  if (linkedUsers.length > 0) {
    await prisma.notification.createMany({
      data: linkedUsers.map(user => ({
        title,
        message,
        type: 'warning',
        userId: user.id,
        organizationId: challenge.organizationId,
        linkUrl: `/challenges/${challenge.id}`,
        linkLabel: 'Open challenge',
      })),
    })
  }

  const appUrl = getAppUrl()
  const challengeUrl = appUrl ? `${appUrl}/challenges/${challenge.id}` : null

  const emailResults = await Promise.allSettled(
    recipients.map(recipient => (
      sendEmail({
        to: recipient.email,
        subject: `Challenge deadline: ${challenge.reason}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
            <p>Hello ${escapeHtml(recipient.name || recipient.email)},</p>
            <p>The challenge below has an important deadline coming up.</p>
            <p><strong>Challenge:</strong> ${escapeHtml(challenge.reason)}</p>
            <p><strong>Deadline:</strong> ${escapeHtml(formattedDate)} (${escapeHtml(countdownLabel)})</p>
            <p><strong>Next step:</strong> ${escapeHtml(challenge.nextStep || 'Review evidence and finalize the filing.')}</p>
${challengeUrl ? `<p><a href="${challengeUrl}">Open this challenge in Bid360</a></p>` : ''}
          </div>
        `,
        text: [
          `Hello ${recipient.name || recipient.email},`,
          '',
          'The challenge below has an important deadline coming up.',
          `Challenge: ${challenge.reason}`,
          `Deadline: ${formattedDate} (${countdownLabel})`,
          `Next step: ${challenge.nextStep || 'Review evidence and finalize the filing.'}`,
          challengeUrl ? `Open challenge: ${challengeUrl}` : null,
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

    console.error('Challenge deadline email failed:', result.reason)
  }

  return {
    notifiedUsers: linkedUsers.length,
    emailedRecipients,
  }
}
