import {
  buildBid360TenderPath,
  buildTenderSourceIdentityKey,
  computeTenderContentHash,
  parseTenderRouteId,
} from './tender-identity'

describe('canonical tender identity', () => {
  it('uses a reliable source identifier and keeps similar titles separate', () => {
    const first = buildTenderSourceIdentityKey({
      sourceKey: 'etenders-gov-za',
      tender: { id: 101, reference: 'SAME/2026', title: 'Road works' },
    })
    const second = buildTenderSourceIdentityKey({
      sourceKey: 'etenders-gov-za',
      tender: { id: 102, reference: 'SAME/2026', title: 'Road works revised' },
    })

    expect(first).not.toBe(second)
    expect(first).toContain('source-id:101')
  })

  it('does not merge identical references issued by different institutions', () => {
    const first = buildTenderSourceIdentityKey({
      sourceKey: 'etenders-gov-za',
      tender: { reference: 'PANEL/2026', title: 'Legal panel' },
      tenderDetails: { entity: 'Issuer A' },
    })
    const second = buildTenderSourceIdentityKey({
      sourceKey: 'etenders-gov-za',
      tender: { reference: 'PANEL/2026', title: 'Legal panel' },
      tenderDetails: { entity: 'Issuer B' },
    })

    expect(first).not.toBe(second)
  })

  it('keeps the permanent route identity independent of the title slug', () => {
    expect(buildBid360TenderPath(47, 'Original tender title')).toBe('/tenders/47/original-tender-title')
    expect(buildBid360TenderPath(47, 'Changed tender title')).toBe('/tenders/47/changed-tender-title')
    expect(parseTenderRouteId('47')).toBe(47)
    expect(parseTenderRouteId('47/other')).toBeNull()
    expect(parseTenderRouteId('abc')).toBeNull()
  })

  it('changes the content hash when source content changes', () => {
    const original = computeTenderContentHash({
      tender: { id: 88, reference: 'A/1', title: 'Legal services', description: 'Advice' },
      tenderDetails: { entity: 'Issuer' },
    })
    const changed = computeTenderContentHash({
      tender: { id: 88, reference: 'A/1', title: 'Legal services', description: 'Advice and litigation' },
      tenderDetails: { entity: 'Issuer' },
    })

    expect(changed).not.toBe(original)
  })
})
