import { matchTenderToSectors } from './sector-matcher'

function expectLegal(tender) {
  expect(matchTenderToSectors(tender)).toContain('legal')
}

function expectNotLegal(tender) {
  expect(matchTenderToSectors(tender)).not.toContain('legal')
}

describe('matchTenderToSectors', () => {
  const legalCrawlerExamples = [
    'Appointment of a Legal Services Panel for the Supply Chain and Contracts Management Unit',
    'Panel of Legal Advisors for the IPP Office for a Period of 5 Years to Provide Legal Transaction Advisory and Specialist Legal Services',
    'Appointment of a Service Provider to Provide a Legal Opinion',
    'Legal Panel Argumentation of Services Providers for Provision of Legal Panel on as as and when Required Basis',
    'Appointment of Legal Attorney for a Review of Arbitration Award at The Labour Court.',
    'Request for Quotations - Legal Services',
    'The Municipality Seeks the Appointment of a Panel of Legal Practitioners for the Rendering of Legal Services',
    'RFQ - Professional Notarial Services',
    'Provision of Legal Panel Service to the Tshwane Automotive Special Economic Zone for a period of 36 months.',
    'Provision of a Panel for Legal Services for a Period of 3 Years.',
    'Appointment of a Panel of Legal Service Providers',
    'Panel of Legal Service Providers for the Provision of Legal Services to Eastcape Midlands TVET College',
    'Request Proposal from Prospective Bidders for a Panel of Attorneys to Provide Legal Services',
    'Appointment of a Panel of Attorneys for the University of KwaZulu-Natal',
    'Appointment of a Registered Conveyancer to Register the Transfer of Farm Portions',
    'Conveyancing Services',
    'The appointment of panel of conveyancers to conduct registration of transfer of title deeds',
    'Procurement of Legal Transaction Advisor to support the Independent Power Producers Office',
    'RFQ Appointment of a Law Firm to Initiate Disciplinary Proceedings',
    'Appointment of Service Providers to Chair Grievance Hearings.',
    'Appointment of a Legal Expert to Draft Regulations and Advise on the Public Service Amendment Act',
    'The Appointment for the Labour Relations Panel Bid for a Period of Three Years',
    'Legal Services',
    'Panel of Legal Practitioners',
    'Panel of Five Conveyancers to Undertake Conveyancing Work',
    'Request for Proposals for Consultant to Provide Legal Services to the Municipality',
    'Legal Advisory, Stakeholder Engagement, and Implementation Support',
    'Bid Invitation - Legal and Training',
    'Provision of Legal and Specialised Legal Services for a Contract Period of Three Years',
    'Appointment of a Service Provider to Represent the Department in the Arbitration of an Official',
    'Appointment of a Panel of Attorneys for Labour Law Matters',
    'Legal, Governance & Risk Advice',
  ]

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

  it('maps specific eTenders source categories to Bid360 sectors', () => {
    expect(matchTenderToSectors({
      title: 'Supply of agricultural products',
      category: 'Agricultural Products and Services',
    })).toContain('agriculture')
    expect(matchTenderToSectors({
      title: 'Construction of a public facility',
      category: 'Construction of buildings',
    })).toContain('construction')
    expect(matchTenderToSectors({
      title: 'Accredited training services',
      category: 'Education',
    })).toContain('education')
    expect(matchTenderToSectors({
      title: 'Supply and delivery of high voltage current limiting fuse-links',
      category: 'Supplies: Electrical Equipment',
    })).toContain('energy')
    expect(matchTenderToSectors({
      title: 'Short-term insurance broking services',
      category: 'Insurance, reinsurance and pension funding, except compulsory social security',
    })).toContain('finance')
    expect(matchTenderToSectors({
      title: 'Supply and delivery of medical consumables',
      category: 'Supplies: Medical',
    })).toContain('healthcare')
    expect(matchTenderToSectors({
      title: 'Provision of safety and security services',
      category: 'Security and investigation activities',
    })).toContain('security')
    expect(matchTenderToSectors({
      title: 'Provision of web platform support',
      category: 'Computer programming, consultancy and related activities',
    })).toContain('it-technology')
    expect(matchTenderToSectors({
      title: 'Manufacture of specialised machinery',
      category: 'Manufacture of machinery and equipment n.e.c.',
    })).toContain('manufacturing')
    expect(matchTenderToSectors({
      title: 'Management consultancy support',
      category: 'Activities of head offices; management consultancy activities',
    })).toContain('professional-services')
    expect(matchTenderToSectors({
      title: 'Broadband connectivity services',
      category: 'Telecommunications',
    })).toContain('telecommunications')
    expect(matchTenderToSectors({
      title: 'Operation and maintenance of landfill site',
      category: 'Waste collection, treatment and disposal activities; materials recovery',
    })).toContain('water-sanitation')
    expect(matchTenderToSectors({
      title: 'Travel management services',
      category: 'Travel agency, tour operator, reservation service and related activities',
    })).toContain('tourism')
    expect(matchTenderToSectors({
      title: 'Freight logistics services',
      category: 'Transportation and storage',
    })).toContain('transport-logistics')
    expect(matchTenderToSectors({
      title: 'Supply of quarry services',
      category: 'Mining and quarrying',
    })).toContain('mining')
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

  it('classifies legal crawler result wording from eTenders', () => {
    for (const title of legalCrawlerExamples) {
      expectLegal({
        title,
        category: 'Services: Professional',
      })
    }
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

  it('does not classify non-legal rows from the pasted crawler example as legal', () => {
    [
      {
        title: 'For the Supply and Delivery of Mechanical Spares',
        category: 'Repair and installation of machinery and equipment',
      },
      {
        title: 'Appointment of a Service Provider for a Comprehensive Bankable Feasibility Study for Water, Sanitation, Electricity, Waste Management, Roads and Stormwater',
        category: 'Services: Professional',
      },
      {
        title: 'Appointment of a Multidisciplinary Professional Service Provider to Undertake Building Condition Assessments and Infrastructure Cost Planning',
        category: 'Services: Professional',
      },
      {
        title: 'The Appointment of a Multi-Disciplinary Team Consisting of a Lead Architectural Entity for Design and Supervision on Construction',
        category: 'Architectural and engineering activities; technical testing and analysis',
      },
      {
        title: 'Appointment of a Multi-Disciplinary Professional Company for the Integrated Infrastructure Upgrade',
        category: 'Services: Professional',
      },
    ].forEach(expectNotLegal)
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
