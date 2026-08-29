const mockGetCachedPublicTender = jest.fn()

jest.mock('@/lib/public-tender-read-model', () => ({
  getCachedPublicTender: (...args) => mockGetCachedPublicTender(...args),
}))

import TenderPage from './page'

describe('tender page routing', () => {
  beforeEach(() => mockGetCachedPublicTender.mockReset())

  it('uses the normal not-found response for malformed IDs', async () => {
    await expect(TenderPage({ params: Promise.resolve({ id: 'invalid' }) }))
      .rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
    expect(mockGetCachedPublicTender).not.toHaveBeenCalled()
  })

  it('uses the normal not-found response for unknown IDs', async () => {
    mockGetCachedPublicTender.mockResolvedValue(null)

    await expect(TenderPage({ params: Promise.resolve({ id: '999999' }) }))
      .rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
    expect(mockGetCachedPublicTender).toHaveBeenCalledWith(999999)
  })
})
