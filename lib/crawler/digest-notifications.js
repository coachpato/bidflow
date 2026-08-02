import { getAppUrl, sendEmail } from '@/lib/email'
import logger from '@/lib/logger'
import prisma from '@/lib/prisma'
import { getSectorLabel } from '@/lib/sectors'
import { getServiceSectorLabel } from '@/lib/service-sectors'
import { matchTenderToSectors } from '@/lib/matching/sector-matcher'
import { getSubscriberKeywordMatches } from '@/lib/matching/subscriber-matcher'

const SOURCE_NAME = 'eTenders.gov.za'
const USER_FILTER_NOTE = 'Diagnostic only: daily crawler digest send logic currently uses firmProfile.primaryContactEmail plus CRAWLER_EMAIL_RECIPIENTS, not queried users.'
const DEFAULT_CATCHUP_CANDIDATE_LIMIT = 2000
const DEFAULT_MAX_TENDERS_PER_SUBSCRIBER_DIGEST = 25

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

export async function sendDailyDigestEmail({ organization, sourceRun, opportunities, crawlerLogger = logger }) {
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

export async function createDigestNotification({ organizationId, sourceRunId, count }) {
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDigestDate(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

function formatTenderDate(value) {
  if (!value) return 'Not listed'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not listed'

  return date.toISOString().slice(0, 10)
}

function getPositiveIntegerEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || '', 10)
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function getCatchupCandidateLimit() {
  return getPositiveIntegerEnv(
    'SUBSCRIBER_DIGEST_CATCHUP_CANDIDATE_LIMIT',
    DEFAULT_CATCHUP_CANDIDATE_LIMIT
  )
}

function getMaxTendersPerSubscriberDigest() {
  return getPositiveIntegerEnv(
    'SUBSCRIBER_DIGEST_MAX_ITEMS',
    DEFAULT_MAX_TENDERS_PER_SUBSCRIBER_DIGEST
  )
}

function buildUnsubscribeUrl(subscriber) {
  const token = subscriber?.unsubscribeToken
  if (!token) return null

  const appUrl = getAppUrl()
  const path = `/api/unsubscribe?token=${encodeURIComponent(token)}`
  return appUrl ? `${appUrl}${path}` : path
}

export function getSubscriberDigestGroups({ subscriberMatchMap, results } = {}) {
  const matchMap = subscriberMatchMap || results?.subscriberMatchMap
  if (!(matchMap instanceof Map)) return []

  return Array.from(matchMap.values())
    .map(group => ({
      subscriber: group.subscriber,
      tenders: Array.isArray(group.tenders) ? group.tenders : [],
    }))
    .filter(group => group.subscriber && group.tenders.length > 0)
}

function getExistingDigestTenderIds(matchMap, subscriberId) {
  const group = matchMap.get(subscriberId)
  return new Set((group?.tenders || []).map(tender => tender.id).filter(Boolean))
}

function addStoredDigestTender({ matchMap, subscriber, tender }) {
  if (!matchMap.has(subscriber.id)) {
    matchMap.set(subscriber.id, {
      subscriber,
      tenders: [],
    })
  }

  const group = matchMap.get(subscriber.id)
  if (group.tenders.some(item => item.id === tender.id)) return false

  group.tenders.push({
    ...tender,
    subscriberSector: subscriber.sector,
  })
  return true
}

function buildDigestTenderFromOpportunity(opportunity, matchedSectors) {
  return {
    id: opportunity.id,
    title: opportunity.title,
    reference: opportunity.reference,
    entity: opportunity.entity,
    category: opportunity.category,
    sourceUrl: opportunity.sourceUrl,
    deadline: opportunity.deadline,
    publishedAt: opportunity.publishedAt,
    matchedSectors,
  }
}

async function findDeliveredOpportunityIds({ db, subscriberId, opportunityIds }) {
  if (opportunityIds.length === 0) return new Set()
  if (typeof db?.subscriberTenderDelivery?.findMany !== 'function') return new Set()

  const deliveredRows = await db.subscriberTenderDelivery.findMany({
    where: {
      subscriberId,
      opportunityId: { in: opportunityIds },
    },
    select: { opportunityId: true },
  })

  return new Set(deliveredRows.map(row => row.opportunityId))
}

async function loadCatchupOpportunityCandidates({ db, subscriber, now }) {
  if (typeof db?.opportunity?.findMany !== 'function') return []

  const since = subscriber.createdAt || new Date(0)

  return db.opportunity.findMany({
    where: {
      sourceName: SOURCE_NAME,
      AND: [
        {
          OR: [
            { createdAt: { gte: since } },
            { publishedAt: { gte: since } },
          ],
        },
        {
          OR: [
            { deadline: null },
            { deadline: { gte: now } },
          ],
        },
      ],
    },
    orderBy: [
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
    take: getCatchupCandidateLimit(),
    select: {
      id: true,
      title: true,
      reference: true,
      entity: true,
      category: true,
      sourceUrl: true,
      summary: true,
      publishedAt: true,
      deadline: true,
      createdAt: true,
    },
  })
}

export async function addUndeliveredStoredSubscriberMatches({
  db = null,
  subscriberMatchMap,
  results,
  sourceRun,
  now = new Date(),
  crawlerLogger = logger,
} = {}) {
  const matchMap = subscriberMatchMap || results?.subscriberMatchMap
  if (!(matchMap instanceof Map)) {
    return { skipped: true, reason: 'subscriber_match_map_unavailable' }
  }

  if (
    typeof db?.subscriber?.findMany !== 'function'
    || typeof db?.opportunity?.findMany !== 'function'
    || typeof db?.subscriberTenderDelivery?.findMany !== 'function'
  ) {
    return { skipped: true, reason: 'digest_delivery_ledger_unavailable' }
  }

  const subscribers = await db.subscriber.findMany({
    where: { subscribed: true },
    select: {
      id: true,
      email: true,
      entityName: true,
      sector: true,
      keywords: true,
      location: true,
      unsubscribeToken: true,
      createdAt: true,
    },
    orderBy: [
      { sector: 'asc' },
      { email: 'asc' },
    ],
  })
  const maxPerDigest = getMaxTendersPerSubscriberDigest()
  let storedMatchesAdded = 0
  let candidatesScanned = 0

  for (const subscriber of subscribers) {
    const currentTenderIds = getExistingDigestTenderIds(matchMap, subscriber.id)
    const remainingSlots = Math.max(0, maxPerDigest - currentTenderIds.size)
    if (remainingSlots === 0) continue

    const candidates = await loadCatchupOpportunityCandidates({ db, subscriber, now })
    candidatesScanned += candidates.length

    const matches = candidates
      .map((opportunity, index) => {
        if (currentTenderIds.has(opportunity.id)) return null

        const matchedSectors = matchTenderToSectors(opportunity)
        if (!matchedSectors.includes(subscriber.sector)) return null

        return {
          opportunity,
          index,
          matchedSectors,
          keywordMatchCount: getSubscriberKeywordMatches(subscriber, opportunity).length,
        }
      })
      .filter(Boolean)
      .sort((left, right) => {
        const keywordHitDelta =
          Number(right.keywordMatchCount > 0) - Number(left.keywordMatchCount > 0)

        return keywordHitDelta
          || right.keywordMatchCount - left.keywordMatchCount
          || left.index - right.index
      })
    const deliveredIds = await findDeliveredOpportunityIds({
      db,
      subscriberId: subscriber.id,
      opportunityIds: matches.map(match => match.opportunity.id),
    })

    for (const match of matches) {
      if (storedMatchesAdded >= maxPerDigest * subscribers.length) break
      if (deliveredIds.has(match.opportunity.id)) continue

      const added = addStoredDigestTender({
        matchMap,
        subscriber,
        tender: buildDigestTenderFromOpportunity(match.opportunity, match.matchedSectors),
      })

      if (added) {
        storedMatchesAdded += 1
        currentTenderIds.add(match.opportunity.id)
      }

      if (currentTenderIds.size >= maxPerDigest) break
    }
  }

  results.subscriberDigestGroups = matchMap.size
  results.subscriberMatchStats ||= {}
  results.subscriberMatchStats.storedSubscriberTenderMatchesQueued =
    (results.subscriberMatchStats.storedSubscriberTenderMatchesQueued || 0) + storedMatchesAdded

  crawlerLogger.crawler({
    level: storedMatchesAdded > 0 ? 'info' : 'debug',
    phase: 'notification',
    runId: sourceRun?.id || null,
    message: 'crawler_subscriber_digest_stored_match_scan_completed',
    data: {
      sourceRunId: sourceRun?.id || null,
      subscribersScanned: subscribers.length,
      candidatesScanned,
      storedMatchesAdded,
    },
  })

  return {
    skipped: false,
    subscribersScanned: subscribers.length,
    candidatesScanned,
    storedMatchesAdded,
  }
}

export function buildSubscriberDigestDeliveryVisibility({ subscriberMatchMap, results, sourceRun } = {}) {
  const groups = getSubscriberDigestGroups({ subscriberMatchMap, results })
  const tendersCount = groups.reduce((count, group) => count + group.tenders.length, 0)

  return {
    sourceRunId: sourceRun?.id || null,
    subscriberDigestGroups: groups.length,
    subscriberTenderMatches: tendersCount,
    matchedCount: results?.matchedCount || 0,
    newOpportunitiesCreated: results?.newOpportunitiesCreated || 0,
    sendAttemptsExpected: groups.length,
    groups: groups.map(group => ({
      subscriberId: group.subscriber.id,
      email: group.subscriber.email,
      entityName: group.subscriber.entityName,
      sector: group.subscriber.sector,
      sectorLabel: getSectorLabel(group.subscriber.sector),
      tendersCount: group.tenders.length,
      unsubscribeTokenPresent: Boolean(group.subscriber.unsubscribeToken),
    })),
  }
}

async function sendSubscriberDigestEmail({ subscriber, sourceRun, tenders }) {
  const sectorLabel = getSectorLabel(subscriber.sector)
  const digestDate = formatDigestDate(sourceRun?.startedAt)
  const unsubscribeUrl = buildUnsubscribeUrl(subscriber)
  const listRows = tenders
    .map(tender => {
      const tenderLink = tender.sourceUrl
        ? `<a href="${escapeHtml(tender.sourceUrl)}" style="color:#18314a;font-weight:700;">${escapeHtml(tender.title)}</a>`
        : `<strong>${escapeHtml(tender.title)}</strong>`

      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;">
            ${tenderLink}<br/>
            <span style="font-size:13px;color:#475569;">${escapeHtml(tender.entity)} | Ref: ${escapeHtml(tender.reference || 'N/A')}</span>
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(tender.category || sectorLabel)}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(formatTenderDate(tender.deadline))}</td>
        </tr>
      `
    })
    .join('')

  const textTenderRows = tenders.map(tender => [
    `- ${tender.title}`,
    `  Entity: ${tender.entity}`,
    `  Ref: ${tender.reference || 'N/A'}`,
    `  Deadline: ${formatTenderDate(tender.deadline)}`,
    tender.sourceUrl ? `  Link: ${tender.sourceUrl}` : null,
  ].filter(Boolean).join('\n'))

  const html = `
    <html>
      <body style="margin:0;background:#f7f5ef;padding:32px 0;font-family:Arial,sans-serif;color:#111827;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e6dfd0;border-radius:16px;overflow:hidden;">
          <div style="padding:28px 32px;background:#18314a;color:#ffffff;">
            <div style="font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;opacity:0.85;">Bid360 tender digest</div>
            <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;">Your ${escapeHtml(sectorLabel)} tender digest</h1>
          </div>
          <div style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hello ${escapeHtml(subscriber.entityName)},</p>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;">We found <strong>${tenders.length}</strong> new ${escapeHtml(sectorLabel.toLowerCase())} tender match${tenders.length === 1 ? '' : 'es'} from ${SOURCE_NAME}.</p>
            <table style="width:100%;border-collapse:collapse;margin:24px 0;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:12px;text-align:left;border-bottom:2px solid #e2e8f0;">Tender</th>
                  <th style="padding:12px;text-align:left;border-bottom:2px solid #e2e8f0;">Category</th>
                  <th style="padding:12px;text-align:left;border-bottom:2px solid #e2e8f0;">Deadline</th>
                </tr>
              </thead>
              <tbody>${listRows}</tbody>
            </table>
            <p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:#64748b;">Digest date: ${escapeHtml(digestDate)}</p>
            ${unsubscribeUrl ? `<p style="margin:12px 0 0;font-size:13px;line-height:1.7;color:#64748b;"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#64748b;">Unsubscribe from this ${escapeHtml(sectorLabel)} digest</a></p>` : ''}
          </div>
        </div>
      </body>
    </html>
  `

  const text = [
    `Your ${sectorLabel} tender digest`,
    '',
    `Hello ${subscriber.entityName},`,
    '',
    `We found ${tenders.length} new ${sectorLabel.toLowerCase()} tender match${tenders.length === 1 ? '' : 'es'} from ${SOURCE_NAME}.`,
    '',
    ...textTenderRows,
    '',
    `Digest date: ${digestDate}`,
    unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : null,
  ].filter(Boolean).join('\n')

  return sendEmail({
    to: subscriber.email,
    subject: `Your ${sectorLabel} tender digest \u2014 ${digestDate}`,
    html,
    text,
  })
}

async function markSubscriberDigestDelivered({ db, subscriber, sourceRun, tenders }) {
  if (tenders.length === 0) return { count: 0, skipped: false }
  if (typeof db?.subscriberTenderDelivery?.createMany !== 'function') {
    return { count: 0, skipped: true }
  }

  return db.subscriberTenderDelivery.createMany({
    data: tenders.map(tender => ({
      subscriberId: subscriber.id,
      opportunityId: tender.id,
      sourceRunId: sourceRun?.id || null,
    })),
    skipDuplicates: true,
  })
}

export async function deliverDigestNotifications({
  sourceRun,
  results,
  subscriberMatchMap = results?.subscriberMatchMap,
  crawlerLogger = logger,
  db = null,
}) {
  await addUndeliveredStoredSubscriberMatches({
    db,
    subscriberMatchMap,
    results,
    sourceRun,
    crawlerLogger,
  })

  const visibility = buildSubscriberDigestDeliveryVisibility({ subscriberMatchMap, results, sourceRun })

  crawlerLogger.crawler({
    level: visibility.sendAttemptsExpected === 0 ? 'info' : 'info',
    phase: 'notification',
    runId: sourceRun?.id || null,
    message: 'crawler_subscriber_digest_delivery_visibility',
    data: visibility,
  })

  const groups = getSubscriberDigestGroups({ subscriberMatchMap, results })

  for (const group of groups) {
    crawlerLogger.crawler({
      level: 'info',
      phase: 'notification',
      runId: sourceRun.id,
      message: 'crawler_subscriber_digest_email_send_decision',
      data: {
        sourceRunId: sourceRun.id,
        subscriberId: group.subscriber.id,
        email: group.subscriber.email,
        entityName: group.subscriber.entityName,
        sector: group.subscriber.sector,
        tendersCount: group.tenders.length,
        sendSkipped: false,
      },
    })

    const delivery = await sendSubscriberDigestEmail({
      subscriber: group.subscriber,
      sourceRun,
      tenders: group.tenders,
    })

    results.digestsSent += 1
    results.emailsAttempted = (results.emailsAttempted || 0) + 1
    if (delivery?.skipped || delivery?.dryRun) {
      results.emailsSkipped = (results.emailsSkipped || 0) + 1
    } else {
      await markSubscriberDigestDelivered({
        db,
        subscriber: group.subscriber,
        sourceRun,
        tenders: group.tenders,
      })
      results.emailsSent = (results.emailsSent || 0) + 1
    }

    results.subscriberDigestsDelivered ||= []
    results.subscriberDigestsDelivered.push({
      subscriberId: group.subscriber.id,
      email: group.subscriber.email,
      sector: group.subscriber.sector,
      tendersCount: group.tenders.length,
    })
  }
}
