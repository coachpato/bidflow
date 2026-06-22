import { buildDigestDeliveryVisibility } from './digest-notifications'

describe('crawler digest delivery visibility', () => {
  const originalRecipients = process.env.CRAWLER_EMAIL_RECIPIENTS

  afterEach(() => {
    if (originalRecipients === undefined) {
      delete process.env.CRAWLER_EMAIL_RECIPIENTS
    } else {
      process.env.CRAWLER_EMAIL_RECIPIENTS = originalRecipients
    }
  })

  it('counts queried users and diagnostic filters without changing recipient logic', async () => {
    process.env.CRAWLER_EMAIL_RECIPIENTS = ''

    const db = {
      membership: {
        findMany: jest.fn(async () => [
          {
            organizationId: 21,
            user: { id: 1, email: 'verified@example.com', emailVerified: new Date('2026-06-01T00:00:00.000Z') },
          },
          {
            organizationId: 21,
            user: { id: 2, email: 'unverified@example.com', emailVerified: null },
          },
          {
            organizationId: 21,
            user: { id: 3, email: '', emailVerified: new Date('2026-06-01T00:00:00.000Z') },
          },
        ]),
      },
    }

    const visibility = await buildDigestDeliveryVisibility({
      db,
      sourceRun: { id: 43 },
      organizations: [
        {
          id: 21,
          name: 'Another Test Legal',
          firmProfile: { primaryContactEmail: null },
        },
      ],
      results: {
        matchedCount: 116,
        newOpportunitiesCreated: 1,
        opportunitiesByOrganization: {
          21: {
            organizationId: 21,
            organizationName: 'Another Test Legal',
            opportunities: [{ id: 3525, title: 'Security services' }],
          },
        },
      },
    })

    expect(db.membership.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: { in: [21] } },
    }))
    expect(visibility.usersQueried).toBe(3)
    expect(visibility.usersAfterFiltering).toBe(1)
    expect(visibility.userFilters).toMatchObject({
      missingEmailFiltered: 1,
      unverifiedEmailFiltered: 1,
      unsubscribedFiltered: 0,
      inactiveFiltered: 0,
      unsubscribeFilterAvailable: false,
      inactiveFilterAvailable: false,
    })
    expect(visibility.sendLogicUsesUserQuery).toBe(false)
    expect(visibility.groups[0]).toMatchObject({
      usersQueried: 3,
      usersAfterFiltering: 1,
      sendSkipped: true,
      skipStage: 'sendDailyDigestEmail',
      skipReason: 'no_digest_recipients',
      exactCondition: 'recipients.length === 0 || opportunities.length === 0 (recipients.length === 0)',
    })
  })

  it('marks a digest group as sendable when opportunities and recipients are present', async () => {
    process.env.CRAWLER_EMAIL_RECIPIENTS = 'admin@example.com'

    const visibility = await buildDigestDeliveryVisibility({
      db: {
        membership: {
          findMany: jest.fn(async () => []),
        },
      },
      sourceRun: { id: 44 },
      organizations: [
        {
          id: 21,
          name: 'Another Test Legal',
          firmProfile: { primaryContactEmail: 'client@example.com' },
        },
      ],
      results: {
        matchedCount: 1,
        newOpportunitiesCreated: 1,
        opportunitiesByOrganization: {
          21: {
            organizationId: 21,
            organizationName: 'Another Test Legal',
            opportunities: [{ id: 1, title: 'New opportunity' }],
          },
        },
      },
    })

    expect(visibility.sendAttemptsExpected).toBe(1)
    expect(visibility.skipReasons).toEqual({})
    expect(visibility.groups[0]).toMatchObject({
      sendSkipped: false,
      exactCondition: 'recipients.length > 0 && opportunities.length > 0',
      recipientResolution: {
        recipientsAfterFiltering: 2,
        primaryContactEmailPresent: true,
        envRecipientCandidates: 1,
      },
    })
  })
})
