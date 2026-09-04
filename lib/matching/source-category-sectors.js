function normalizeCategory(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

const ETENDERS_CATEGORY_SECTOR_RULES = [
  { sectors: ['agriculture'], patterns: [/\bagricultur/, /\bfarming\b/, /\bforestry\b/, /\bfishing\b/] },
  {
    sectors: ['construction'],
    patterns: [
      /^construction$/,
      /\bconstruction of buildings\b/,
      /\bspecialised construction\b/,
      /\bcivil engineering\b/,
      /^services: civil$/,
      /^services: building$/,
      /\barchitectural and engineering activities\b/,
    ],
  },
  { sectors: ['education'], patterns: [/^education$/, /\btraining\b/] },
  {
    sectors: ['energy'],
    patterns: [
      /^services: electrical$/,
      /\belectricity\b/,
      /\bgas\b/,
      /\bsteam\b/,
      /\bair conditioning\b/,
      /\bsupplies: electrical equipment\b/,
      /\bmanufacture of electrical equipment\b/,
    ],
  },
  {
    sectors: ['finance'],
    patterns: [
      /\baccounting\b/,
      /\baudit\b/,
      /\bfinancial\b/,
      /\binsurance\b/,
      /\bpension funding\b/,
      /\bactivities auxiliary to financial service\b/,
    ],
  },
  {
    sectors: ['healthcare'],
    patterns: [/\bhuman health\b/, /\bsocial work\b/, /\bsupplies: medical\b/, /\bpharmaceutical\b/, /\bmedical\b/],
  },
  {
    sectors: ['it-technology'],
    patterns: [
      /\binformation and communication\b/,
      /\binformation service activities\b/,
      /\bcomputer programming\b/,
      /\bcomputer equipment\b/,
      /\bcomputer, electronic and optical products\b/,
      /\bpublishing activities\b/,
      /\bprogramming and broadcasting activities\b/,
    ],
  },
  {
    sectors: ['manufacturing'],
    patterns: [/^manufacturing$/, /\bmanufacture of\b/, /\bprinting and reproduction\b/, /\brepair and installation of machinery\b/],
  },
  { sectors: ['mining'], patterns: [/\bmining\b/, /\bquarrying\b/] },
  {
    sectors: ['professional-services'],
    patterns: [
      /^services: professional$/,
      /\bprofessional, scientific and technical activities\b/,
      /\bother professional, scientific and technical activities\b/,
      /\bmanagement consultancy\b/,
      /\bscientific research and development\b/,
      /\badvertising and market research\b/,
      /\boffice administrative\b/,
      /\boffice support\b/,
      /\bother business support activities\b/,
      /\bactivities of head offices\b/,
      /\brental and leasing activities\b/,
      /\breal estate activities\b/,
    ],
  },
  {
    sectors: ['security'],
    patterns: [/\bsecurity and investigation activities\b/, /\bsecurity services\b/, /\bservices: functional .*security services\b/],
  },
  { sectors: ['telecommunications'], patterns: [/^telecommunications$/, /\btelecom/] },
  {
    sectors: ['tourism'],
    patterns: [
      /^accommodation$/,
      /\bfood and beverage service activities\b/,
      /\btravel agency\b/,
      /\btour operator\b/,
      /\breservation service\b/,
      /\barts, entertainment and recreation\b/,
      /\bsports activities\b/,
      /\bamusement and recreation activities\b/,
      /\bcreative, arts and entertainment activities\b/,
      /\bmotion picture\b/,
      /\bmusic publishing\b/,
    ],
  },
  {
    sectors: ['transport-logistics'],
    patterns: [
      /\btransportation and storage\b/,
      /\bland transport\b/,
      /\btransport via pipelines\b/,
      /\bair transport\b/,
      /\bwater transport\b/,
      /\bwarehousing\b/,
      /\bpostal and courier\b/,
      /\bmotor vehicles\b/,
      /\btrailers and semi-trailers\b/,
    ],
  },
  {
    sectors: ['water-sanitation'],
    patterns: [
      /\bwater supply\b/,
      /\bwater collection\b/,
      /\bwater management\b/,
      /\bsewerage\b/,
      /\bsanitation\b/,
      /\bwaste management\b/,
      /\bwaste collection\b/,
      /\bwaste treatment\b/,
      /\bdisposal activities\b/,
      /\bmaterials recovery\b/,
      /\bremediation activities\b/,
    ],
  },
]

export function getSectorsForEtendersCategory(category) {
  const normalizedCategory = normalizeCategory(category)
  if (!normalizedCategory) return []

  const sectors = new Set()

  for (const rule of ETENDERS_CATEGORY_SECTOR_RULES) {
    if (rule.patterns.some(pattern => pattern.test(normalizedCategory))) {
      rule.sectors.forEach(sector => sectors.add(sector))
    }
  }

  return Array.from(sectors)
}
