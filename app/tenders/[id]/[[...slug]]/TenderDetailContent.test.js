import { renderToStaticMarkup } from 'react-dom/server'
import TenderDetailContent from './TenderDetailContent'

describe('shared tender detail page', () => {
  it('renders stored public fields, escapes source text, and shows the honest source fallback', () => {
    const html = renderToStaticMarkup(
      <TenderDetailContent
        tender={{
          id: 42,
          title: '<script>alert("x")</script>',
          entity: '<img src=x onerror=alert(1)>',
          reference: 'LEGAL/42',
          summary: 'Legal services <strong>scope</strong>',
          category: 'Legal services',
          matchedSectors: ['legal'],
          sourceName: 'eTenders.gov.za',
          sourceUrl: 'https://www.etenders.gov.za/Home/tenderDetails?ID=42',
          sourceDetailUrl: 'https://www.etenders.gov.za/Home/tenderDetails?ID=42',
          sourceFallbackUrl: 'https://www.etenders.gov.za/Home?myTab=1',
          sourceStatus: 'Open',
          publishedAt: new Date('2026-08-01T00:00:00.000Z'),
          deadline: new Date('2026-09-01T12:00:00.000Z'),
          lastVerifiedAt: new Date('2026-08-02T00:00:00.000Z'),
          firstSeenAt: new Date('2026-08-01T00:00:00.000Z'),
          documents: [{
            id: 1,
            filename: 'official.pdf',
            sourceUrl: 'https://www.etenders.gov.za/home/Download/?blobName=official.pdf',
          }],
        }}
      />
    )

    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toContain('<script>alert')
    expect(html).not.toContain('subscriber')
    expect(html).not.toContain('unsubscribeToken')
    expect(html).toContain('View opportunities on eTenders')
    expect(html).toContain('https://www.etenders.gov.za/Home?myTab=1')
    expect(html).toContain('official.pdf')
  })

  it('keeps a closed tender visible with its retention notice', () => {
    const html = renderToStaticMarkup(
      <TenderDetailContent
        tender={{
          id: 9,
          title: 'Closed legal tender',
          entity: 'Issuer',
          deadline: new Date('2026-08-01T12:00:00.000Z'),
          sourceFallbackUrl: 'https://www.etenders.gov.za/Home?myTab=1',
          documents: [],
        }}
      />
    )

    expect(html).toContain('Closed')
    expect(html).toContain('The information is retained for reference.')
    expect(html).toContain('Closed legal tender')
  })
})
