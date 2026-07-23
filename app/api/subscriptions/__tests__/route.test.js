const mockPrisma = {
  subscriber: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}))

const { DELETE, GET, PATCH } = require('../route')

function jsonRequest(method, payload) {
  return new Request('http://localhost/api/subscriptions', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

describe('/api/subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lists subscriptions for a normalized email address', async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([
      {
        id: 'subscriber_1',
        email: 'owner@example.com',
        entityName: 'Acme Projects',
        sector: 'construction',
        keywords: null,
        location: null,
        subscribed: true,
      },
    ])

    const response = await GET(new Request('http://localhost/api/subscriptions?email=Owner%40Example.com'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      subscriptions: [
        {
          email: 'owner@example.com',
          sector: 'construction',
        },
      ],
    })
    expect(mockPrisma.subscriber.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'owner@example.com' },
    }))
  })

  it('updates keywords and location for an email and sector', async () => {
    mockPrisma.subscriber.findUnique.mockResolvedValue({ id: 'subscriber_1' })
    mockPrisma.subscriber.update.mockResolvedValue({
      id: 'subscriber_1',
      email: 'owner@example.com',
      sector: 'energy',
      keywords: 'solar',
      location: 'Western Cape',
    })

    const response = await PATCH(jsonRequest('PATCH', {
      email: 'owner@example.com',
      sector: 'energy',
      keywords: ' solar ',
      location: ' Western Cape ',
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      subscription: {
        sector: 'energy',
        keywords: 'solar',
        location: 'Western Cape',
      },
    })
    expect(mockPrisma.subscriber.update).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        keywords: 'solar',
        location: 'Western Cape',
      },
    }))
  })

  it('sets a sector subscription to unsubscribed by email and sector', async () => {
    mockPrisma.subscriber.findUnique.mockResolvedValue({ id: 'subscriber_1' })
    mockPrisma.subscriber.update.mockResolvedValue({
      id: 'subscriber_1',
      email: 'owner@example.com',
      sector: 'legal',
      subscribed: false,
    })

    const response = await DELETE(jsonRequest('DELETE', {
      email: 'owner@example.com',
      sector: 'legal',
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      subscription: {
        sector: 'legal',
        subscribed: false,
      },
    })
    expect(mockPrisma.subscriber.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { subscribed: false },
    }))
  })
})
