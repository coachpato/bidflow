const mockPrisma = {
  subscriber: {
    findMany: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}))

const { matchSubscribersToTender } = require('./subscriber-matcher')

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

  it('applies subscriber keyword filters when populated', async () => {
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

    expect(subscribers).toHaveLength(1)
    expect(subscribers[0].id).toBe('sub_solar')
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
