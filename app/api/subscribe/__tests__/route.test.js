const mockPrisma = {
  subscriber: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}))

const { POST } = require('../route')

function createSubscribeRequest(payload) {
  return new Request('http://localhost/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

describe('POST /api/subscribe', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a subscriber for valid registration data', async () => {
    mockPrisma.subscriber.findUnique.mockResolvedValue(null)
    mockPrisma.subscriber.create.mockResolvedValue({
      id: 'subscriber_1',
      email: 'owner@example.com',
      entityName: 'Acme Projects',
      sector: 'construction',
      keywords: 'roads',
      location: 'Gauteng',
      subscribed: true,
    })

    const response = await POST(createSubscribeRequest({
      email: 'Owner@Example.com ',
      entityName: ' Acme Projects ',
      sector: 'construction',
      keywords: ' roads ',
      location: ' Gauteng ',
    }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      updated: false,
      subscriber: {
        email: 'owner@example.com',
        entityName: 'Acme Projects',
        sector: 'construction',
      },
    })
    expect(mockPrisma.subscriber.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'owner@example.com',
        entityName: 'Acme Projects',
        sector: 'construction',
        keywords: 'roads',
        location: 'Gauteng',
        subscribed: true,
      }),
    }))
  })

  it('updates an existing email and sector subscription instead of creating a duplicate', async () => {
    mockPrisma.subscriber.findUnique.mockResolvedValue({ id: 'subscriber_1' })
    mockPrisma.subscriber.update.mockResolvedValue({
      id: 'subscriber_1',
      email: 'owner@example.com',
      entityName: 'Acme Solar',
      sector: 'energy',
      keywords: 'solar panels',
      location: null,
      subscribed: true,
    })

    const response = await POST(createSubscribeRequest({
      email: 'owner@example.com',
      entityName: 'Acme Solar',
      sector: 'energy',
      keywords: 'solar panels',
      location: '',
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      updated: true,
      subscriber: {
        sector: 'energy',
        keywords: 'solar panels',
      },
    })
    expect(mockPrisma.subscriber.create).not.toHaveBeenCalled()
    expect(mockPrisma.subscriber.update).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        email_sector: {
          email: 'owner@example.com',
          sector: 'energy',
        },
      },
      data: expect.objectContaining({
        entityName: 'Acme Solar',
        subscribed: true,
      }),
    }))
  })

  it('returns a validation error for an invalid sector', async () => {
    const response = await POST(createSubscribeRequest({
      email: 'owner@example.com',
      entityName: 'Acme Projects',
      sector: 'not-a-sector',
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      errors: {
        sector: 'Choose a valid sector.',
      },
    })
    expect(mockPrisma.subscriber.findUnique).not.toHaveBeenCalled()
  })

  it('returns a validation error for an invalid email', async () => {
    const response = await POST(createSubscribeRequest({
      email: 'not-an-email',
      entityName: 'Acme Projects',
      sector: 'construction',
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      errors: {
        email: 'Enter a valid email address.',
      },
    })
    expect(mockPrisma.subscriber.findUnique).not.toHaveBeenCalled()
  })
})
