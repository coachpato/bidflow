const mockPrisma = {
  subscriber: {
    findMany: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}))

const { getSubscriberKeywordMatches, matchSubscribersToTender } = require('./subscriber-matcher')

describe('matchSubscribersToTender', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns subscribed users in the matched construction sector', async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([
      {
        id: 'sub_1',
        email: 'builder@example.com',
        entityName: 'Builder Co',
        sector: 'construction',
        keywords: null,
      },
    ])

    const subscribers = await matchSubscribersToTender({
      title: 'Road construction tender',
      description: 'Bridge rehabilitation',
    }, ['construction'])

    expect(mockPrisma.subscriber.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        subscribed: true,
        sector: { in: ['construction'] },
      },
    }))
    expect(subscribers).toHaveLength(1)
    expect(subscribers[0]).toMatchObject({
      id: 'sub_1',
      email: 'builder@example.com',
      sector: 'construction',
    })
  })

  it('prioritizes subscriber keyword matches without excluding sector matches', async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([
      {
        id: 'sub_solar',
        email: 'solar@example.com',
        entityName: 'Solar Co',
        sector: 'energy',
        keywords: 'solar',
      },
      {
        id: 'sub_generator',
        email: 'generator@example.com',
        entityName: 'Generator Co',
        sector: 'energy',
        keywords: 'generator',
      },
    ])

    const subscribers = await matchSubscribersToTender({
      title: 'Solar panel installation',
      description: 'Renewable electricity project',
    }, ['energy'])

    expect(subscribers).toHaveLength(2)
    expect(subscribers[0].id).toBe('sub_solar')
    expect(subscribers[1].id).toBe('sub_generator')
  })

  it('expands legal attorneys keywords to common public-sector legal wording', async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([
      {
        id: 'sub_legal',
        email: 'legal@example.com',
        entityName: 'Legal Co',
        sector: 'legal',
        keywords: 'Attorneys',
      },
    ])

    const subscribers = await matchSubscribersToTender({
      title: 'Appointment of a panel of legal service providers',
      description: 'Interested law firms must provide litigation support.',
      category: 'Legal and accounting activities',
    }, ['legal'])

    expect(subscribers).toHaveLength(1)
    expect(subscribers[0].id).toBe('sub_legal')
  })

  it('keeps a sector subscriber when their custom keyword wording is absent', async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([
      {
        id: 'sub_energy',
        email: 'energy@example.com',
        entityName: 'Energy Co',
        sector: 'energy',
        keywords: 'battery storage',
      },
    ])

    const subscribers = await matchSubscribersToTender({
      title: 'Solar panel installation',
      description: 'Renewable electricity project',
    }, ['energy'])

    expect(subscribers).toHaveLength(1)
    expect(subscribers[0].id).toBe('sub_energy')
  })

  it('reports expanded legal keyword matches for prioritization', () => {
    expect(getSubscriberKeywordMatches({
      sector: 'legal',
      keywords: 'Attorneys',
    }, {
      title: 'Panel of legal service providers',
      description: 'Interested law firms must provide litigation support.',
    })).toEqual(expect.arrayContaining([
      'law firms',
      'legal service providers',
      'litigation',
    ]))
  })

  it('does not query or match subscribers when no sectors matched', async () => {
    const subscribers = await matchSubscribersToTender({
      title: 'General supplies',
    }, [])

    expect(subscribers).toEqual([])
    expect(mockPrisma.subscriber.findMany).not.toHaveBeenCalled()
  })

  it('does not return unsubscribed subscribers because the query filters them out', async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([])

    const subscribers = await matchSubscribersToTender({
      title: 'Road construction tender',
    }, ['construction'])

    expect(subscribers).toEqual([])
    expect(mockPrisma.subscriber.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        subscribed: true,
      }),
    }))
  })
})
