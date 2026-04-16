/**
 * Keywords that indicate a legal opportunity
 * These are searched case-insensitively across tender title, description, and PDF content
 */
const LEGAL_KEYWORDS = {
  // Direct legal terminology
  legal: ['legal', 'lawyer', 'attorney', 'advocate', 'solicitor', 'counsel'],
  qualifications: ['legal qualification', 'legal expertise', 'admitted attorney', 'admitted advocate', 'law degree'],

  // Specific legal roles and services
  roles: [
    'investigator', 'investigation',
    'debt collection', 'debt collector',
    'disciplinary hearing', 'disciplinary panel',
    'prosecutor', 'prosecution',
    'compliance officer', 'legal compliance',
    'legal advisor', 'legal consultant',
    'legal counsel', 'legal services'
  ],

  // Service panels for legal professionals
  panels: [
    'panel of attorneys',
    'panel of legal',
    'panel of lawyers',
    'panel of advocates',
    'panel of legal services',
    'panel of approved lawyers',
    'panel of approved attorneys',
    'legal services providers',
    'approved law firms'
  ],

  // Legal practice areas and services
  services: [
    'contract review',
    'contract drafting',
    'legal review',
    'legal drafting',
    'litigation',
    'dispute resolution',
    'alternative dispute resolution',
    'arbitration',
    'mediation',
    'compliance review',
    'regulatory advice',
    'intellectual property',
    'patent',
    'trademark',
    'copyright',
    'corporate law',
    'commercial law',
    'employment law',
    'labour law',
    'administrative law',
    'constitutional law',
    'tax advice',
    'property law',
    'conveyancing',
    'wills and estates',
    'family law',
    'criminal law',
    'appeals',
    'legal opinion'
  ]
};

/**
 * Flattens all keywords into a single array
 */
function getAllKeywords() {
  return Object.values(LEGAL_KEYWORDS).flat();
}

/**
 * Analyzes text to determine if it contains legal-related keywords
 * Returns object with results
 */
export function analyzeForLegalOpportunity(title = '', description = '', pdfText = '') {
  const fullText = `${title} ${description} ${pdfText}`.toLowerCase();

  const matchedKeywords = new Set();
  const keywords = getAllKeywords();

  // Search for each keyword in the full text
  keywords.forEach(keyword => {
    if (fullText.includes(keyword.toLowerCase())) {
      matchedKeywords.add(keyword);
    }
  });

  const isLegalOpportunity = matchedKeywords.size > 0;

  return {
    isLegalOpportunity,
    matchedKeywords: Array.from(matchedKeywords),
    matchCount: matchedKeywords.size,
    score: calculateScore(Array.from(matchedKeywords))
  };
}

/**
 * Calculates a relevance score based on matched keywords
 * Weighted scoring for different keyword categories
 */
function calculateScore(matchedKeywords) {
  const weights = {
    legal: 0.2,
    qualifications: 0.25,
    roles: 0.2,
    panels: 0.3,
    services: 0.15
  };

  let score = 0;
  let totalWeight = 0;

  Object.entries(weights).forEach(([category, weight]) => {
    const categoryKeywords = LEGAL_KEYWORDS[category];
    const matchesInCategory = matchedKeywords.filter(kw =>
      categoryKeywords.includes(kw)
    ).length;

    if (matchesInCategory > 0) {
      score += Math.min(matchesInCategory, 3) * weight * 33.33; // Cap at 3 matches per category
      totalWeight += weight;
    }
  });

  // Normalize score to 0-100
  if (totalWeight > 0) {
    return Math.min(100, Math.round((score / totalWeight) / 1));
  }

  return 0;
}

/**
 * Gets the most relevant keywords for display
 */
export function getRelevantKeywords(matchedKeywords, limit = 5) {
  // Prioritize keywords in order of importance
  const priority = [
    ...LEGAL_KEYWORDS.panels,
    ...LEGAL_KEYWORDS.roles,
    ...LEGAL_KEYWORDS.qualifications,
    ...LEGAL_KEYWORDS.legal,
    ...LEGAL_KEYWORDS.services
  ];

  return matchedKeywords
    .sort((a, b) => priority.indexOf(a) - priority.indexOf(b))
    .slice(0, limit);
}

/**
 * Determines practice area based on matched keywords
 */
export function identifyPracticeArea(matchedKeywords) {
  const practiceAreas = {
    litigation: ['litigation', 'prosecutor', 'prosecution', 'dispute resolution', 'arbitration', 'appeals'],
    compliance: ['compliance', 'regulatory advice', 'legal compliance'],
    corporate: ['contract', 'corporate law', 'commercial law', 'intellectual property'],
    employment: ['employment law', 'labour law'],
    administrative: ['administrative law', 'disciplinary'],
    investigation: ['investigator', 'investigation'],
    debt: ['debt collection', 'debt collector'],
    general: ['legal', 'lawyer', 'attorney', 'legal services']
  };

  for (const [area, keywords] of Object.entries(practiceAreas)) {
    if (matchedKeywords.some(kw => keywords.includes(kw))) {
      return area.charAt(0).toUpperCase() + area.slice(1);
    }
  }

  return 'Legal Services';
}
