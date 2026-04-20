import { normalizeServiceSector } from '@/lib/service-sectors'

const SECTOR_KEYWORD_CONFIGS = {
  LEGAL: {
    categories: {
      core: ['legal', 'lawyer', 'attorney', 'attorneys', 'advocate', 'advocates', 'counsel', 'law firm', 'legal services'],
      qualifications: ['legal qualification', 'legal expertise', 'admitted attorney', 'admitted advocate', 'law degree', 'llb'],
      roles: [
        'investigator', 'investigation', 'debt collection', 'debt collector', 'disciplinary hearing',
        'disciplinary panel', 'prosecutor', 'prosecution', 'legal advisor', 'legal consultant',
        'legal counsel', 'regulatory advice', 'legal opinion', 'litigation',
      ],
      panels: [
        'panel of attorneys', 'panel of legal', 'panel of lawyers', 'panel of advocates',
        'panel of legal services', 'panel of approved lawyers', 'panel of approved attorneys',
        'legal services providers', 'approved law firms',
      ],
      services: [
        'contract review', 'contract drafting', 'legal review', 'legal drafting', 'dispute resolution',
        'arbitration', 'mediation', 'compliance review', 'commercial law', 'employment law',
        'labour law', 'administrative law', 'constitutional law', 'property law', 'conveyancing',
        'appeals',
      ],
    },
    practiceAreaKeywords: {
      'Litigation and disputes': ['litigation', 'dispute resolution', 'arbitration', 'appeals', 'mediation'],
      'Labour and employment': ['employment law', 'labour law', 'disciplinary hearing', 'disciplinary panel'],
      Investigations: ['investigator', 'investigation', 'forensic investigation'],
      'Debt collection': ['debt collection', 'debt collector'],
      'Regulatory and compliance': ['compliance review', 'regulatory advice', 'legal compliance'],
      'Commercial and contracts': ['contract review', 'contract drafting', 'commercial law', 'legal drafting'],
      'Property and conveyancing': ['property law', 'conveyancing'],
    },
    defaultPracticeArea: 'Legal Services',
  },
  ACCOUNTING: {
    categories: {
      core: [
        'accounting', 'accountant', 'accountants', 'audit', 'auditor', 'auditors', 'assurance',
        'forensic accounting', 'financial advisory', 'tax advisory', 'chartered accountant', 'ca(sa)',
      ],
      qualifications: ['registered auditor', 'irba', 'saica', 'saipa', 'cima', 'accounting qualification'],
      roles: [
        'forensic investigation', 'forensic audit', 'internal audit', 'external audit',
        'financial management', 'tax consultant', 'financial advisor', 'payroll services',
      ],
      panels: [
        'panel of auditors', 'panel of accountants', 'panel of audit firms',
        'panel of forensic investigators', 'audit services providers', 'approved audit firms',
      ],
      services: [
        'agreed upon procedures', 'internal controls review', 'asset verification',
        'financial statements', 'bookkeeping', 'tax compliance', 'due diligence',
        'valuation', 'forensic review', 'grant audit',
      ],
    },
    practiceAreaKeywords: {
      'External audit': ['external audit', 'audit', 'auditor', 'assurance', 'grant audit'],
      'Internal audit': ['internal audit', 'internal controls review', 'controls review'],
      'Forensic accounting': ['forensic accounting', 'forensic audit', 'forensic investigation', 'forensic review'],
      'Tax advisory': ['tax advisory', 'tax consultant', 'tax compliance'],
      'Financial advisory': ['financial advisory', 'financial advisor', 'financial management', 'due diligence'],
      Valuations: ['valuation', 'asset verification'],
    },
    defaultPracticeArea: 'Accounting Services',
  },
  BUILT_ENVIRONMENT: {
    categories: {
      core: [
        'engineering', 'engineer', 'engineers', 'architect', 'architecture', 'quantity surveyor',
        'project manager', 'project management', 'built environment', 'consulting engineer',
        'professional services', 'infrastructure',
      ],
      qualifications: [
        'professional engineer', 'pr eng', 'pr qs', 'sacap', 'registered architect',
        'engineering qualification', 'built environment qualification',
      ],
      roles: [
        'contract administration', 'site supervision', 'technical advisory', 'feasibility study',
        'project planning', 'construction monitoring', 'design review',
      ],
      panels: [
        'panel of engineers', 'panel of consultants', 'panel of professional service providers',
        'panel of built environment professionals', 'consulting services providers',
      ],
      services: [
        'civil engineering', 'structural engineering', 'mechanical engineering', 'electrical engineering',
        'town planning', 'environmental services', 'water services', 'wastewater',
        'roads and stormwater', 'quantity surveying', 'architecture services',
      ],
    },
    practiceAreaKeywords: {
      'Civil engineering': ['civil engineering', 'roads and stormwater', 'water services', 'wastewater'],
      'Structural engineering': ['structural engineering'],
      'Electrical engineering': ['electrical engineering'],
      'Mechanical engineering': ['mechanical engineering'],
      Architecture: ['architect', 'architecture services', 'registered architect', 'sacap'],
      'Quantity surveying': ['quantity surveyor', 'quantity surveying', 'pr qs'],
      'Project management': ['project manager', 'project management', 'construction monitoring', 'contract administration'],
      'Environmental services': ['environmental services', 'town planning', 'feasibility study', 'technical advisory'],
    },
    defaultPracticeArea: 'Built Environment Services',
  },
}

const CATEGORY_WEIGHTS = {
  core: 0.22,
  qualifications: 0.24,
  roles: 0.2,
  panels: 0.22,
  services: 0.12,
}

function getSectorConfig(sector) {
  return SECTOR_KEYWORD_CONFIGS[normalizeServiceSector(sector) || 'LEGAL'] || SECTOR_KEYWORD_CONFIGS.LEGAL
}

function getAllKeywords(sector) {
  return Object.values(getSectorConfig(sector).categories).flat()
}

function calculateScore(sector, matchedKeywords) {
  const { categories } = getSectorConfig(sector)
  let score = 0
  let totalWeight = 0

  Object.entries(CATEGORY_WEIGHTS).forEach(([category, weight]) => {
    const categoryKeywords = categories[category] || []
    const matchesInCategory = matchedKeywords.filter(keyword => categoryKeywords.includes(keyword)).length

    if (matchesInCategory > 0) {
      score += Math.min(matchesInCategory, 3) * weight * 33.33
      totalWeight += weight
    }
  })

  if (totalWeight > 0) {
    return Math.min(100, Math.round(score / totalWeight))
  }

  return 0
}

export function analyzeTenderForSector(sector, title = '', description = '', pdfText = '') {
  const normalizedSector = normalizeServiceSector(sector) || 'LEGAL'
  const fullText = `${title} ${description} ${pdfText}`.toLowerCase()
  const matchedKeywords = new Set()

  getAllKeywords(normalizedSector).forEach(keyword => {
    if (fullText.includes(keyword.toLowerCase())) {
      matchedKeywords.add(keyword)
    }
  })

  const resolvedKeywords = Array.from(matchedKeywords)

  return {
    sector: normalizedSector,
    isSectorOpportunity: resolvedKeywords.length > 0,
    matchedKeywords: resolvedKeywords,
    matchCount: resolvedKeywords.length,
    score: calculateScore(normalizedSector, resolvedKeywords),
  }
}

export function getRelevantKeywordsForSector(sector, matchedKeywords, limit = 5) {
  const { categories } = getSectorConfig(sector)
  const priority = [
    ...(categories.panels || []),
    ...(categories.roles || []),
    ...(categories.qualifications || []),
    ...(categories.core || []),
    ...(categories.services || []),
  ]

  return [...matchedKeywords]
    .sort((left, right) => priority.indexOf(left) - priority.indexOf(right))
    .slice(0, limit)
}

export function identifyPracticeAreaForSector(sector, matchedKeywords) {
  const { practiceAreaKeywords, defaultPracticeArea } = getSectorConfig(sector)

  for (const [practiceArea, keywords] of Object.entries(practiceAreaKeywords)) {
    if (matchedKeywords.some(keyword => keywords.includes(keyword))) {
      return practiceArea
    }
  }

  return defaultPracticeArea
}

export function getDefaultPracticeAreaForSector(sector) {
  return getSectorConfig(sector).defaultPracticeArea
}

export function analyzeForLegalOpportunity(title = '', description = '', pdfText = '') {
  return analyzeTenderForSector('LEGAL', title, description, pdfText)
}

export function getRelevantKeywords(matchedKeywords, limit = 5) {
  return getRelevantKeywordsForSector('LEGAL', matchedKeywords, limit)
}

export function identifyPracticeArea(matchedKeywords) {
  return identifyPracticeAreaForSector('LEGAL', matchedKeywords)
}
