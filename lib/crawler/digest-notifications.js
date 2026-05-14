import { getAppUrl, sendEmail } from '@/lib/email'
import prisma from '@/lib/prisma'
import { getServiceSectorLabel } from '@/lib/service-sectors'

const SOURCE_NAME = 'eTenders.gov.za'

function getDigestRecipients(organization) {
  const recipients = [
    organization.firmProfile?.primaryContactEmail,
    ...(process.env.CRAWLER_EMAIL_RECIPIENTS || '')
      .split(',')
      .map(email => email.trim())
      .filter(Boolean),
  ].filter(Boolean)

  return Array.from(new Set(recipients))
}

async function sendDailyDigestEmail({ organization, sourceRun, opportunities }) {
  const recipients = getDigestRecipients(organization)
  if (recipients.length === 0 || opportunities.length === 0) return

  const appUrl = getAppUrl()
  const sectorLabel = getServiceSectorLabel(organization.firmProfile?.serviceSector)
  const listRows = opportunities
    .map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          <strong>${item.title}</strong><br/>
          <small>${item.entity} | Ref: ${item.reference || 'N/A'}</small>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.practiceArea || 'Relevant Services'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.fitScore ?? 'Not scored'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.matchSummary}</td>
      </tr>
    `)
    .join('')

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; color: #111827;">
        <h2>Daily ${sectorLabel} Opportunity Digest</h2>
        <p>${organization.name} has <strong>${opportunities.length} new relevant opportunity match(es)</strong> from ${SOURCE_NAME}.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
          <thead>
            <tr style="background-color: #f8fafc;">
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Opportunity</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Practice Area</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Fit</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Why It Matched</th>
            </tr>
          </thead>
          <tbody>${listRows}</tbody>
        </table>

        <p>Source run started at: ${sourceRun.startedAt.toLocaleString('en-ZA')}</p>
        ${appUrl ? `<p><a href="${appUrl}/opportunities" style="display: inline-block; padding: 12px 18px; background: #0f766e; color: #fff; text-decoration: none; border-radius: 8px;">Open opportunity radar</a></p>` : ''}
      </body>
    </html>
  `

  const text = [
    `Daily ${sectorLabel} Opportunity Digest`,
    '',
    `${organization.name} has ${opportunities.length} new relevant opportunity match(es) from ${SOURCE_NAME}.`,
    '',
    ...opportunities.map(item => `- ${item.title} | ${item.entity} | ${item.fitScore ?? 'Not scored'} | ${item.matchSummary}`),
    '',
    appUrl ? `Review in Bid360: ${appUrl}/opportunities` : null,
  ].filter(Boolean).join('\n')

  await Promise.all(
    recipients.map(recipient => sendEmail({
      to: recipient,
      subject: `Daily ${sectorLabel.toLowerCase()} opportunities: ${opportunities.length} new match(es)`,
      html,
      text,
    }))
  )
}

async function createDigestNotification({ organizationId, sourceRunId, count }) {
  await prisma.notification.upsert({
    where: {
      sourceKey: `opportunity-digest:${sourceRunId}:${organizationId}`,
    },
    update: {
      title: 'Opportunity digest ready',
      message: `${count} new relevant opportunity match${count === 1 ? '' : 'es'} landed in your radar today.`,
      type: 'opportunity',
      organizationId,
      userId: null,
      read: false,
      linkUrl: '/opportunities',
      linkLabel: 'Open radar',
    },
    create: {
      sourceKey: `opportunity-digest:${sourceRunId}:${organizationId}`,
      title: 'Opportunity digest ready',
      message: `${count} new relevant opportunity match${count === 1 ? '' : 'es'} landed in your radar today.`,
      type: 'opportunity',
      organizationId,
      userId: null,
      linkUrl: '/opportunities',
      linkLabel: 'Open radar',
    },
  })
}

export async function deliverDigestNotifications({ organizations, sourceRun, results }) {
  for (const organizationResult of Object.values(results.opportunitiesByOrganization)) {
    const organization = organizations.find(item => item.id === organizationResult.organizationId)
    if (!organization || organizationResult.opportunities.length === 0) continue

    await sendDailyDigestEmail({ organization, sourceRun, opportunities: organizationResult.opportunities })
    await createDigestNotification({
      organizationId: organization.id,
      sourceRunId: sourceRun.id,
      count: organizationResult.opportunities.length,
    })
    results.digestsSent += 1
  }
}
