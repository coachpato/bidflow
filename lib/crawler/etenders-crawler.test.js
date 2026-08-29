import { mapOpportunityRow } from './etenders-crawler'
import {
  ETENDERS_GENERAL_OPPORTUNITIES_URL,
  buildEtendersTenderDetailsUrl,
  getEtendersPdfLinksFromSupportDocuments,
  isFabricatedEtendersOpportunityUrl,
} from './etenders-links'

describe('eTenders row mapping', () => {
  it('retains an actual tender-specific URL when one is supplied', () => {
    const sourceUrl = 'https://www.etenders.gov.za/Home/tenderDetails?ID=166951'

    expect(mapOpportunityRow({
      id: 166951,
      tender_No: 'NKTVET/2026/08/01',
      description: 'Panel of attorneys',
      url: sourceUrl,
    })).toMatchObject({
      url: sourceUrl,
      sourceUrl,
    })
  })

  it('uses the eTenders tender details endpoint when an id is available', () => {
    const row = mapOpportunityRow({
      id: 166951,
      tender_No: 'NKTVET/2026/08/01',
      description: 'Panel of attorneys',
    })

    expect(row.sourceUrl).toBe(buildEtendersTenderDetailsUrl(166951))
    expect(row.sourceUrl).not.toBe('https://www.etenders.gov.za/Home/opportunities?id=1')
  })

  it('falls back to the honest general eTenders page when no direct id or URL exists', () => {
    const row = mapOpportunityRow({
      tender_No: 'NO-ID/2026',
      description: 'Tender without a public detail id',
    })

    expect(row.sourceUrl).toBe(ETENDERS_GENERAL_OPPORTUNITIES_URL)
    expect(row.sourceUrl).not.toBe('https://www.etenders.gov.za/Home/opportunities?id=1')
  })

  it('never treats Home/opportunities?id=1 as a tender-specific URL', () => {
    expect(isFabricatedEtendersOpportunityUrl('https://www.etenders.gov.za/Home/opportunities?id=1'))
      .toBe(true)
  })

  it('does not give multiple tenders the same fabricated opportunity URL', () => {
    const rows = [
      mapOpportunityRow({
        id: 166951,
        tender_No: 'NKTVET/2026/08/01',
        description: 'Panel of attorneys',
      }),
      mapOpportunityRow({
        id: 166955,
        tender_No: 'E3251GXMPHEN',
        description: 'Waste management',
      }),
    ]

    expect(rows.map(row => row.sourceUrl)).toEqual([
      buildEtendersTenderDetailsUrl(166951),
      buildEtendersTenderDetailsUrl(166955),
    ])
    expect(new Set(rows.map(row => row.sourceUrl)).size).toBe(2)
  })

  it('maps eTenders PDF support documents to download URLs', () => {
    const links = getEtendersPdfLinksFromSupportDocuments({
      supportDocument: [
        {
          supportDocumentID: '6a4e1ecd-af60-4268-9d57-9ec89f1ea5e6',
          fileName: 'LEGAL SERVICES TENDER DOCUMENT.pdf',
          extension: '.pdf',
          active: true,
        },
        {
          supportDocumentID: 'ignored-docx',
          fileName: 'Word returnable.docx',
          extension: '.docx',
          active: true,
        },
      ],
    })

    expect(links).toEqual([
      {
        url: 'https://www.etenders.gov.za/home/Download/?blobName=6a4e1ecd-af60-4268-9d57-9ec89f1ea5e6.pdf&downloadedFileName=LEGAL+SERVICES+TENDER+DOCUMENT.pdf',
        text: 'LEGAL SERVICES TENDER DOCUMENT.pdf',
        sourceDocumentId: '6a4e1ecd-af60-4268-9d57-9ec89f1ea5e6',
      },
    ])
  })
})
