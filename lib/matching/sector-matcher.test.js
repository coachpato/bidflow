import { matchTenderToSectors } from './sector-matcher'

function expectLegal(tender) {
  expect(matchTenderToSectors(tender)).toContain('legal')
}

function expectNotLegal(tender) {
  expect(matchTenderToSectors(tender)).not.toContain('legal')
}

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

  it('classifies a panel of attorneys as legal', () => {
    expectLegal({
      title: 'Request for proposal for a panel of attorneys',
      description: 'Provide legal services to Nkangala TVET College for five years.',
      category: 'Legal and accounting activities',
    })
  })

  it('classifies litigation services as legal', () => {
    expectLegal({
      title: 'Provision of litigation services',
      description: 'External legal service providers are required for dispute resolution matters.',
      category: 'Services: Professional',
    })
  })

  it('classifies advocates or legal counsel as legal', () => {
    expectLegal({
      title: 'Appointment of advocates and legal counsel',
      description: 'The panel will provide representation and legal opinions.',
      category: 'Services: Professional',
    })
  })

  it('classifies debt-collection services as legal', () => {
    expectLegal({
      title: 'The appointment of a debt collection agency',
      description: 'Collection of arrear TV licences for a period of five years.',
      category: 'Administrative and support activities',
    })
  })

  it('classifies collection of outstanding debt as legal', () => {
    expectLegal({
      title: 'Provision of collection services',
      description: 'Service providers must perform recovery of outstanding debt and arrear accounts.',
      category: 'Financial service activities',
    })
  })

  it('classifies an LLB or admitted-practitioner requirement as legal', () => {
    expectLegal({
      title: 'Appointment of a service provider for disciplinary hearing services',
      description: 'The lead resource must hold an LLB degree and be an admitted attorney or advocate.',
      category: 'Professional services',
    })
  })

  it('classifies an LLB requirement supplied only in raw source conditions as legal', () => {
    expectLegal({
      raw: {
        conditions: 'The appointed practitioner must have an LLB degree and be an admitted attorney.',
      },
    })
  })

  it('does not classify tenders from a broad legal and accounting source category alone', () => {
    expectNotLegal({
      title: 'Supply and delivery of general office consumables',
      description: 'Supply and delivery of office consumables for the municipality.',
      category: 'Legal and accounting activities',
    })
  })

  it('does not classify waste management or waste collection as legal', () => {
    expectNotLegal({
      title: 'Provision of waste management and operation of a general waste disposal facility',
      description: 'The principal scope is collection and disposal of general waste.',
      category: 'Waste collection, treatment and disposal activities; materials recovery',
      raw: {
        supportDocument: [
          {
            fileName: 'Annexure B Eskom Acknowledgement Form for OHS Legal and Other Requirements - Rev 4.pdf',
            updatedBy: 'procurement@example.gov.za',
          },
        ],
      },
    })
  })

  it('does not classify enterprise architecture or ICT strategy as legal', () => {
    expectNotLegal({
      title: 'Development of an Enterprise Architecture and ICT strategy for the Social Housing Regulatory Authority',
      description: 'Enterprise architecture and ICT strategy services.',
      entity: 'Social Housing Regulatory Authority',
      category: 'Other professional, scientific and technical activities',
    })
  })

  it('does not classify office-space rental as legal', () => {
    expectNotLegal({
      title: 'Appointment of a service provider for office space rental',
      description: 'Office space rental for GroenKloof National Park.',
      category: 'Administrative and support activities',
      tenderDetails: {
        entity: 'South African National Parks',
      },
      raw: {
        contactPerson: 'Thivhulawi Ratshibvumo',
        email: 'thivhulawi.ratshibvumo@sanparks.org',
      },
    })
  })

  it('does not classify civil engineering or dam de-silting as legal', () => {
    expectNotLegal({
      title: 'De-silting and lining of seven-year dam at Hendrina Power Station',
      description: 'Civil engineering works for dam de-silting and lining.',
      category: 'Civil engineering',
      raw: {
        supportDocument: [
          {
            fileName: 'Annexure B Eskom Acknowledgement Form for OHS Legal and Other Requirements - Rev 4.pdf',
          },
        ],
      },
    })
  })

  it('does not classify a housing market study without legal-services scope as legal', () => {
    expectNotLegal({
      title: 'Development of a rental housing strategy and provincial market and demand study',
      description: 'Implementation plan and market study for social housing.',
      entity: 'Social Housing Regulatory Authority',
      category: 'Professional, scientific and technical activities',
    })
  })

  it('does not classify electrical fuse-link supply as legal', () => {
    expectNotLegal({
      title: 'Manufacture, testing, supply and delivery of high voltage (12kV) current limiting fuse-links',
      description: 'Manufacture, testing, supply and delivery of electrical equipment.',
      category: 'Supplies: Electrical Equipment',
    })
  })

  it('does not classify cleaning materials supply as legal', () => {
    expectNotLegal({
      title: 'Supply, delivery and off-loading of cleaning materials and equipment to Cederberg Municipality',
      description: 'Cleaning materials and equipment for a multi-year period.',
      category: 'Other service activities',
    })
  })

  it('does not classify fire-station door maintenance as legal', () => {
    expectNotLegal({
      title: 'Appointment of a service provider for the supply, maintenance and repairs to fire station doors and door motors',
      description: 'Supply, maintenance and repairs to fire station doors and door motors.',
      category: 'Services: Functional (Including Cleaning and Security Services)',
    })
  })

  it('does not classify a generic petroleum-products panel as legal', () => {
    expectNotLegal({
      title: 'Category A: supply and delivery of fuel. Category B: appointment of a panel of service providers to supply and deliver petroleum products.',
      description: 'Supply and delivery of fuel and petroleum products for three years.',
      category: 'Manufacture of coke and refined petroleum products',
    })
  })

  it('does not reuse generated legal summaries as source classification evidence', () => {
    expectNotLegal({
      title: 'Appointment of a service provider for VAT recovery services',
      description: 'VAT review, recovery, preparation and submission services.',
      category: 'Legal and accounting activities',
      summary: 'Legal Services opportunity. Legal Services signals found: legal.',
    })
  })
})
