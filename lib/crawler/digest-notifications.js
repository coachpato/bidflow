import { getAppUrl, sendEmail } from '@/lib/email'
import logger from '@/lib/logger'
import prisma from '@/lib/prisma'
import { getServiceSectorLabel } from '@/lib/service-sectors'

const SOURCE_NAME = 'eTenders.gov.za'
const USER_FILTER_NOTE = 'Diagnostic only: daily crawler digest send logic currently uses firmProfile.primaryContactEmail plus CRAWLER_EMAIL_RECIPIENTS, not queried users.'

function getDigestRecipientCandidates(organization) {
  return [
    organization?.firmProfile?.primaryContactEmail,
    ...(process.env.CRAWLER_EMAIL_RECIPIENTS || '')
      .split(',')
      .map(email => email.trim())
      .filter(Boolean),
  ]
}

function getDigestRecipients(organization) {
  const recipients = getDigestRecipientCandidates(organization).filter(Boolean)

  return Array.from(new Set(recipients))
}

function summarizeRecipientResolution(organization) {
  const candidates = getDigestRecipientCandidates(organization)
  const nonEmptyCandidates = candidates.filter(Boolean)
  const recipients = Array.from(new Set(nonEmptyCandidates))

  return {
    recipientCandidates: candidates.length,
    blankRecipientsFiltered: candidates.length - nonEmptyCandidates.length,
    duplicateRecipientsFiltered: nonEmptyCandidates.length - recipients.length,
    recipientsAfterFiltering: recipients.length,
    primaryContactEmailPresent: Boolean(organization?.firmProfile?.primaryContactEmail),
    envRecipientCandidates: (process.env.CRAWLER_EMAIL_RECIPIENTS || '')
      .split(',')
      .map(email => email.trim())
      .filter(Boolean).length,
  }
}

function summarizeUniqueUsers(memberships) {
  const usersById = new Map()

  for (const membership of memberships) {
    if (membership.user?.id) {
      usersById.set(membership.user.id, membership.user)
    }
  }

  const users = Array.from(usersById.values())
  const usersWithEmail = users.filter(user => Boolean(user.email))
  const usersAfterFiltering = usersWithEmail.filter(user => Boolean(user.emailVerified))

  return {
    usersQueried: users.length,
    usersAfterFiltering: usersAfterFiltering.length,
    filters: {
      missingEmailFiltered: users.length - usersWithEmail.length,
      unverifiedEmailFiltered: usersWithEmail.length - usersAfterFiltering.length,
      unsubscribedFiltered: 0,
      inactiveFiltered: 0,
      unsubscribeFilterAvailable: false,
      inactiveFilterAvailable: false,
      note: USER_FILTER_NOTE,
    },
  }
}

function getDigestSkipDecision({ organization, opportunitiesCount, recipientsAfterFiltering }) {
  if (!organization) {
    return {
      sendSkipped: true,
      skipStage: 'deliverDigestNotifications',
      skipReason: 'organization_not_loaded',
      exactCondition: '!organization',
    }
  }

  if (opportunitiesCount === 0) {
    return {
      sendSkipped: true,
      skipStage: 'deliverDigestNotifications',
      skipReason: 'no_opportunities_in_digest_group',
      exactCondition: 'organizationResult.opportunities.length === 0',
    }
  }

  if (recipientsAfterFiltering === 0) {
    return {
      sendSkipped: true,
      skipStage: 'sendDailyDigestEmail',
      skipReason: 'no_digest_recipients',
      exactCondition: 'recipients.length === 0 || opportunities.length === 0 (recipients.length === 0)',
    }
  }

  return {
    sendSkipped: false,
    skipStage: null,
    skipReason: null,
    exactCondition: 'recipients.length > 0 && opportunities.length > 0',
  }
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] || 'none'
    counts[value] = (counts[value] || 0) + 1
    return counts
  }, {})
}

export async function buildDigestDeliveryVisibility({ organizations = [], sourceRun = null, results = {}, db = prisma } = {}) {
  const organizationResults = Object.values(results.opportunitiesByOrganization || {})
  const organizationIds = Array.from(new Set(
    organizationResults
      .map(organizationResult => organizationResult.organizationId)
      .filter(id => id !== undefined && id !== null)
  ))
  let memberships = []
  let userQueryError = null

  if (organizationIds.length > 0) {
    try {
      memberships = await db.membership.findMany({
        where: { organizationId: { in: organizationIds } },
        select: {
          organizationId: true,
          user: {
            select: {
              id: true,
              email: true,
              emailVerified: true,
            },
          },
        },
      })
    } catch (error) {
      userQueryError = error.message || String(error)
    }
  }

  const membershipsByOrganization = memberships.reduce((groups, membership) => {
    groups[membership.organizationId] ||= []
    groups[membership.organizationId].push(membership)
    return groups
  }, {})
  const userSummary = summarizeUniqueUsers(memberships)
  const groups = organizationResults.map(organizationResult => {
    const organization = organizations.find(item => item.id === organizationResult.organizationId)
    const opportunitiesCount = organizationResult.opportunities?.length || 0
    const recipientResolution = summarizeRecipientResolution(organization)
    const orgUserSummary = summarizeUniqueUsers(membershipsByOrganization[organizationResult.organizationId] || [])
    const decision = getDigestSkipDecision({
      organization,
      opportunitiesCount,
      recipientsAfterFiltering: recipientResolution.recipientsAfterFiltering,
    })

    return {
      organizationId: organizationResult.organizationId,
      organizationName: organization?.name || organizationResult.organizationName || null,
      organizationLoaded: Boolean(organization),
      opportunitiesCount,
      usersQueried: orgUserSummary.usersQueried,
      usersAfterFiltering: orgUserSummary.usersAfterFiltering,
      userFilters: orgUserSummary.filters,
      recipientResolution,
      ...decision,
    }
  })

  return {
    sourceRunId: sourceRun?.id || null,
    matchedCount: results.matchedCount || 0,
    newOpportunitiesCreated: results.newOpportunitiesCreated || 0,
    opportunityGroups: organizationResults.length,
    usersQueried: userSummary.usersQueried,
    usersAfterFiltering: userSummary.usersAfterFiltering,
    userFilters: userSummary.filters,
    userQueryError,
    sendLogicUsesUserQuery: false,
    sendLogicRecipientSource: 'firmProfile.primaryContactEmail + CRAWLER_EMAIL_RECIPIENTS',
    sendAttemptsExpected: groups.filter(group => !group.sendSkipped).length,
    skipReasons: countBy(groups.filter(group => group.sendSkipped), 'skipReason'),
    groups,
  }
}

export async function logDigestDeliveryVisibility({
  organizations,
  sourceRun,
  results,
  db = prisma,
  crawlerLogger = logger,
  overallSkipReason = null,
  overallExactCondition = null,
} = {}) {
  const visibility = await buildDigestDeliveryVisibility({ organizations, sourceRun, results, db })

  crawlerLogger.crawler({
    level: overallSkipReason || visibility.sendAttemptsExpected === 0 ? 'warn' : 'info',
    phase: 'notification',
    runId: sourceRun?.id || null,
    message: 'crawler_digest_delivery_visibility',
    data: {
      ...visibility,
      overallSkipReason,
      overallExactCondition,
    },
  })

  return visibility
}

async function sendDailyDigestEmail({ organization, sourceRun, opportunities, crawlerLogger = logger }) {
  const recipients = getDigestRecipients(organization)
  const decision = getDigestSkipDecision({
    organization,
    opportunitiesCount: opportunities.length,
    recipientsAfterFiltering: recipients.length,
  })

  crawlerLogger.crawler({
    level: decision.sendSkipped ? 'warn' : 'info',
    phase: 'notification',
    runId: sourceRun.id,
    message: 'crawler_digest_email_send_decision',
    data: {
      sourceRunId: sourceRun.id,
      organizationId: organization.id,
      organizationName: organization.name,
      opportunitiesCount: opportunities.length,
      recipientsAfterFiltering: recipients.length,
      skipStage: decision.skipStage,
      skipReason: decision.skipReason,
      exactCondition: decision.exactCondition,
      sendSkipped: decision.sendSkipped,
    },
  })

  if (recipients.length === 0 || opportunities.length === 0) {
    return { attempted: 0, sent: 0, skipped: recipients.length }
  }

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

  const deliveries = await Promise.all(
    recipients.map(recipient => sendEmail({
      to: recipient,
      subject: `Daily ${sectorLabel.toLowerCase()} opportunities: ${opportunities.length} new match(es)`,
      html,
      text,
    }))
  )

  return deliveries.reduce((summary, delivery) => {
    summary.attempted += 1
    if (delivery?.skipped || delivery?.dryRun) {
      summary.skipped += 1
    } else {
      summary.sent += 1
    }
    return summary
  }, { attempted: 0, sent: 0, skipped: 0 })
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

export async function deliverDigestNotifications({ organizations, sourceRun, results, crawlerLogger = logger }) {
  await logDigestDeliveryVisibility({ organizations, sourceRun, results, crawlerLogger })

  for (const organizationResult of Object.values(results.opportunitiesByOrganization)) {
    const organization = organizations.find(item => item.id === organizationResult.organizationId)
    if (!organization || organizationResult.opportunities.length === 0) {
      const recipientResolution = summarizeRecipientResolution(organization)
      const decision = getDigestSkipDecision({
        organization,
        opportunitiesCount: organizationResult.opportunities?.length || 0,
        recipientsAfterFiltering: recipientResolution.recipientsAfterFiltering,
      })
      crawlerLogger.crawler({
        level: 'warn',
        phase: 'notification',
        runId: sourceRun.id,
        message: 'crawler_digest_group_send_skipped',
        data: {
          sourceRunId: sourceRun.id,
          organizationId: organizationResult.organizationId,
          organizationName: organization?.name || organizationResult.organizationName || null,
          opportunitiesCount: organizationResult.opportunities?.length || 0,
          recipientResolution,
          skipStage: decision.skipStage,
          skipReason: decision.skipReason,
          exactCondition: decision.exactCondition,
        },
      })
      continue
    }

    const delivery = await sendDailyDigestEmail({
      organization,
      sourceRun,
      opportunities: organizationResult.opportunities,
      crawlerLogger,
    })
    await createDigestNotification({
      organizationId: organization.id,
      sourceRunId: sourceRun.id,
      count: organizationResult.opportunities.length,
    })
    results.digestsSent += 1
    results.emailsSent = (results.emailsSent || 0) + delivery.sent
    results.emailsSkipped = (results.emailsSkipped || 0) + delivery.skipped
    results.emailsAttempted = (results.emailsAttempted || 0) + delivery.attempted
  }
}
