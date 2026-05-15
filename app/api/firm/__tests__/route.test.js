const mockResendSend = jest.fn()
const mockResendConstructor = jest.fn(() => ({
  emails: {
    send: mockResendSend,
  },
}))

const mockTransactionClient = {
  organization: {
    update: jest.fn(),
  },
  firmProfile: {
    update: jest.fn(),
  },
}

const mockPrisma = {
  organization: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
}

jest.mock('resend', () => ({
  Resend: mockResendConstructor,
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}))

jest.mock('@/lib/session', () => ({
  getSession: jest.fn(async () => ({
    userId: 7,
    organizationId: 42,
    organizationRole: 'owner',
  })),
}))

jest.mock('@/lib/cache-tags', () => ({
  dashboardCacheTag: jest.fn(organizationId => `dashboard:${organizationId}`),
  organizationCacheTag: jest.fn(organizationId => `organization:${organizationId}`),
  expireCacheTags: jest.fn(),
}))

jest.mock('@/lib/existing-opportunity-matcher', () => ({
  matchExistingOpportunitiesForOrganization: jest.fn(async () => ({ matched: 0 })),
}))

const { PUT } = require('../route')

function createFirmUpdateRequest(payload) {
  return new Request('http://localhost/api/firm', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

describe('PUT /api/firm', () => {
  const originalEmailDeliver = process.env.EMAIL_DEV_DELIVER
  const originalEmailFrom = process.env.EMAIL_FROM
  const originalResendApiKey = process.env.RESEND_API_KEY

  beforeEach(() => {
    jest.clearAllMocks()

    process.env.EMAIL_DEV_DELIVER = 'true'
    process.env.EMAIL_FROM = 'Bid360 Test <test@example.com>'
    process.env.RESEND_API_KEY = 'resend-test-key'

    mockPrisma.organization.findUnique.mockResolvedValue({
      id: 42,
      name: 'Old Firm',
      firmProfile: {
        displayName: 'Old Firm',
        serviceSector: 'LEGAL_SERVICES',
        serviceSectors: ['LEGAL_SERVICES'],
        legalName: null,
        registrationNumber: null,
        primaryContactName: 'Old Contact',
        primaryContactEmail: 'old@example.com',
        primaryContactPhone: null,
        website: null,
        overview: null,
        practiceAreas: ['Litigation and disputes'],
        preferredEntities: [],
        targetWorkTypes: [],
        targetProvinces: [],
        minimumContractValue: null,
        maximumContractValue: null,
      },
    })
    mockTransactionClient.organization.update.mockResolvedValue({
      id: 42,
      name: 'New Firm',
    })
    mockTransactionClient.firmProfile.update.mockResolvedValue({
      organizationId: 42,
      displayName: 'New Firm',
    })
    mockPrisma.$transaction.mockImplementation(async callback => callback(mockTransactionClient))
    mockPrisma.user.findUnique.mockResolvedValue({
      name: 'Workspace Owner',
      email: 'owner@example.com',
    })
    mockResendSend.mockResolvedValue({
      data: { id: 'email_123' },
      error: null,
    })
  })

  afterEach(() => {
    process.env.EMAIL_DEV_DELIVER = originalEmailDeliver
    process.env.EMAIL_FROM = originalEmailFrom
    process.env.RESEND_API_KEY = originalResendApiKey
  })

  it('sends a Resend email when firm profile settings change', async () => {
    const response = await PUT(createFirmUpdateRequest({
      displayName: 'New Firm',
      serviceSector: 'LEGAL_SERVICES',
      serviceSectors: ['LEGAL_SERVICES'],
      practiceAreas: ['Litigation and disputes'],
      preferredEntities: [],
      targetWorkTypes: [],
      targetProvinces: [],
      primaryContactName: 'New Contact',
      primaryContactEmail: 'new@example.com',
    }))

    expect(response.status).toBe(200)
    expect(mockResendConstructor).toHaveBeenCalledWith('resend-test-key')
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Bid360 Test <test@example.com>',
      to: 'owner@example.com',
      subject: 'Bid360 settings changed: New Firm',
      html: expect.stringContaining('Firm display name'),
      text: expect.stringContaining('Firm display name: Old Firm to New Firm'),
    }))
  })
})
