export const SECTORS = [
  { value: 'agriculture', label: 'Agriculture', keywords: ['farming', 'agriculture', 'livestock', 'crop', 'irrigation', 'land'] },
  { value: 'construction', label: 'Construction', keywords: ['building', 'construction', 'infrastructure', 'roads', 'bridges', 'contractor', 'civil engineering'] },
  { value: 'education', label: 'Education', keywords: ['school', 'university', 'education', 'training', 'academic', 'college'] },
  { value: 'energy', label: 'Energy', keywords: ['solar', 'electricity', 'power', 'energy', 'renewable', 'generator'] },
  { value: 'finance', label: 'Finance', keywords: ['banking', 'insurance', 'financial', 'audit', 'accounting', 'tax'] },
  { value: 'healthcare', label: 'Healthcare', keywords: ['medical', 'hospital', 'health', 'clinic', 'pharmaceutical', 'laboratory'] },
  { value: 'it-technology', label: 'IT & Technology', keywords: ['software', 'hardware', 'technology', 'digital', 'systems', 'network', 'server'] },
  { value: 'legal', label: 'Legal', keywords: ['legal', 'law', 'attorney', 'litigation', 'compliance', 'regulatory'] },
  { value: 'manufacturing', label: 'Manufacturing', keywords: ['manufacturing', 'factory', 'production', 'industrial', 'machinery'] },
  { value: 'mining', label: 'Mining', keywords: ['mining', 'mineral', 'extraction', 'quarry', 'drilling'] },
  { value: 'professional-services', label: 'Professional Services', keywords: ['consulting', 'advisory', 'professional services', 'management'] },
  { value: 'security', label: 'Security', keywords: ['security', 'surveillance', 'guarding', 'alarm', 'access control'] },
  { value: 'telecommunications', label: 'Telecommunications', keywords: ['telecom', 'fiber', 'broadband', 'mobile', 'communications', 'network'] },
  { value: 'tourism', label: 'Tourism', keywords: ['tourism', 'hospitality', 'hotel', 'travel', 'conference'] },
  { value: 'transport-logistics', label: 'Transport & Logistics', keywords: ['transport', 'logistics', 'fleet', 'vehicle', 'shipping', 'freight'] },
  { value: 'water-sanitation', label: 'Water & Sanitation', keywords: ['water', 'sanitation', 'sewer', 'pipeline', 'treatment', 'dam'] },
]

export function getSectorByValue(value) {
  return SECTORS.find(sector => sector.value === value) || null
}

export function getSectorLabel(value) {
  return getSectorByValue(value)?.label || value
}

export function isValidSector(value) {
  return Boolean(getSectorByValue(value))
}
