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
    description: 'For engineering, quantity surveying, architecture, project management, and related built-environment firms.',
    defaultPracticeAreas: ['Built Environment Services'],
    defaultTargetWorkTypes: ['Professional services panels', 'Design and engineering'],
    discovery: {
      practiceAreasLabel: 'Which disciplines should we prioritise?',
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
      preferredEntitiesPlaceholder: 'SANRAL, Transnet, water boards, metros, municipalities',
    },
    workspace: {
      overviewPlaceholder: 'Describe the firm, the project sectors it serves, and the kinds of public-sector infrastructure opportunities it should pursue.',
      peopleDescription: 'Capture the engineers, architects, quantity surveyors, and project specialists the team needs to reference when reviewing opportunities and running pursuits.',
      peopleQualificationsPlaceholder: 'Pr Eng, Pr QS, SACAP registration, PMP',
      peoplePracticeAreasPlaceholder: 'Civil engineering, project management',
      peopleNotesPlaceholder: 'Use this person for transport projects and multidisciplinary panels.',
      experienceDescription: 'Add frameworks, infrastructure projects, professional-service panels, and advisory work the firm can reference when deciding what to pursue.',
      experienceWorkTypePlaceholder: 'Design panel, project management, supervision',
      experienceSummaryPlaceholder: 'Describe the technical scope, public-sector relevance, and delivery outcomes.',
    },
  },
  {
    value: 'LEGAL',
    label: 'Legal',
    description: 'For legal practices, attorneys, and specialist firms doing public-sector work.',
    defaultPracticeAreas: ['Legal Services'],
    defaultTargetWorkTypes: ['Panel appointments', 'Advisory work'],
    discovery: {
      practiceAreasLabel: 'Which legal areas should we prioritise?',
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
    value: 'ACCOUNTING',
    label: 'Accounting',
    description: 'For accounting, audit, tax, and advisory firms serving public-sector projects.',
    defaultPracticeAreas: ['Accounting Services'],
    defaultTargetWorkTypes: ['Audit panels', 'Forensic investigations'],
    discovery: {
      practiceAreasLabel: 'Which accounting services should we prioritise?',
      workTypesLabel: 'Which opportunity types do you want to see?',
      practiceAreaOptions: [
        'External audit',
        'Internal audit',
        'Forensic accounting',
        'Tax advisory',
        'Financial advisory',
        'Risk and compliance',
        'Payroll and bookkeeping',
        'Valuations',
      ],
      workTypeOptions: [
        'Audit panels',
        'Forensic investigations',
        'Tax advisory',
        'Financial management support',
        'Due diligence',
        'Asset verification',
        'Internal controls reviews',
      ],
      preferredEntitiesPlaceholder: 'National Treasury, municipalities, public entities, SOEs',
    },
    workspace: {
      overviewPlaceholder: 'Describe the firm, its public-sector strengths, and the kinds of accounting, audit, or advisory mandates it should pursue.',
      peopleDescription: 'Capture the accountants, auditors, forensic specialists, and advisory leads the team needs to reference when reviewing opportunities and running pursuits.',
      peopleQualificationsPlaceholder: 'CA(SA), RA, SAIPA, CIMA',
      peoplePracticeAreasPlaceholder: 'Audit, forensic accounting, tax',
      peopleNotesPlaceholder: 'Use this person for forensic investigations and internal control reviews.',
      experienceDescription: 'Add audits, forensic reviews, tax work, and advisory mandates the firm can reference when deciding what to pursue.',
      experienceWorkTypePlaceholder: 'Audit panel, forensic review, advisory support',
      experienceSummaryPlaceholder: 'Describe the accounting scope, public-sector relevance, and outcomes.',
    },
  },
]

export const SERVICE_SECTOR_OPTIONS = SERVICE_SECTOR_DEFINITIONS.map(({ value, label, description, defaultPracticeAreas }) => ({
  value,
  label,
  description,
  defaultPracticeAreas,
}))

const SERVICE_SECTOR_MAP = new Map(
  SERVICE_SECTOR_DEFINITIONS.map(option => [option.value, option])
)

const SERVICE_SECTOR_ALIASES = new Map([
  ['ATTORNEYS', 'LEGAL'],
  ['ENGINEERS', 'BUILT_ENVIRONMENT'],
])

export function normalizeServiceSector(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '_')
  const mapped = SERVICE_SECTOR_ALIASES.get(normalized) || normalized
  return SERVICE_SECTOR_MAP.has(mapped) ? mapped : null
}

export function getServiceSectorConfig(value) {
  return SERVICE_SECTOR_MAP.get(normalizeServiceSector(value)) || SERVICE_SECTOR_MAP.get('LEGAL')
}

export function getServiceSectorLabel(value) {
  return getServiceSectorConfig(value)?.label || 'Not set'
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
