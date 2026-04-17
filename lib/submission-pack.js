import prisma from '@/lib/prisma'
import { expireCacheTags, tenderPackCacheTag } from '@/lib/cache-tags'

const GENERATED_DOCUMENT_TYPES = [
  'Cover Letter',
  'Methodology',
  'Company Profile',
  'CV Summaries',
]

function formatDate(value) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatMoney(value) {
  if (value === null || value === undefined) return 'Not stated'
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value)
}

function joinList(values, fallback = 'Not specified yet') {
  if (!Array.isArray(values) || values.length === 0) return fallback
  return values.join(', ')
}

function getChecklistStats(tender) {
  const total = tender.checklistItems.length
  const completed = tender.checklistItems.filter(item => item.done).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return {
    total,
    completed,
    percent,
  }
}

function getExperienceHighlights(experiences, limit = 3) {
  return experiences
    .slice(0, limit)
    .map(experience => {
      const period = [experience.startedYear, experience.completedYear].filter(Boolean).join(' - ')
      const value = experience.projectValue ? ` | ${formatMoney(experience.projectValue)}` : ''
      const practiceArea = experience.practiceArea || experience.workType || 'Relevant legal work'
      return `- ${experience.matterName} (${practiceArea}${period ? ` | ${period}` : ''}${value})`
    })
    .join('\n')
}

function getPeopleHighlights(people, limit = 5) {
  return people
    .slice(0, limit)
    .map(person => {
      const qualifications = joinList(person.qualifications, 'Qualifications to be added')
      const years = person.yearsExperience ? `${person.yearsExperience} years` : 'Experience to be confirmed'
      const title = person.title || 'Legal professional'
      return `- ${person.fullName} | ${title} | ${years} | ${qualifications}`
    })
    .join('\n')
}

function getRequirementsBlock(requirements) {
  if (!requirements.length) {
    return '- No structured submission requirements are stored yet.'
  }

  return requirements.map(requirement => `- ${requirement.label}`).join('\n')
}

function buildCoverLetter({ tender, firmProfile, qualification }) {
  const signatory = firmProfile.primaryContactName || firmProfile.displayName
  const manualItems = [
    'Confirm the named signatory and signature block.',
    'Tailor the opening paragraph to the exact organ of state and opportunity context.',
  ]

  return {
    documentType: 'Cover Letter',
    title: 'Draft Cover Letter',
    requiresManualInput: true,
    manualInputSummary: manualItems.join(' '),
    content: [
      `${firmProfile.displayName}`,
      `${firmProfile.primaryContactEmail || ''}`,
      `${firmProfile.primaryContactPhone || ''}`,
      '',
      `Date: ${formatDate(new Date())}`,
      '',
      `To: ${tender.entity}`,
      `Reference: ${tender.reference || 'To be inserted'}`,
      '',
      `RE: ${tender.title}`,
      '',
      `We submit this cover letter in support of ${firmProfile.displayName}'s response to the above opportunity.`,
      '',
      `${firmProfile.displayName} is a legal practice focused on ${joinList(firmProfile.practiceAreas)}. We understand the submission deadline is ${formatDate(tender.deadline)} and have assembled the accompanying response pack for consideration.`,
      '',
      qualification?.summary
        ? `Internal qualification note: ${qualification.summary}`
        : 'Internal qualification note: Bidflow has not yet stored a qualification narrative for this pursuit.',
      '',
      'Manual completion required:',
      ...manualItems.map(item => `- ${item}`),
      '',
      `Yours faithfully,`,
      signatory,
      firmProfile.displayName,
    ].filter(Boolean).join('\n'),
  }
}

function buildMethodology({ tender, firmProfile, people, experiences, requirements }) {
  const manualItems = [
    'Tailor the workplan and staffing approach to the tender scope.',
    'Confirm service levels, reporting cadence, and any pricing-linked assumptions.',
  ]

  return {
    documentType: 'Methodology',
    title: 'Draft Methodology',
    requiresManualInput: true,
    manualInputSummary: manualItems.join(' '),
    content: [
      '# Proposed Methodology',
      '',
      `Opportunity: ${tender.title}`,
      `Issuing entity: ${tender.entity}`,
      '',
      '## Understanding of the brief',
      tender.description || 'Insert a pursuit-specific summary of the legal services required.',
      '',
      '## Proposed delivery approach',
      `Bidflow has prepared this starting draft using ${firmProfile.displayName}'s current profile, representative matters, and stored team credentials.`,
      '',
      '1. Mobilise the lead legal team and confirm governance, reporting lines, and conflict checks.',
      '2. Review the full instruction set, regulatory context, and urgency requirements issued by the client.',
      '3. Deliver the required legal work through the assigned subject-matter leads with partner oversight.',
      '4. Provide reporting, risk escalation, and document handover in line with the client timeline.',
      '',
      '## Team capability snapshot',
      getPeopleHighlights(people, 4) || '- Add key personnel in the firm workspace.',
      '',
      '## Representative matters',
      getExperienceHighlights(experiences, 3) || '- Add relevant experience records in the firm workspace.',
      '',
      '## Requirements already captured',
      getRequirementsBlock(requirements),
      '',
      '## Manual completion required',
      ...manualItems.map(item => `- ${item}`),
    ].join('\n'),
  }
}

function buildCompanyProfile({ tender, firmProfile, experiences }) {
  const manualItems = [
    'Insert current office addresses, registration details, and final branding language.',
  ]

  return {
    documentType: 'Company Profile',
    title: 'Draft Company Profile',
    requiresManualInput: true,
    manualInputSummary: manualItems.join(' '),
    content: [
      '# Company Profile',
      '',
      `Practice name: ${firmProfile.displayName}`,
      `Legal name: ${firmProfile.legalName || 'To be confirmed'}`,
      `Registration number: ${firmProfile.registrationNumber || 'To be inserted'}`,
      `Primary contact: ${firmProfile.primaryContactName || 'To be inserted'}`,
      `Contact email: ${firmProfile.primaryContactEmail || 'To be inserted'}`,
      `Contact phone: ${firmProfile.primaryContactPhone || 'To be inserted'}`,
      `Website: ${firmProfile.website || 'Not supplied'}`,
      '',
      '## Practice focus',
      firmProfile.overview || `${firmProfile.displayName} provides legal services across ${joinList(firmProfile.practiceAreas)}.`,
      '',
      '## Preferred public-sector focus',
      `Preferred entities: ${joinList(firmProfile.preferredEntities)}`,
      `Target work types: ${joinList(firmProfile.targetWorkTypes)}`,
      `Target provinces: ${joinList(firmProfile.targetProvinces)}`,
      `Target contract band: ${formatMoney(firmProfile.minimumContractValue)} to ${formatMoney(firmProfile.maximumContractValue)}`,
      '',
      '## Representative matters',
      getExperienceHighlights(experiences, 5) || '- Add representative matters in the firm workspace.',
      '',
      `Prepared for pursuit: ${tender.title}`,
      '',
      '## Manual completion required',
      ...manualItems.map(item => `- ${item}`),
    ].join('\n'),
  }
}

function buildCvSummaries({ people }) {
  const hasPeople = people.length > 0
  const manualItems = hasPeople
    ? ['Confirm the final nominated team and order of seniority.']
    : ['Add key personnel records in the firm workspace before using this draft.']

  return {
    documentType: 'CV Summaries',
    title: 'Draft CV Summaries',
    requiresManualInput: true,
    manualInputSummary: manualItems.join(' '),
    content: [
      '# CV Summaries',
      '',
      hasPeople
        ? getPeopleHighlights(people, 6)
        : '- No key personnel are configured yet.',
      '',
      '## Manual completion required',
      ...manualItems.map(item => `- ${item}`),
    ].join('\n'),
  }
}

function buildDrafts({ tender, organization, qualification }) {
  const firmProfile = organization.firmProfile
  const people = organization.firmPeople || []
  const experiences = organization.firmExperiences || []
  const requirements = tender.requirements || []

  return [
    buildCoverLetter({ tender, firmProfile, qualification }),
    buildMethodology({ tender, firmProfile, people, experiences, requirements }),
    buildCompanyProfile({ tender, firmProfile, experiences }),
    buildCvSummaries({ people }),
  ]
}

function buildMissingItems({ tender, qualification, generatedDocuments }) {
  const missing = []
  const incompleteChecklist = tender.checklistItems.filter(item => !item.done)
  const missingDocTypes = GENERATED_DOCUMENT_TYPES.filter(type =>
    !generatedDocuments.some(document => document.documentType === type)
  )

  if ((qualification?.verdict || '') === 'Do Not Bid') {
    missing.push('Critical qualification blockers still need attention before submission should continue.')
  }

  if (incompleteChecklist.length > 0) {
    missing.push(...incompleteChecklist.slice(0, 4).map(item => `Checklist incomplete: ${item.label}`))
  }

  if (tender.requirements.length === 0) {
    missing.push('Structured submission requirements have not been captured yet.')
  }

  if (tender.documents.length === 0) {
    missing.push('No source tender documents are attached to this pursuit.')
  }

  if (missingDocTypes.length > 0) {
    missing.push(...missingDocTypes.map(type => `Draft still needed: ${type}`))
  }

  generatedDocuments
    .filter(document => document.requiresManualInput)
    .forEach(document => {
      missing.push(`Manual review required: ${document.documentType}`)
    })

  return Array.from(new Set(missing))
}

function deriveSubmissionPackState({
  qualification,
  checklistPercent,
  generatedDocuments,
  requiredDocumentCount,
}) {
  const reviewedCount = generatedDocuments.filter(document => document.status === 'Reviewed').length
  const manualInputCount = generatedDocuments.filter(document => document.requiresManualInput).length
  const draftCoverage = requiredDocumentCount > 0
    ? Math.round((generatedDocuments.length / requiredDocumentCount) * 100)
    : 100
  const reviewedCoverage = requiredDocumentCount > 0
    ? Math.round((reviewedCount / requiredDocumentCount) * 100)
    : 100
  const qualificationReadiness = qualification?.readinessPercent ?? 0
  const readinessPercent = Math.round(
    (checklistPercent * 0.35) +
    (draftCoverage * 0.25) +
    (reviewedCoverage * 0.15) +
    (qualificationReadiness * 0.25)
  )

  let status = 'Draft'

  if ((qualification?.verdict || '') === 'Do Not Bid') {
    status = 'Blocked'
  } else if (generatedDocuments.length === 0) {
    status = 'Draft'
  } else if (checklistPercent === 100 && reviewedCount === requiredDocumentCount && manualInputCount === 0) {
    status = 'Ready for Submission'
  } else if (reviewedCount === requiredDocumentCount) {
    status = 'Ready for Review'
  } else {
    status = 'In Progress'
  }

  return {
    status,
    readinessPercent,
    reviewedCount,
    manualInputCount,
  }
}

function buildPackSummary({ status, missingItems, qualification, generatedDocuments }) {
  if (status === 'Blocked') {
    return qualification?.summary || 'The submission pack is blocked by unresolved qualification issues.'
  }

  if (status === 'Ready for Submission') {
    return 'The draft pack is complete, reviewed, and aligned with the current checklist.'
  }

  if (status === 'Ready for Review') {
    return 'All core drafts are present. Final partner review and manual checks should happen before submission.'
  }

  if (generatedDocuments.length === 0) {
    return 'Generate the first draft set to start building the submission pack.'
  }

  if (missingItems.length > 0) {
    return `The pack still has gaps: ${missingItems.slice(0, 2).join(' ')}`.trim()
  }

  return 'The pack is in progress and needs final drafting or checklist completion.'
}

export async function refreshSubmissionPack({
  tenderId,
  organizationId,
  regenerate = false,
}) {
  const tender = await prisma.tender.findFirst({
    where: {
      id: tenderId,
      organizationId,
    },
    include: {
      opportunity: {
        select: {
          title: true,
          sourceUrl: true,
          estimatedValue: true,
        },
      },
      documents: true,
      checklistItems: true,
      requirements: { orderBy: { label: 'asc' } },
      qualification: {
        include: {
          checks: { orderBy: { sortOrder: 'asc' } },
        },
      },
      generatedDocuments: { orderBy: [{ documentType: 'asc' }, { updatedAt: 'desc' }] },
    },
  })

  if (!tender) {
    throw new Error('Tender not found.')
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      firmProfile: true,
      firmPeople: { orderBy: { yearsExperience: 'desc' } },
      firmExperiences: { orderBy: [{ completedYear: 'desc' }, { matterName: 'asc' }] },
    },
  })

  if (!organization?.firmProfile) {
    throw new Error('Organization firm profile not found.')
  }

  const drafts = buildDrafts({
    tender,
    organization,
    qualification: tender.qualification,
  })

  await prisma.$transaction(async tx => {
    const existingByType = new Map(
      tender.generatedDocuments.map(document => [document.documentType, document])
    )

    for (const draft of drafts) {
      const existing = existingByType.get(draft.documentType)

      if (!existing) {
        await tx.generatedDocument.create({
          data: {
            tenderId,
            documentType: draft.documentType,
            title: draft.title,
            content: draft.content,
            status: 'Draft',
            requiresManualInput: draft.requiresManualInput,
            manualInputSummary: draft.manualInputSummary,
          },
        })
        continue
      }

      if (regenerate) {
        await tx.generatedDocument.update({
          where: { id: existing.id },
          data: {
            title: draft.title,
            content: draft.content,
            status: 'Draft',
            requiresManualInput: draft.requiresManualInput,
            manualInputSummary: draft.manualInputSummary,
          },
        })
        continue
      }

      await tx.generatedDocument.update({
        where: { id: existing.id },
        data: {
          title: draft.title,
          requiresManualInput: draft.requiresManualInput,
          manualInputSummary: draft.manualInputSummary,
        },
      })
    }
  })

  const generatedDocuments = await prisma.generatedDocument.findMany({
    where: { tenderId },
    orderBy: [{ documentType: 'asc' }, { updatedAt: 'desc' }],
  })

  const checklistStats = getChecklistStats(tender)
  const state = deriveSubmissionPackState({
    qualification: tender.qualification,
    checklistPercent: tender.qualification?.checklistCompletionPercent ?? checklistStats.percent,
    generatedDocuments,
    requiredDocumentCount: GENERATED_DOCUMENT_TYPES.length,
  })
  const missingItems = buildMissingItems({
    tender,
    qualification: tender.qualification,
    generatedDocuments,
  })
  const summary = buildPackSummary({
    status: state.status,
    missingItems,
    qualification: tender.qualification,
    generatedDocuments,
  })

  await prisma.submissionPack.upsert({
    where: { tenderId },
    update: {
      status: state.status,
      readinessPercent: state.readinessPercent,
      checklistCompletionPercent: tender.qualification?.checklistCompletionPercent ?? checklistStats.percent,
      generatedDocumentCount: generatedDocuments.length,
      reviewedDocumentCount: state.reviewedCount,
      manualInputCount: state.manualInputCount,
      requiredDocumentCount: GENERATED_DOCUMENT_TYPES.length,
      summary,
      missingItems,
    },
    create: {
      tenderId,
      status: state.status,
      readinessPercent: state.readinessPercent,
      checklistCompletionPercent: tender.qualification?.checklistCompletionPercent ?? checklistStats.percent,
      generatedDocumentCount: generatedDocuments.length,
      reviewedDocumentCount: state.reviewedCount,
      manualInputCount: state.manualInputCount,
      requiredDocumentCount: GENERATED_DOCUMENT_TYPES.length,
      summary,
      missingItems,
    },
  })

  await expireCacheTags(
    tenderPackCacheTag(organizationId, tenderId)
  )

  return prisma.submissionPack.findUnique({
    where: { tenderId },
  })
}

export { GENERATED_DOCUMENT_TYPES }
