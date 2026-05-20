export const SOUTH_AFRICA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
]

const SERVICE_SECTOR_DEFINITIONS = [
  {
    value: 'BUILT_ENVIRONMENT',
    label: 'Built Environment',
    description: 'For engineering, architecture, quantity surveying, project controls, and public-infrastructure delivery teams.',
    defaultPracticeAreas: ['Built Environment Services'],
    defaultTargetWorkTypes: ['Professional services panels', 'Design and engineering'],
    discovery: {
      practiceAreasLabel: 'Which built-environment services should we prioritise?',
      workTypesLabel: 'Which opportunity types do you want to see?',
      practiceAreaOptions: [
        'Civil engineering',
        'Structural engineering',
        'Electrical engineering',
        'Mechanical engineering',
        'Architecture',
        'Quantity surveying',
        'Project management',
        'Town planning',
        'Environmental services',
      ],
      workTypeOptions: [
        'Professional services panels',
        'Design and engineering',
        'Project management',
        'Contract administration',
        'Technical advisory',
        'Feasibility studies',
        'Site supervision',
      ],
      preferredEntitiesPlaceholder: 'SANRAL, Eskom, Transnet, water boards, metros, municipalities',
    },
    workspace: {
      overviewPlaceholder: 'Describe the firm, the project sectors it serves, and the kinds of infrastructure or public-works opportunities it should pursue.',
      peopleDescription: 'Capture the engineers, architects, quantity surveyors, project managers, and specialists the team needs to reference when reviewing opportunities and running pursuits.',
      peopleQualificationsPlaceholder: 'Pr Eng, Pr QS, SACAP registration, PMP',
      peoplePracticeAreasPlaceholder: 'Civil engineering, project management',
      peopleNotesPlaceholder: 'Use this person for transport projects and multidisciplinary panels.',
      experienceDescription: 'Add frameworks, infrastructure projects, professional-service panels, and advisory work the firm can reference when deciding what to pursue.',
      experienceWorkTypePlaceholder: 'Design panel, project management, supervision',
      experienceSummaryPlaceholder: 'Describe the technical scope, public-sector relevance, and delivery outcomes.',
    },
  },
  {
    value: 'LEGAL_SERVICES',
    label: 'Legal Services',
    description: 'For law firms, legal panels, disputes teams, and specialist public-sector counsel.',
    defaultPracticeAreas: ['Legal Services'],
    defaultTargetWorkTypes: ['Panel appointments', 'Advisory work'],
    discovery: {
      practiceAreasLabel: 'Which legal services should we prioritise?',
      workTypesLabel: 'Which opportunity types do you want to see?',
      practiceAreaOptions: [
        'Litigation and disputes',
        'Labour and employment',
        'Investigations',
        'Debt collection',
        'Regulatory and compliance',
        'Commercial and contracts',
        'Property and conveyancing',
        'General legal panels',
      ],
      workTypeOptions: [
        'Panel appointments',
        'Litigation briefs',
        'Investigations',
        'Debt collection mandates',
        'Advisory work',
        'Drafting and review',
        'Due diligence',
      ],
      preferredEntitiesPlaceholder: 'Provincial treasuries, municipalities, SOEs, regulators',
    },
    workspace: {
      overviewPlaceholder: 'Describe the firm, its public-sector strengths, and the kinds of legal mandates it should pursue.',
      peopleDescription: 'Capture the attorneys and subject matter experts the team needs to reference when reviewing opportunities and running pursuits.',
      peopleQualificationsPlaceholder: 'LLB, admitted attorney, mediator',
      peoplePracticeAreasPlaceholder: 'Administrative law, labour law',
      peopleNotesPlaceholder: 'Use this person for labour matters, investigations, and hearings.',
      experienceDescription: 'Add public-sector mandates, panels, investigations, and advisory work the firm can reference when deciding what to pursue.',
      experienceWorkTypePlaceholder: 'Panel, advisory, investigation',
      experienceSummaryPlaceholder: 'Describe the legal work, sector relevance, and outcomes.',
    },
  },
  {
    value: 'FINANCIAL_SERVICES',
    label: 'Financial Services / Project Finance',
    description: 'For project finance, transaction advisory, accounting, audit, valuations, and financial close support.',
    defaultPracticeAreas: ['Financial Services'],
    defaultTargetWorkTypes: ['Transaction advisory', 'Financial close support'],
    discovery: {
      practiceAreasLabel: 'Which financial services should we prioritise?',
      workTypesLabel: 'Which opportunity types do you want to see?',
      practiceAreaOptions: [
        'Project finance advisory',
        'Financial modelling',
        'Transaction advisory',
        'External audit',
        'Internal audit',
        'Forensic accounting',
        'Tax advisory',
        'Valuations',
      ],
      workTypeOptions: [
        'Transaction advisory',
        'Project finance support',
        'Financial modelling',
        'Audit panels',
        'Forensic investigations',
        'Due diligence',
        'Asset verification',
      ],
      preferredEntitiesPlaceholder: 'DBSA, IDC, National Treasury, municipalities, infrastructure funds, SOEs',
    },
    workspace: {
      overviewPlaceholder: 'Describe the firm, its public-sector finance strengths, and the mandates it should pursue.',
      peopleDescription: 'Capture the finance leads, auditors, project finance advisors, and forensic specialists the team needs to reference when reviewing opportunities and running pursuits.',
      peopleQualificationsPlaceholder: 'CA(SA), CFA, FMVA, RA, SAIPA, CIMA',
      peoplePracticeAreasPlaceholder: 'Project finance, transaction advisory, audit',
      peopleNotesPlaceholder: 'Use this person for financial models, transaction support, and close-out reviews.',
      experienceDescription: 'Add transactions, audits, project finance mandates, and financial advisory work the firm can reference when deciding what to pursue.',
      experienceWorkTypePlaceholder: 'Transaction advisory, audit panel, due diligence',
      experienceSummaryPlaceholder: 'Describe the finance scope, public-sector relevance, and outcomes.',
    },
  },
  {
    value: 'GREEN_ENERGY',
    label: 'Green Energy',
    description: 'For renewable energy, climate infrastructure, grid transition, and sustainability delivery teams.',
    defaultPracticeAreas: ['Green Energy Services'],
    defaultTargetWorkTypes: ['Renewable energy advisory', 'Energy infrastructure delivery'],
    discovery: {
      practiceAreasLabel: 'Which green-energy services should we prioritise?',
      workTypesLabel: 'Which opportunity types do you want to see?',
      practiceAreaOptions: [
        'Solar PV',
        'Wind energy',
        'Battery storage',
        'Grid integration',
        'Environmental and social advisory',
        'Owner’s engineer',
        'Energy programme management',
        'Climate finance support',
      ],
      workTypeOptions: [
        'Renewable energy advisory',
        'Energy infrastructure delivery',
        'Owner’s engineer',
        'Independent engineer',
        'Grid studies',
        'Environmental advisory',
        'Climate finance support',
      ],
      preferredEntitiesPlaceholder: 'IPP Office, Eskom, municipal utilities, DFIs, green funds',
    },
    workspace: {
      overviewPlaceholder: 'Describe the firm, its renewable or climate strengths, and the kinds of green-energy mandates it should pursue.',
      peopleDescription: 'Capture the energy specialists, engineers, climate advisors, and programme leads the team needs to reference when reviewing opportunities and running pursuits.',
      peopleQualificationsPlaceholder: 'Pr Eng, PMP, energy modelling, ESG advisory',
      peoplePracticeAreasPlaceholder: 'Solar PV, owner’s engineer, climate finance',
      peopleNotesPlaceholder: 'Use this person for renewable advisory, grid transition, and energy procurement work.',
      experienceDescription: 'Add renewable programmes, climate advisory work, grid studies, and project delivery mandates the firm can reference when deciding what to pursue.',
      experienceWorkTypePlaceholder: 'Owner’s engineer, transaction support, grid study',
      experienceSummaryPlaceholder: 'Describe the energy scope, stakeholder context, and delivery outcomes.',
    },
  },
]

export const SERVICE_SECTOR_OPTIONS = SERVICE_SECTOR_DEFINITIONS.map(
  ({ value, label, description, defaultPracticeAreas }) => ({
    value,
    label,
    description,
    defaultPracticeAreas,
  })
)

const SERVICE_SECTOR_MAP = new Map(
  SERVICE_SECTOR_DEFINITIONS.map(option => [option.value, option])
)

const SERVICE_SECTOR_ALIASES = new Map([
  ['ATTORNEYS', 'LEGAL_SERVICES'],
  ['LEGAL', 'LEGAL_SERVICES'],
  ['LEGAL_SERVICES', 'LEGAL_SERVICES'],
  ['ENGINEERS', 'BUILT_ENVIRONMENT'],
  ['BUILT_ENVIRONMENT', 'BUILT_ENVIRONMENT'],
  ['ACCOUNTING', 'FINANCIAL_SERVICES'],
  ['FINANCIAL_SERVICES', 'FINANCIAL_SERVICES'],
  ['PROJECT_FINANCE', 'FINANCIAL_SERVICES'],
  ['FINANCIAL_SERVICES_PROJECT_FINANCE', 'FINANCIAL_SERVICES'],
  ['GREEN', 'GREEN_ENERGY'],
  ['GREEN_ENERGY', 'GREEN_ENERGY'],
])

export function normalizeServiceSector(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '_')
  const mapped = SERVICE_SECTOR_ALIASES.get(normalized) || normalized
  return SERVICE_SECTOR_MAP.has(mapped) ? mapped : null
}

export function normalizeServiceSectors(values) {
  if (!Array.isArray(values)) {
    const normalizedSingle = normalizeServiceSector(values)
    return normalizedSingle ? [normalizedSingle] : []
  }

  return Array.from(
    new Set(
      values
        .map(item => normalizeServiceSector(item))
        .filter(Boolean)
    )
  )
}

export function getFirmServiceSectors(profileOrValue) {
  if (!profileOrValue) return []

  if (typeof profileOrValue === 'string') {
    return normalizeServiceSectors([profileOrValue])
  }

  const normalized = normalizeServiceSectors(profileOrValue.serviceSectors)
  if (normalized.length > 0) return normalized

  return normalizeServiceSectors([profileOrValue.serviceSector])
}

export function getServiceSectorConfig(value) {
  return SERVICE_SECTOR_MAP.get(normalizeServiceSector(value)) || null
}

export function getServiceSectorLabel(value) {
  return getServiceSectorConfig(value)?.label || 'Not set'
}

export function getServiceSectorLabels(values) {
  return getFirmServiceSectors({ serviceSectors: values }).map(item => getServiceSectorLabel(item))
}

export function getDefaultPracticeAreasForSector(value) {
  return [...(getServiceSectorConfig(value)?.defaultPracticeAreas || [])]
}

export function getDefaultTargetWorkTypesForSector(value) {
  return [...(getServiceSectorConfig(value)?.defaultTargetWorkTypes || [])]
}

export function getServiceSectorDiscoveryConfig(value) {
  return getServiceSectorConfig(value)?.discovery || {
    practiceAreasLabel: 'Which services should we prioritise?',
    workTypesLabel: 'Which opportunity types do you want to see?',
    practiceAreaOptions: [],
    workTypeOptions: [],
    preferredEntitiesPlaceholder: '',
  }
}

export function getServiceSectorWorkspaceCopy(value) {
  return getServiceSectorConfig(value)?.workspace || {
    overviewPlaceholder: 'Describe the firm, its public-sector strengths, and the kinds of mandates it should pursue.',
    peopleDescription: 'Capture the key people the team needs to reference when reviewing opportunities and running pursuits.',
    peopleQualificationsPlaceholder: 'Professional registrations and credentials',
    peoplePracticeAreasPlaceholder: 'Key service lines',
    peopleNotesPlaceholder: 'When this person should be involved.',
    experienceDescription: 'Add representative mandates the firm can reference when deciding what to pursue.',
    experienceWorkTypePlaceholder: 'Panel, advisory, investigation',
    experienceSummaryPlaceholder: 'Describe the work, public-sector relevance, and outcomes.',
  }
}
