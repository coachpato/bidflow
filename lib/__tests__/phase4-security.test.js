import { proxy } from '../../proxy'
import { getUploadValidationError } from '../file-upload'
import { shouldDryRunEmail } from '../email'
import { escapeHtml } from '../email-verification'
import { resolveEtendersUrl } from '../crawler/etenders-crawler'

function proxyRequest(url, { method = 'GET', headers = {}, cookie = null } = {}) {
  const request = new Request(url, { method, headers })
  request.nextUrl = new URL(url)
  request.cookies = {
    get: jest.fn(name => (name === 'bidflow_session' && cookie ? { name, value: cookie } : undefined)),
  }
  return request
}

function jsonRequest(url, body, headers = {}) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

function makeFile({ name, type, size }) {
  return {
    name,
    type,
    size,
    arrayBuffer: jest.fn(),
  }
}

describe('Phase 4 route-level security coverage', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' }
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('returns JSON 401 for unauthenticated API requests instead of redirecting', async () => {
    const response = proxy(proxyRequest('http://localhost/api/tenders'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('redirects removed dashboard pages to the landing page', () => {
    const response = proxy(proxyRequest('http://localhost/dashboard'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('rejects unsafe API requests without the CSRF header', async () => {
    const response = proxy(proxyRequest('http://localhost/api/tenders', { method: 'POST' }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
  })

  it('allows unsafe API requests with a CSRF header to continue to auth checks', async () => {
    const response = proxy(proxyRequest('http://localhost/api/tenders', {
      method: 'POST',
      headers: { 'x-requested-with': 'XMLHttpRequest' },
    }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('scopes tender list reads to the session organization', async () => {
    const getCachedTenderList = jest.fn().mockResolvedValue([
      { id: 1, organizationId: 10, title: 'Org A tender' },
    ])

    jest.doMock('@/lib/session', () => ({
      getSession: jest.fn().mockResolvedValue({ userId: 1, role: 'admin', organizationId: 10 }),
    }))
    jest.doMock('@/lib/organization', () => ({
      getSessionOrganizationId: jest.fn(() => 10),
    }))
    jest.doMock('@/lib/tender-read-model', () => ({ getCachedTenderList }))
    jest.doMock('@/lib/prisma', () => ({ __esModule: true, default: {} }))
    jest.doMock('@/lib/activity', () => ({ logActivity: jest.fn() }))
    jest.doMock('@/lib/cache-tags', () => ({
      dashboardCacheTag: jest.fn(),
      expireCacheTags: jest.fn(),
      tendersListCacheTag: jest.fn(),
    }))
    jest.doMock('@/lib/tender-assignment', () => ({
      findAssignedUser: jest.fn(),
      notifyTenderAssignees: jest.fn(),
    }))
    jest.doMock('@/lib/tender-defaults', () => ({ buildTenderChecklistItems: jest.fn(() => []) }))

    const { GET } = await import('@/app/api/tenders/route')
    const response = await GET(new Request('http://localhost/api/tenders?status=active'))

    expect(response.status).toBe(200)
    expect(getCachedTenderList).toHaveBeenCalledWith({
      organizationId: 10,
      status: 'active',
      search: null,
    })
    await expect(response.json()).resolves.toEqual([
      { id: 1, organizationId: 10, title: 'Org A tender' },
    ])
  })

  it('returns 404 when patching a tender outside the session organization', async () => {
    jest.doMock('@/lib/session', () => ({
      getSession: jest.fn().mockResolvedValue({ userId: 1, role: 'admin', organizationId: 10 }),
    }))
    jest.doMock('@/lib/organization', () => ({
      getSessionOrganizationId: jest.fn(() => 10),
    }))
    jest.doMock('@/lib/tenders', () => ({
      findTenderForOrganization: jest.fn().mockResolvedValue(null),
      parseRecordId: jest.fn(value => Number.parseInt(value, 10)),
    }))
    jest.doMock('@/lib/prisma', () => ({ __esModule: true, default: {} }))
    jest.doMock('@/lib/activity', () => ({ logActivity: jest.fn() }))
    jest.doMock('@/lib/status-changes', () => ({ recordTenderStatusChange: jest.fn() }))
    jest.doMock('@/lib/tender-assignment', () => ({
      findAssignedUser: jest.fn(),
      notifyTenderAssignees: jest.fn(),
    }))
    jest.doMock('@/lib/cache-tags', () => ({
      dashboardCacheTag: jest.fn(),
      expireCacheTags: jest.fn(),
      tenderDetailCacheTag: jest.fn(),
      tenderPackCacheTag: jest.fn(),
      tendersListCacheTag: jest.fn(),
    }))
    jest.doMock('@/lib/tender-read-model', () => ({ getCachedTenderDetail: jest.fn() }))
    jest.doMock('@/lib/supabase', () => ({ addSignedDocumentUrlsToList: jest.fn() }))
    jest.doMock('@/lib/webhooks', () => ({
      buildTenderStatusChangePayload: jest.fn(),
      queueWebhook: jest.fn(),
      WEBHOOK_EVENTS: {},
    }))

    const { PATCH } = await import('@/app/api/tenders/[id]/route')
    const response = await PATCH(jsonRequest('http://localhost/api/tenders/22', { status: 'Submitted' }), {
      params: Promise.resolve({ id: '22' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Tender not found' })
  })

  it('returns 403 when staff attempts a manager tender status transition', async () => {
    jest.doMock('@/lib/session', () => ({
      getSession: jest.fn().mockResolvedValue({ userId: 1, role: 'staff', organizationId: 10 }),
    }))
    jest.doMock('@/lib/organization', () => ({
      getSessionOrganizationId: jest.fn(() => 10),
    }))
    jest.doMock('@/lib/tenders', () => ({
      findTenderForOrganization: jest.fn().mockResolvedValue({
        id: 22,
        title: 'Restricted tender',
        status: 'New',
        assignedTo: null,
        assignedUserId: null,
      }),
      parseRecordId: jest.fn(value => Number.parseInt(value, 10)),
    }))
    jest.doMock('@/lib/prisma', () => ({ __esModule: true, default: {} }))
    jest.doMock('@/lib/activity', () => ({ logActivity: jest.fn() }))
    jest.doMock('@/lib/status-changes', () => ({ recordTenderStatusChange: jest.fn() }))
    jest.doMock('@/lib/tender-assignment', () => ({
      findAssignedUser: jest.fn(),
      notifyTenderAssignees: jest.fn(),
    }))
    jest.doMock('@/lib/cache-tags', () => ({
      dashboardCacheTag: jest.fn(),
      expireCacheTags: jest.fn(),
      tenderDetailCacheTag: jest.fn(),
      tenderPackCacheTag: jest.fn(),
      tendersListCacheTag: jest.fn(),
    }))
    jest.doMock('@/lib/tender-read-model', () => ({ getCachedTenderDetail: jest.fn() }))
    jest.doMock('@/lib/supabase', () => ({ addSignedDocumentUrlsToList: jest.fn() }))
    jest.doMock('@/lib/webhooks', () => ({
      buildTenderStatusChangePayload: jest.fn(),
      queueWebhook: jest.fn(),
      WEBHOOK_EVENTS: {},
    }))

    const { PATCH } = await import('@/app/api/tenders/[id]/route')
    const response = await PATCH(jsonRequest('http://localhost/api/tenders/22', { status: 'Submitted' }), {
      params: Promise.resolve({ id: '22' }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'INSUFFICIENT_ROLE' })
  })

  it('returns 403 when staff attempts to delete a contract', async () => {
    jest.doMock('@/lib/session', () => ({
      getSession: jest.fn().mockResolvedValue({ userId: 1, role: 'staff', organizationId: 10 }),
    }))
    jest.doMock('@/lib/organization', () => ({
      getSessionOrganizationId: jest.fn(() => 10),
    }))
    jest.doMock('@/lib/prisma', () => ({ __esModule: true, default: {} }))
    jest.doMock('@/lib/activity', () => ({ logActivity: jest.fn() }))
    jest.doMock('@/lib/status-changes', () => ({ recordContractStatusChange: jest.fn() }))
    jest.doMock('@/lib/cache-tags', () => ({
      dashboardCacheTag: jest.fn(),
      expireCacheTags: jest.fn(),
    }))
    jest.doMock('@/lib/contract-notifications', () => ({ notifyContractAssignees: jest.fn() }))
    jest.doMock('@/lib/tender-assignment', () => ({ findAssignedUser: jest.fn() }))
    jest.doMock('@/lib/supabase', () => ({ addSignedDocumentUrlsToList: jest.fn() }))
    jest.doMock('@/lib/webhooks', () => ({
      buildContractStatusChangePayload: jest.fn(),
      queueWebhook: jest.fn(),
    }))

    const { DELETE } = await import('@/app/api/contracts/[id]/route')
    const response = await DELETE(new Request('http://localhost/api/contracts/5', { method: 'DELETE' }), {
      params: Promise.resolve({ id: '5' }),
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Admin only' })
  })

  it('rejects oversized uploads before reading file bytes', () => {
    const file = makeFile({
      name: 'evidence.pdf',
      type: 'application/pdf',
      size: 15 * 1024 * 1024,
    })

    expect(getUploadValidationError(file)).toContain('too large')
    expect(file.arrayBuffer).not.toHaveBeenCalled()
  })

  it('rejects mismatched executable uploads before reading file bytes', () => {
    const file = makeFile({
      name: 'payload.pdf',
      type: 'application/x-msdownload',
      size: 1024,
    })

    expect(getUploadValidationError(file)).toBe('Unsupported file type.')
    expect(file.arrayBuffer).not.toHaveBeenCalled()
  })

  it('rate limits the login route on the sixth attempt from one IP', async () => {
    jest.doMock('@/lib/prisma', () => ({
      __esModule: true,
      default: {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      },
    }))
    jest.doMock('@/lib/session', () => ({ getSession: jest.fn() }))
    jest.doMock('@/lib/organization', () => ({
      applyOrganizationToSession: jest.fn(),
      ensureOrganizationContextForUser: jest.fn(),
    }))

    const rateLimit = await import('@/lib/rate-limit')
    rateLimit.resetRateLimitsForTest()
    const { POST } = await import('@/app/api/auth/login/route')

    const responses = []
    for (let index = 0; index < 6; index += 1) {
      responses.push(await POST(jsonRequest('http://localhost/api/auth/login', {
        email: 'person@example.com',
        password: 'wrong-password',
      }, {
        'x-forwarded-for': '203.0.113.20',
      })))
    }

    expect(responses.slice(0, 5).map(response => response.status)).toEqual([404, 404, 404, 404, 404])
    expect(responses[5].status).toBe(429)
    await expect(responses[5].json()).resolves.toEqual({ error: 'Too many attempts. Try again later.' })
  })

  it('enforces cron bearer auth', async () => {
    const { isAuthorizedCron } = await import('@/app/api/crawler/route')
    process.env.CRON_SECRET = 'correct-secret'

    expect(isAuthorizedCron(new Request('http://localhost/api/crawler', {
      headers: { authorization: 'Bearer wrong' },
    }))).toBe(false)
    expect(isAuthorizedCron(new Request('http://localhost/api/crawler', {
      headers: { authorization: 'Bearer correct-secret' },
    }))).toBe(true)
  })

  it('keeps non-production email delivery in dry-run unless explicitly enabled', () => {
    process.env.NODE_ENV = 'test'
    delete process.env.EMAIL_DEV_DELIVER
    expect(shouldDryRunEmail()).toBe(true)

    process.env.EMAIL_DEV_DELIVER = 'true'
    expect(shouldDryRunEmail()).toBe(false)
  })

  it('escapes verification email user content', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('blocks non-eTenders and private PDF URLs', () => {
    expect(resolveEtendersUrl('https://evil.example/file.pdf')).toMatchObject({
      ok: false,
      reason: 'host-not-allowed',
    })
    expect(resolveEtendersUrl('http://127.0.0.1/file.pdf')).toMatchObject({
      ok: false,
      reason: 'private-ipv4-host',
    })
    expect(resolveEtendersUrl('https://www.etenders.gov.za/file.pdf')).toMatchObject({
      ok: true,
      url: 'https://www.etenders.gov.za/file.pdf',
    })
  })
})
