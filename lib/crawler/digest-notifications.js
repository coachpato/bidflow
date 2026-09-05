import { getAppUrl, sendEmail } from '@/lib/email'
import logger from '@/lib/logger'
import prisma from '@/lib/prisma'
import { getSectorLabel } from '@/lib/sectors'
import { getServiceSectorLabel } from '@/lib/service-sectors'
import {
  ETENDERS_GENERAL_OPPORTUNITIES_URL,
  normalizeEtendersDigestUrl,
} from '@/lib/crawler/etenders-links'
import { applyDigestStageGate } from '@/lib/crawler/digest-stage-gate'
import { buildBid360TenderUrl } from '@/lib/crawler/tender-identity'
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
    canonicalUrl: buildBid360TenderUrl(opportunity.id, opportunity.title),
    sourceUrl: normalizeEtendersDigestUrl(opportunity.sourceFallbackUrl || ETENDERS_GENERAL_OPPORTUNITIES_URL),
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
      sourceFallbackUrl: true,
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

function buildLogoUrl() {
  return `${getAppUrl()}/logo.png`
}

function buildManagePreferencesUrl() {
  return `${getAppUrl()}/manage`
}

function buildTenderEmailUrl(tender) {
  return tender.canonicalUrl
    || buildBid360TenderUrl(tender.id, tender.title)
    || normalizeEtendersDigestUrl(tender.sourceFallbackUrl || ETENDERS_GENERAL_OPPORTUNITIES_URL)
}

function buildSourceDigestUrl(tender) {
  return normalizeEtendersDigestUrl(tender.sourceFallbackUrl || ETENDERS_GENERAL_OPPORTUNITIES_URL)
}

function renderSubscriberDigestTenderCard(tender, sectorLabel) {
  const tenderUrl = buildTenderEmailUrl(tender)
  const sourceUrl = buildSourceDigestUrl(tender)
  const reference = tender.reference || 'N/A'
  const entity = tender.entity || 'Not listed'
  const category = tender.category || sectorLabel
  const closingDate = formatTenderDate(tender.deadline)

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;margin:0 0 16px;background:#ffffff;border:1px solid #e6dfd0;border-radius:8px;">
      <tr>
        <td style="padding:22px 22px 18px;font-family:Arial,sans-serif;">
          <a href="${escapeHtml(tenderUrl)}" style="display:block;margin:0 0 16px;font-size:18px;line-height:1.35;font-weight:700;color:#18314a;text-decoration:none;">${escapeHtml(tender.title)}</a>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
            <tr>
              <td width="42%" valign="top" style="padding:8px 12px 8px 0;border-top:1px solid #edf0f3;font-size:12px;line-height:1.5;font-weight:700;color:#64748b;text-transform:uppercase;">Reference Number</td>
              <td valign="top" style="padding:8px 0;border-top:1px solid #edf0f3;font-size:14px;line-height:1.5;color:#162132;">${escapeHtml(reference)}</td>
            </tr>
            <tr>
              <td width="42%" valign="top" style="padding:8px 12px 8px 0;border-top:1px solid #edf0f3;font-size:12px;line-height:1.5;font-weight:700;color:#64748b;text-transform:uppercase;">Municipality / Entity</td>
              <td valign="top" style="padding:8px 0;border-top:1px solid #edf0f3;font-size:14px;line-height:1.5;color:#162132;">${escapeHtml(entity)}</td>
            </tr>
            <tr>
              <td width="42%" valign="top" style="padding:8px 12px 8px 0;border-top:1px solid #edf0f3;font-size:12px;line-height:1.5;font-weight:700;color:#64748b;text-transform:uppercase;">Category</td>
              <td valign="top" style="padding:8px 0;border-top:1px solid #edf0f3;font-size:14px;line-height:1.5;color:#162132;">${escapeHtml(category)}</td>
            </tr>
            <tr>
              <td width="42%" valign="top" style="padding:8px 12px 8px 0;border-top:1px solid #edf0f3;font-size:12px;line-height:1.5;font-weight:700;color:#64748b;text-transform:uppercase;">Closing Date</td>
              <td valign="top" style="padding:8px 0;border-top:1px solid #edf0f3;font-size:14px;line-height:1.5;color:#162132;">${escapeHtml(closingDate)}</td>
            </tr>
          </table>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:18px 0 0;">
            <tr>
              <td bgcolor="#18314a" style="border-radius:6px;text-align:center;">
                <a href="${escapeHtml(tenderUrl)}" style="display:inline-block;padding:12px 18px;font-family:Arial,sans-serif;font-size:14px;line-height:1.2;font-weight:700;color:#ffffff;text-decoration:none;">View Opportunity</a>
              </td>
            </tr>
          </table>

          <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:#64748b;">
            Source: <a href="${escapeHtml(sourceUrl)}" style="color:#18314a;text-decoration:underline;">View opportunities on eTenders</a>
          </p>
        </td>
      </tr>
    </table>
  `
}

function buildSubscriberDigestEmail({ subscriber, sourceRun, tenders }) {
  const sectorLabel = getSectorLabel(subscriber.sector)
  const digestDate = formatDigestDate(sourceRun?.startedAt)
  const unsubscribeUrl = buildUnsubscribeUrl(subscriber)
  const preferencesUrl = buildManagePreferencesUrl()
  const logoUrl = buildLogoUrl()
  const matchCountLabel = `${tenders.length} New Tender Match${tenders.length === 1 ? '' : 'es'} Found`
  const badgeLabel = `${sectorLabel} Sector Digest`
  const tenderCards = tenders
    .map(tender => renderSubscriberDigestTenderCard(tender, sectorLabel))
    .join('')

  const textTenderRows = tenders.map(tender => {
    const tenderUrl = buildTenderEmailUrl(tender)
    const sourceUrl = buildSourceDigestUrl(tender)

    return [
      `- ${tender.title}`,
      `  Reference Number: ${tender.reference || 'N/A'}`,
      `  Municipality / Entity: ${tender.entity || 'Not listed'}`,
      `  Category: ${tender.category || sectorLabel}`,
      `  Closing Date: ${formatTenderDate(tender.deadline)}`,
      tenderUrl ? `  Link: ${tenderUrl}` : null,
      `  Source: View opportunities on eTenders - ${sourceUrl}`,
    ].filter(Boolean).join('\n')
  })

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="x-apple-disable-message-reformatting">
        <title>Your ${escapeHtml(sectorLabel)} tender digest</title>
      </head>
      <body style="margin:0;padding:0;background:#f7f5ef;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">
          ${escapeHtml(matchCountLabel)} for your ${escapeHtml(sectorLabel.toLowerCase())} subscription.
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f5ef" style="width:100%;border-collapse:collapse;background:#f7f5ef;">
          <tr>
            <td align="center" style="padding:32px 12px;">
              <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e6dfd0;border-radius:8px;overflow:hidden;">
                <tr>
                  <td bgcolor="#ffffff" style="padding:24px 28px 22px;background:#ffffff;border-bottom:1px solid #e6dfd0;font-family:Arial,sans-serif;color:#162132;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
                      <tr>
                        <td valign="middle" style="padding:0;">
                          <img src="${escapeHtml(logoUrl)}" width="132" alt="Bid360" border="0" style="display:block;width:132px;max-width:132px;height:auto;border:0;outline:none;text-decoration:none;">
                        </td>
                        <td valign="middle" align="right" style="padding:0;">
                          <span style="display:inline-block;padding:7px 10px;border:1px solid #d9c69f;border-radius:999px;background:#f7f1e4;font-size:12px;line-height:1.2;font-weight:700;color:#18314a;text-transform:uppercase;">${escapeHtml(badgeLabel)}</span>
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin:24px 0 0;font-family:Arial,sans-serif;font-size:28px;line-height:1.25;font-weight:700;color:#18314a;">Your ${escapeHtml(sectorLabel)} tender digest</h1>
                    <p style="margin:10px 0 0;font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#475569;">Curated public-sector opportunities matched to your Bid360 subscription.</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:28px 28px 8px;font-family:Arial,sans-serif;color:#162132;">
                    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#162132;">Hello ${escapeHtml(subscriber.entityName)},</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f1ec" style="width:100%;border-collapse:separate;border-spacing:0;background:#f3f1ec;border:1px solid #e6dfd0;border-radius:8px;">
                      <tr>
                        <td style="padding:18px 20px;font-family:Arial,sans-serif;">
                          <p style="margin:0;font-size:20px;line-height:1.25;font-weight:700;color:#18314a;">${escapeHtml(matchCountLabel)}</p>
                          <p style="margin:6px 0 0;font-size:13px;line-height:1.6;color:#475569;">Fresh matches from ${escapeHtml(SOURCE_NAME)} for your ${escapeHtml(sectorLabel.toLowerCase())} sector profile.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:16px 28px 24px;">
                    ${tenderCards}
                    <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:1.7;color:#64748b;">Digest date: ${escapeHtml(digestDate)}</p>
                  </td>
                </tr>

                <tr>
                  <td bgcolor="#faf8f5" style="padding:22px 28px;background:#faf8f5;border-top:1px solid #e6dfd0;font-family:Arial,sans-serif;">
                    <p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#475569;">Bid360 helps South African teams discover and track tender opportunities matched to their sector.</p>
                    <p style="margin:0;font-size:12px;line-height:1.7;color:#64748b;">
                      <a href="${escapeHtml(preferencesUrl)}" style="color:#18314a;text-decoration:underline;">User Preferences</a>
                      ${unsubscribeUrl ? `&nbsp;&nbsp;|&nbsp;&nbsp;<a href="${escapeHtml(unsubscribeUrl)}" style="color:#18314a;text-decoration:underline;">Unsubscribe</a>` : ''}
                    </p>
                    <p style="margin:12px 0 0;font-size:12px;line-height:1.7;color:#94a3b8;">Copyright ${new Date().getFullYear()} Bid360. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `

  const text = [
    `Your ${sectorLabel} tender digest`,
    '',
    `Hello ${subscriber.entityName},`,
    '',
    `${matchCountLabel} from ${SOURCE_NAME}.`,
    '',
    ...textTenderRows,
    '',
    `Digest date: ${digestDate}`,
    `User Preferences: ${preferencesUrl}`,
    unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : null,
    '',
    `Copyright ${new Date().getFullYear()} Bid360. All rights reserved.`,
  ].filter(Boolean).join('\n')

  return {
    subject: `Your ${sectorLabel} tender digest \u2014 ${digestDate}`,
    html,
    text,
  }
}

async function sendSubscriberDigestEmail({ subscriber, sourceRun, tenders }) {
  const email = buildSubscriberDigestEmail({ subscriber, sourceRun, tenders })

  return sendEmail({
    to: subscriber.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
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

  const stageGate = applyDigestStageGate({ subscriberMatchMap, results })

  if (!stageGate.summary.skipped && stageGate.summary.reviewedTenderMatches > 0) {
    crawlerLogger.crawler({
      level: stageGate.summary.removedTenderMatches > 0 ? 'warn' : 'info',
      phase: 'notification',
      runId: sourceRun?.id || null,
      message: 'crawler_subscriber_digest_stage_gate_completed',
      data: {
        sourceRunId: sourceRun?.id || null,
        ...stageGate.summary,
      },
    })
  }

  for (const droppedGroup of stageGate.droppedGroups) {
    crawlerLogger.crawler({
      level: 'warn',
      phase: 'notification',
      runId: sourceRun?.id || null,
      message: 'crawler_subscriber_digest_email_send_decision',
      data: {
        sourceRunId: sourceRun?.id || null,
        subscriberId: droppedGroup.subscriber.id,
        email: droppedGroup.subscriber.email,
        entityName: droppedGroup.subscriber.entityName,
        sector: droppedGroup.subscriber.sector,
        tendersCount: 0,
        reviewedTenderMatches: droppedGroup.reviewedTenderMatches,
        removedTenderMatches: droppedGroup.removedTenderMatches,
        removalReasons: droppedGroup.removalReasons,
        skipStage: 'subscriber_digest_stage_gate',
        skipReason: 'no_verified_digest_tenders',
        sendSkipped: true,
      },
    })
  }

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
      runId: sourceRun?.id || null,
      message: 'crawler_subscriber_digest_email_send_decision',
      data: {
        sourceRunId: sourceRun?.id || null,
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
