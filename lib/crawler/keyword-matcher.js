import { normalizeServiceSector } from '@/lib/service-sectors'
import { getLegalTenderMatchDetails } from '@/lib/matching/sector-matcher'

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

const KEYWORD_CONFIG_ALIASES = {
  LEGAL_SERVICES: 'LEGAL',
  FINANCIAL_SERVICES: 'ACCOUNTING',
}

function resolveKeywordSector(sector) {
  const normalizedSector = normalizeServiceSector(sector)
  if (!normalizedSector) return null

  const configKey = KEYWORD_CONFIG_ALIASES[normalizedSector] || normalizedSector

  return SECTOR_KEYWORD_CONFIGS[configKey] ? configKey : null
}

function getSectorConfig(sector) {
  const configKey = resolveKeywordSector(sector)
  return configKey ? SECTOR_KEYWORD_CONFIGS[configKey] : null
}

function getAllKeywords(sector) {
  const config = getSectorConfig(sector)
  return config ? Object.values(config.categories).flat() : []
}

function calculateScore(sector, matchedKeywords) {
  const config = getSectorConfig(sector)
  if (!config) return 0

  const { categories } = config
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

function escapeRegExp(value) {
  const pattern = typeof value === 'string'
    ? value
    : (value === null || value === undefined ? '' : String(value))

  return pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesKeyword(text, keyword) {
  const normalizedKeyword = String(keyword ?? '').toLowerCase().trim()
  if (!normalizedKeyword) return false

  const phrasePattern = normalizedKeyword
    .split(/\s+/)
    .map(escapeRegExp)
    .join('\\s+')
  const keywordPattern = new RegExp(`(^|[^a-z0-9])${phrasePattern}(?=$|[^a-z0-9])`, 'i')

  return keywordPattern.test(text)
}

export function analyzeTenderForSector(sector, title = '', description = '', pdfText = '') {
  const normalizedSector = normalizeServiceSector(sector)
  if (!normalizedSector) {
    return {
      sector: null,
      isSectorOpportunity: false,
      matchedKeywords: [],
      matchCount: 0,
      score: 0,
    }
  }

  const resolvedSector = resolveKeywordSector(normalizedSector)
  if (resolvedSector === 'LEGAL') {
    const legalDetails = getLegalTenderMatchDetails({ title, description, pdfText })
    const matchedKeywords = legalDetails.matchedLegalSignals
    const score = legalDetails.isLegal
      ? Math.min(100, Math.max(65, 50 + (matchedKeywords.length * 15)))
      : 0

    return {
      sector: normalizedSector,
      isSectorOpportunity: legalDetails.isLegal,
      matchedKeywords,
      matchCount: matchedKeywords.length,
      score,
    }
  }

  const fullText = `${title} ${description} ${pdfText}`.toLowerCase()
  const matchedKeywords = new Set()

  getAllKeywords(normalizedSector).forEach(keyword => {
    if (matchesKeyword(fullText, keyword)) {
      matchedKeywords.add(keyword)
    }
  })

  const resolvedKeywords = Array.from(matchedKeywords)
  const score = calculateScore(normalizedSector, resolvedKeywords)

  return {
    sector: normalizedSector,
    isSectorOpportunity: resolvedKeywords.length > 0,
    matchedKeywords: resolvedKeywords,
    matchCount: resolvedKeywords.length,
    score,
  }
}

export function getRelevantKeywordsForSector(sector, matchedKeywords, limit = 5) {
  const config = getSectorConfig(sector)
  if (!config) return []

  const { categories } = config
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
  const config = getSectorConfig(sector)
  if (!config) return 'General Services'
  const resolvedSector = resolveKeywordSector(sector)

  if (resolvedSector === 'LEGAL') {
    const evidence = matchedKeywords.join(' ').toLowerCase()

    if (/\bdebt|outstanding|arrear|recover/.test(evidence)) return 'Debt collection'
    if (/\blitigation|arbitration|dispute|representation|prosecution|legal opinion/.test(evidence)) return 'Litigation and disputes'
    if (/\blabour|employment/.test(evidence)) return 'Labour and employment'
    if (/\bproperty|conveyancing/.test(evidence)) return 'Property and conveyancing'
    if (/\bregulatory/.test(evidence)) return 'Regulatory and compliance'
    if (/\bcommercial|contract/.test(evidence)) return 'Commercial and contracts'

    return config.defaultPracticeArea
  }

  const { practiceAreaKeywords, defaultPracticeArea } = config

  for (const [practiceArea, keywords] of Object.entries(practiceAreaKeywords)) {
    if (matchedKeywords.some(keyword => keywords.includes(keyword))) {
      return practiceArea
    }
  }

  return defaultPracticeArea
}

export function getDefaultPracticeAreaForSector(sector) {
  return getSectorConfig(sector)?.defaultPracticeArea || 'General Services'
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
