import { logActivity } from '@/lib/activity'
import { dashboardCacheTag, expireCacheTags } from '@/lib/cache-tags'
import {
  buildManualMatchData,
  buildOpportunityDedupeKey,
} from '@/lib/opportunity-radar'
import { getSessionOrganizationId } from '@/lib/organization'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

const MOCK_FEED_BY_SECTOR = {
  BUILT_ENVIRONMENT: [
    {
      title: 'Professional team for municipal roads rehabilitation programme',
      entity: 'City Infrastructure Directorate',
      practiceArea: 'Civil Engineering',
      summary: 'Framework panel for road rehabilitation design, supervision, and contract administration.',
      estimatedValue: 18500000,
      deadlineOffsetDays: 9,
      fitScore: 86,
    },
    {
      title: 'Quantity surveying support for social housing rollout',
      entity: 'Provincial Human Settlements Agency',
      practiceArea: 'Quantity Surveying',
      summary: 'Cost management and procurement support for a phased housing development programme.',
      estimatedValue: 6200000,
      deadlineOffsetDays: 14,
      fitScore: 79,
    },
  ],
  LEGAL_SERVICES: [
    {
      title: 'Panel for procurement review, bid protest, and regulatory advisory support',
      entity: 'State Procurement Office',
      practiceArea: 'Administrative Law',
      summary: 'Multi-year legal services panel covering bid disputes, regulatory advice, and compliance reviews.',
      estimatedValue: 5400000,
      deadlineOffsetDays: 7,
      fitScore: 88,
    },
    {
      title: 'External legal counsel for public-private partnership transactions',
      entity: 'Metropolitan Treasury Unit',
      practiceArea: 'Commercial Law',
      summary: 'Transaction advisory and legal drafting support for PPP structuring and procurement.',
      estimatedValue: 9700000,
      deadlineOffsetDays: 16,
      fitScore: 81,
    },
  ],
  FINANCIAL_SERVICES: [
    {
      title: 'Project finance advisory for district wastewater expansion',
      entity: 'Regional Water Board',
      practiceArea: 'Project Finance',
      summary: 'Financial modelling, lender packaging, and treasury support for a blended-finance capital project.',
      estimatedValue: 12400000,
      deadlineOffsetDays: 12,
      fitScore: 90,
    },
    {
      title: 'Independent transaction advisor for transport concession programme',
      entity: 'Provincial Transport Authority',
      practiceArea: 'Transaction Advisory',
      summary: 'Commercial due diligence, affordability testing, and bid evaluation support.',
      estimatedValue: 8500000,
      deadlineOffsetDays: 10,
      fitScore: 84,
    },
  ],
  GREEN_ENERGY: [
    {
      title: 'Owner engineer services for embedded solar and battery rollout',
      entity: 'Industrial Development Campus',
      practiceArea: 'Renewable Energy Advisory',
      summary: 'Technical advisory, grid integration, and contractor management for a phased solar deployment.',
      estimatedValue: 15800000,
      deadlineOffsetDays: 11,
      fitScore: 92,
    },
    {
      title: 'Feasibility and commercial structuring for municipal waste-to-energy plant',
      entity: 'Municipal Green Infrastructure Office',
      practiceArea: 'Energy Infrastructure',
      summary: 'End-to-end feasibility, procurement support, and investor packaging for green energy delivery.',
      estimatedValue: 13200000,
      deadlineOffsetDays: 18,
      fitScore: 87,
    },
  ],
}

function addDays(value, days) {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date
}

function buildMockOpportunities(serviceSectors) {
  return serviceSectors.flatMap(sector => {
    const templates = MOCK_FEED_BY_SECTOR[sector] || []

    return templates.map((template, index) => ({
      ...template,
      reference: `MOCK-${sector.slice(0, 4)}-${index + 1}`,
      sourceName: 'Mock Radar Feed',
      sourceUrl: 'https://bid360.local/mock-radar',
      deadline: addDays(new Date(), template.deadlineOffsetDays),
      parsedRequirements: [
        'Complete the pricing schedule.',
        'Submit proof of experience.',
        'Confirm assigned owner and submission deadline.',
      ],
      parsedAppointments: [
        {
          type: 'deadline',
          title: 'Submission deadline',
          label: 'Submission deadline',
          date: addDays(new Date(), template.deadlineOffsetDays).toISOString(),
        },
      ],
    }))
  })
}

export async function POST() {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)

  // Allow admin users or the first user in the organization to load mock feed
  if (organizationId) {
    const userCount = await prisma.user.count({
      where: {
        organizationRoles: {
          some: {
            organizationId,
          },
        },
      },
    })
    if (userCount > 1 && session.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 })
    }
  } else if (session.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 })
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      firmProfile: {
        select: {
          serviceSector: true,
          serviceSectors: true,
        },
      },
    },
  })

  const serviceSectors = organization?.firmProfile?.serviceSectors?.length
    ? organization.firmProfile.serviceSectors
    : organization?.firmProfile?.serviceSector
      ? [organization.firmProfile.serviceSector]
      : ['BUILT_ENVIRONMENT', 'LEGAL_SERVICES', 'FINANCIAL_SERVICES', 'GREEN_ENERGY']

  const source = await prisma.source.upsert({
    where: { key: 'mock-radar-feed' },
    update: { name: 'Mock Radar Feed' },
    create: {
      key: 'mock-radar-feed',
      name: 'Mock Radar Feed',
      type: 'mock',
      baseUrl: 'https://bid360.local/mock-radar',
    },
  })

  const mockOpportunities = buildMockOpportunities(serviceSectors)
  let createdCount = 0
  let existingCount = 0

  for (const entry of mockOpportunities) {
    const dedupeKey = buildOpportunityDedupeKey({
      organizationId,
      sourceKey: source.key,
      externalId: entry.reference,
      title: entry.title,
      entity: entry.entity,
      deadline: entry.deadline,
    })

    const existing = await prisma.opportunity.findUnique({
      where: {
        organizationId_dedupeKey: {
          organizationId,
          dedupeKey,
        },
      },
      select: { id: true },
    })

    if (existing) {
      existingCount += 1
      continue
    }

    const manualMatch = buildManualMatchData({
      title: entry.title,
      entity: entry.entity,
      practiceArea: entry.practiceArea,
      fitScore: entry.fitScore,
      serviceSector: serviceSectors[0],
    })

    await prisma.opportunity.create({
      data: {
        organizationId,
        title: entry.title,
        reference: entry.reference,
        externalId: entry.reference,
        dedupeKey,
        entity: entry.entity,
        sourceName: entry.sourceName,
        sourceUrl: entry.sourceUrl,
        practiceArea: entry.practiceArea,
        summary: entry.summary,
        estimatedValue: entry.estimatedValue,
        deadline: entry.deadline,
        fitScore: entry.fitScore,
        status: 'New',
        parsedRequirements: entry.parsedRequirements,
        parsedAppointments: entry.parsedAppointments,
        userId: session.userId,
        sourceId: source.id,
        matches: {
          create: {
            organizationId,
            verdict: manualMatch.verdict,
            fitScore: entry.fitScore,
            matchedKeywords: manualMatch.matchedKeywords,
            matchReasons: manualMatch.matchReasons,
          },
        },
      },
    })

    createdCount += 1
  }

  await logActivity(`Loaded mock opportunity feed (${createdCount} created, ${existingCount} already present).`, {
    userId: session.userId,
  })
  await expireCacheTags(dashboardCacheTag(organizationId))

  return Response.json({
    success: true,
    createdCount,
    existingCount,
  })
}
