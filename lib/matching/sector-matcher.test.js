import { matchTenderToSectors } from './sector-matcher'

describe('matchTenderToSectors', () => {
  it('matches construction tenders from road construction keywords', () => {
    expect(matchTenderToSectors({
      title: 'Road construction and bridge repair',
      description: 'Civil works package',
      category: 'Infrastructure',
    })).toContain('construction')
  })

  it('matches tenders across multiple sectors', () => {
    expect(matchTenderToSectors({
      title: 'Hospital software platform',
      description: 'Clinical systems and digital records for public health facilities.',
      category: 'Medical technology',
    })).toEqual(expect.arrayContaining(['healthcare', 'it-technology']))
  })

  it('returns an empty array when no sector keywords match', () => {
    expect(matchTenderToSectors({
      title: 'Office catering services',
      description: 'Refreshments for municipal workshops',
      category: 'General goods',
    })).toEqual([])
  })
})
