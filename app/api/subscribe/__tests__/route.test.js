const mockPrisma = {
  subscriber: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
}
const mockSendEmail = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}))

jest.mock('@/lib/email', () => ({
  sendEmail: mockSendEmail,
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
  const originalAdminEmail = process.env.ADMIN_EMAIL

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ADMIN_EMAIL = 'hello@bid360.co.za'
    mockSendEmail.mockResolvedValue({ data: { id: 'email_1' } })
  })

  afterEach(() => {
    process.env.ADMIN_EMAIL = originalAdminEmail
  })

  it('creates a subscriber and sends an admin notification for valid registration data', async () => {
    mockPrisma.subscriber.findUnique.mockResolvedValue(null)
    mockPrisma.subscriber.findMany.mockResolvedValue([
      { email: 'owner@example.com' },
      { email: 'second@example.com' },
    ])
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
    expect(mockPrisma.subscriber.findMany).toHaveBeenCalledWith({
      where: { subscribed: true },
      distinct: ['email'],
      select: { email: true },
    })
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'hello@bid360.co.za',
      subject: 'New bid360 subscriber: Acme Projects \u2014 Construction',
      html: expect.stringContaining('Active unique subscriber emails'),
      text: expect.stringContaining('Active unique subscriber emails: 2'),
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
    expect(mockSendEmail).not.toHaveBeenCalled()
    expect(mockPrisma.subscriber.findMany).not.toHaveBeenCalled()
  })

  it('does not fail registration when the admin notification email fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockPrisma.subscriber.findUnique.mockResolvedValue(null)
    mockPrisma.subscriber.findMany.mockResolvedValue([
      { email: 'owner@example.com' },
    ])
    mockPrisma.subscriber.create.mockResolvedValue({
      id: 'subscriber_1',
      email: 'owner@example.com',
      entityName: 'Acme Projects',
      sector: 'construction',
      keywords: null,
      location: null,
      subscribed: true,
    })
    mockSendEmail.mockRejectedValueOnce(new Error('Resend unavailable'))

    const response = await POST(createSubscribeRequest({
      email: 'owner@example.com',
      entityName: 'Acme Projects',
      sector: 'construction',
    }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      updated: false,
    })
    expect(consoleError).toHaveBeenCalledWith(
      'New subscriber admin notification failed:',
      expect.any(Error)
    )

    consoleError.mockRestore()
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
