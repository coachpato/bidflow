import { DiagnosticsCollector } from '@/lib/diagnostics'
import {
  captureSourceFingerprint,
  compareSourceFingerprints,
  validateAndStoreSourceFingerprint,
} from './source-fingerprint'

function createFingerprintDb(existingFingerprint = null) {
  let stored = existingFingerprint ? { sourceId: 1, fingerprint: existingFingerprint } : null

  return {
    get stored() {
      return stored
    },
    sourceFingerprint: {
      findUnique: jest.fn(async () => stored),
      upsert: jest.fn(async ({ create, update }) => {
        stored = {
          sourceId: create?.sourceId ?? stored.sourceId,
          fingerprint: create?.fingerprint ?? update.fingerprint,
        }
        return stored
      }),
    },
  }
}

function pageBatch({ rowCount = 10, refs = ['BID-001'] } = {}) {
  return {
    pageNumber: 1,
    pageSize: 100,
    rowCount,
    tenders: refs.map(reference => ({
      reference,
      title: `Tender ${reference}`,
      raw: {
        tender_No: reference,
        description: `Tender ${reference}`,
        closing_Date: '2026-06-01',
      },
    })),
  }
}

describe('source fingerprinting', () => {
  it('bootstraps and stores the first fingerprint', async () => {
    const db = createFingerprintDb()
    const diagnostics = new DiagnosticsCollector()

    const result = await validateAndStoreSourceFingerprint({
      db,
      sourceId: 1,
      pageBatch: pageBatch(),
      fetchHtml: async () => '<body><table><tbody><tr></tr></tbody></table></body>',
      diagnostics,
    })

    expect(result.severity).toBe('none')
    expect(db.sourceFingerprint.upsert).toHaveBeenCalledTimes(1)
    expect(db.stored.fingerprint.tenderCardsFound).toBe(10)
    expect(diagnostics.snapshot().structuralChanges[0].reasons).toEqual(['fingerprint-bootstrap'])
  })

  it('warns and updates the stored fingerprint when tender count drops significantly', async () => {
    const previous = captureSourceFingerprint({
      pageBatch: pageBatch({ rowCount: 100 }),
      html: '<body><table></table></body>',
    })
    const db = createFingerprintDb(previous)
    const diagnostics = new DiagnosticsCollector()

    const result = await validateAndStoreSourceFingerprint({
      db,
      sourceId: 1,
      pageBatch: pageBatch({ rowCount: 40 }),
      fetchHtml: async () => '<body><table></table></body>',
      diagnostics,
    })

    expect(result.severity).toBe('warning')
    expect(result.reasons).toContain('tender-count-dropped')
    expect(db.sourceFingerprint.upsert).toHaveBeenCalledTimes(1)
    expect(diagnostics.snapshot().structuralChanges[0].severity).toBe('warning')
  })

  it('throws and does not update the stored fingerprint when no tender cards are found', async () => {
    const previous = captureSourceFingerprint({
      pageBatch: pageBatch({ rowCount: 100 }),
      html: '<body><table></table></body>',
    })
    const db = createFingerprintDb(previous)
    const diagnostics = new DiagnosticsCollector()

    await expect(validateAndStoreSourceFingerprint({
      db,
      sourceId: 1,
      pageBatch: pageBatch({ rowCount: 0, refs: [] }),
      fetchHtml: async () => '<body></body>',
      diagnostics,
    })).rejects.toThrow('eTenders structure changed radically')

    expect(db.sourceFingerprint.upsert).not.toHaveBeenCalled()
    expect(diagnostics.snapshot().structuralChanges[0].severity).toBe('fatal')
  })

  it('reports unchanged fingerprints as non-warning', () => {
    const fingerprint = captureSourceFingerprint({
      pageBatch: pageBatch(),
      html: '<body><table></table></body>',
    })

    expect(compareSourceFingerprints(fingerprint, fingerprint)).toEqual({
      severity: 'none',
      changed: false,
      reasons: [],
    })
  })
})
