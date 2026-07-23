const mockPrisma = {
  subscriber: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}))

const { GET } = require('../route')

describe('GET /api/unsubscribe', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('requires an unsubscribe token', async () => {
    const response = await GET(new Request('http://localhost/api/unsubscribe'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Unsubscribe token is required.' })
  })

  it('returns 404 when the token does not match a subscriber', async () => {
    mockPrisma.subscriber.findUnique.mockResolvedValue(null)

    const response = await GET(new Request('http://localhost/api/unsubscribe?token=missing'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Subscription not found.' })
    expect(mockPrisma.subscriber.update).not.toHaveBeenCalled()
  })

  it('sets subscribed to false and redirects to the manage page', async () => {
    mockPrisma.subscriber.findUnique.mockResolvedValue({ id: 'subscriber_1' })
    mockPrisma.subscriber.update.mockResolvedValue({ id: 'subscriber_1' })

    const response = await GET(new Request('http://localhost/api/unsubscribe?token=token_123'))

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('http://localhost/manage?unsubscribed=1')
    expect(mockPrisma.subscriber.update).toHaveBeenCalledWith({
      where: { unsubscribeToken: 'token_123' },
      data: { subscribed: false },
      select: { id: true },
    })
  })
})
