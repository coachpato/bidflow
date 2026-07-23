import fs from 'node:fs'
import path from 'node:path'

describe('tender-processing subscriber pipeline', () => {
  it('does not call the old organization matching helpers from the active processing file', () => {
    const filePath = path.join(process.cwd(), 'lib', 'crawler', 'tender-processing.js')
    const source = fs.readFileSync(filePath, 'utf8')

    const legacyMatchers = [
      'analyzeTenderFor' + 'Sector',
      'evaluateOpportunity' + 'Match',
      'buildOpportunity' + 'DedupeKey',
    ]

    legacyMatchers.forEach(name => {
      expect(source).not.toContain(name)
    })
    expect(source).not.toContain("from '@/lib/crawler/keyword-matcher'")
    expect(source).not.toContain("from '@/lib/opportunity-radar'")
  })
})
