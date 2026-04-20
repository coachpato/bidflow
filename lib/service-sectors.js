export const SERVICE_SECTOR_OPTIONS = [
  {
    value: 'BUILT_ENVIRONMENT',
    label: 'Built Environment',
    description: 'For engineering, quantity surveying, architecture, project management, and related built-environment firms.',
    defaultPracticeAreas: ['Built Environment Services'],
  },
  {
    value: 'LEGAL',
    label: 'Legal',
    description: 'For legal practices, attorneys, and specialist firms doing public-sector work.',
    defaultPracticeAreas: ['Legal Services'],
  },
  {
    value: 'ACCOUNTING',
    label: 'Accounting',
    description: 'For accounting, audit, tax, and advisory firms serving public-sector projects.',
    defaultPracticeAreas: ['Accounting Services'],
  },
]

const SERVICE_SECTOR_MAP = new Map(
  SERVICE_SECTOR_OPTIONS.map(option => [option.value, option])
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

export function getServiceSectorLabel(value) {
  return SERVICE_SECTOR_MAP.get(normalizeServiceSector(value))?.label || 'Not set'
}

export function getDefaultPracticeAreasForSector(value) {
  return SERVICE_SECTOR_MAP.get(normalizeServiceSector(value))?.defaultPracticeAreas || []
}
