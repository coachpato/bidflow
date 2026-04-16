function compactWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function toTitleCase(value) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase())
}

function uniqueValues(values) {
  const seen = new Set()
  const unique = []

  for (const value of values) {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    unique.push(value)
  }

  return unique
}

export function parseLooseDate(value) {
  if (!value) return null

  const normalized = compactWhitespace(
    value
      .replace(/(\d)(st|nd|rd|th)\b/gi, '$1')
      .replace(/\bat\b/gi, ' ')
      .replace(/\bhrs?\b/gi, '')
      .replace(/\bh\b/gi, ':')
  )

  const direct = new Date(normalized)
  if (!Number.isNaN(direct.getTime())) return direct

  const numeric = normalized.match(
    /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\s+(\d{1,2})[:.](\d{2}))?/i
  )

  if (numeric) {
    const [, day, month, year, hour = '0', minute = '0'] = numeric
    const fullYear = year.length === 2 ? `20${year}` : year
    const parsed = new Date(
      Number(fullYear),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    )

    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  return null
}

function extractMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return compactWhitespace(match[1]).slice(0, 240)
  }

  return null
}

function extractCurrency(text) {
  const match = text.match(
    /(estimated value|contract value|bid value|budget(?: amount)?)[^R\d]{0,20}(R?\s?[\d.,\s]+)/i
  )

  if (!match?.[2]) return null

  const numeric = match[2].replace(/[^\d.,]/g, '').replace(/,/g, '')
  const parsed = Number.parseFloat(numeric)

  return Number.isFinite(parsed) ? parsed : null
}

function extractSummary(lines) {
  const summaryLines = lines
    .map(line => compactWhitespace(line))
    .filter(line => line.length >= 40 && line.length <= 220)
    .filter(line => !/^(tender|bid|rfq|closing date|contact person|email|tel)/i.test(line))
    .slice(0, 2)

  if (!summaryLines.length) return null

  return summaryLines.join(' ').slice(0, 320)
}

function extractRequirements(lines, normalizedText) {
  const canonicalRequirements = [
    { label: 'Tax Clearance Certificate (SARS)', patterns: ['tax clearance', 'tax compliance', 'sars'] },
    { label: 'CSD (Central Supplier Database) Registration', patterns: ['central supplier database', 'csd registration', 'csd report'] },
    { label: 'B-BBEE Certificate', patterns: ['b-bbee', 'bbbee', 'bbee certificate'] },
    { label: 'Company Registration Documents (CIPC)', patterns: ['cipc', 'company registration', 'registration documents'] },
    { label: 'Pricing Schedule', patterns: ['pricing schedule', 'price schedule', 'financial proposal', 'pricing proposal'] },
    { label: 'SBD 1 - Invitation to Bid', patterns: ['sbd 1'] },
    { label: 'SBD 4 - Declaration of Interest', patterns: ['sbd 4'] },
    { label: 'SBD 6.1 - Preference Points Claim', patterns: ['sbd 6.1'] },
    { label: "SBD 8 - Declaration of Bidder's Past Supply Chain Management Practices", patterns: ['sbd 8'] },
    { label: 'Technical Proposal / Methodology', patterns: ['technical proposal', 'methodology'] },
  ]

  const extracted = []

  for (const item of canonicalRequirements) {
    if (item.patterns.some(pattern => normalizedText.includes(pattern))) {
      extracted.push(item.label)
    }
  }

  for (const line of lines) {
    const cleaned = compactWhitespace(line.replace(/^[-*•\d.)\s]+/, ''))

    if (cleaned.length < 6 || cleaned.length > 150) continue
    if (/^(closing date|briefing date|contact person|email|tel|fax)/i.test(cleaned)) continue
    if (!/(sbd|certificate|registration|proposal|pricing|schedule|returnable|declaration|document|methodology|compliance|statement|cv|experience|insurance|briefing|site visit)/i.test(cleaned)) {
      continue
    }

    extracted.push(cleaned)
  }

  return uniqueValues(extracted).slice(0, 12)
}

function extractAppointments(normalizedText, fields) {
  const appointments = []

  if (fields.briefingDate) {
    const parsedDate = parseLooseDate(fields.briefingDate)
    appointments.push({
      type: 'briefing',
      title: 'Compulsory briefing',
      date: parsedDate ? parsedDate.toISOString() : fields.briefingDate,
      label: fields.briefingDate,
    })
  }

  const siteVisitText = extractMatch(normalizedText, [
    /site\s*visit(?:\s*date)?[:\s]+([0-9]{1,2}[\s\/.-][A-Za-z0-9]+[\s\/.-][0-9]{2,4}(?:\s+[0-9]{1,2}[:.][0-9]{2})?)/i,
    /compulsory\s*site\s*visit[:\s]+([0-9]{1,2}[\s\/.-][A-Za-z0-9]+[\s\/.-][0-9]{2,4}(?:\s+[0-9]{1,2}[:.][0-9]{2})?)/i,
  ])

  if (siteVisitText) {
    const parsedDate = parseLooseDate(siteVisitText)
    appointments.push({
      type: 'site_visit',
      title: 'Site visit',
      date: parsedDate ? parsedDate.toISOString() : siteVisitText,
      label: siteVisitText,
    })
  }

  if (fields.deadline) {
    const parsedDate = parseLooseDate(fields.deadline)
    appointments.push({
      type: 'deadline',
      title: 'Submission deadline',
      date: parsedDate ? parsedDate.toISOString() : fields.deadline,
      label: fields.deadline,
    })
  }

  return appointments
}

export function parseProcurementDocument(text) {
  const normalizedText = compactWhitespace(text.replace(/\n+/g, ' '))
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  const rawFields = {
    reference: extractMatch(normalizedText, [
      /tender\s*(?:number|no|ref(?:erence)?)[:\s]+([A-Z0-9\/-]+)/i,
      /bid\s*(?:number|no)[:\s]+([A-Z0-9\/-]+)/i,
      /rfq\s*(?:number|no)[:\s]+([A-Z0-9\/-]+)/i,
    ]),
    title: extractMatch(normalizedText, [
      /description\s*(?:of\s*services?)?[:\s]+(.{10,120}?)(?=\s{2,}|closing|deadline|contact|enquiries)/i,
      /subject[:\s]+(.{10,120}?)(?=\s{2,}|closing|deadline|contact)/i,
    ]),
    deadline: extractMatch(normalizedText, [
      /closing\s*date(?:\s*and\s*time)?[:\s]+([0-9]{1,2}[\s\/.-][A-Za-z0-9]+[\s\/.-][0-9]{2,4}(?:\s+[0-9]{1,2}[:.][0-9]{2})?)/i,
      /submission\s*deadline[:\s]+([0-9]{1,2}[\s\/.-][A-Za-z0-9]+[\s\/.-][0-9]{2,4}(?:\s+[0-9]{1,2}[:.][0-9]{2})?)/i,
    ]),
    briefingDate: extractMatch(normalizedText, [
      /compulsory\s*(?:site\s*)?briefing(?:\s*session)?[:\s]+([0-9]{1,2}[\s\/.-][A-Za-z0-9]+[\s\/.-][0-9]{2,4}(?:\s+[0-9]{1,2}[:.][0-9]{2})?)/i,
      /briefing\s*(?:session\s*)?date[:\s]+([0-9]{1,2}[\s\/.-][A-Za-z0-9]+[\s\/.-][0-9]{2,4}(?:\s+[0-9]{1,2}[:.][0-9]{2})?)/i,
    ]),
    siteVisitDate: extractMatch(normalizedText, [
      /site\s*visit(?:\s*date)?[:\s]+([0-9]{1,2}[\s\/.-][A-Za-z0-9]+[\s\/.-][0-9]{2,4}(?:\s+[0-9]{1,2}[:.][0-9]{2})?)/i,
    ]),
    contactPerson: extractMatch(normalizedText, [
      /contact\s*person[:\s]+([A-Za-z\s'.-]+?)(?=\s{2,}|tel|email|fax|enquiries)/i,
      /enquiries[:\s]+([A-Za-z\s'.-]+?)(?=\s{2,}|tel|email)/i,
    ]),
    contactEmail: extractMatch(normalizedText, [
      /e-?mail[:\s]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
    ]),
  }

  const fields = {
    ...rawFields,
    deadline: rawFields.deadline ? parseLooseDate(rawFields.deadline)?.toISOString() || rawFields.deadline : null,
    briefingDate: rawFields.briefingDate ? parseLooseDate(rawFields.briefingDate)?.toISOString() || rawFields.briefingDate : null,
    siteVisitDate: rawFields.siteVisitDate ? parseLooseDate(rawFields.siteVisitDate)?.toISOString() || rawFields.siteVisitDate : null,
    practiceArea: rawFields.title ? toTitleCase(rawFields.title.split(' ').slice(0, 4).join(' ')) : null,
    estimatedValue: extractCurrency(normalizedText),
    summary: extractSummary(lines),
  }

  return {
    fields,
    requirements: extractRequirements(lines, normalizedText.toLowerCase()),
    appointments: extractAppointments(normalizedText, rawFields),
    rawPreview: normalizedText.slice(0, 500),
  }
}
