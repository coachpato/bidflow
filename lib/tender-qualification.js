import { PDFParse } from 'pdf-parse'
import prisma from '@/lib/prisma'
import { getDaysUntil, getComplianceStatus } from '@/lib/compliance-status'
import { parseProcurementDocument } from '@/lib/procurement-parser'
import { buildTenderChecklistItems } from '@/lib/tender-defaults'
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

const QUALIFICATION_VERDICTS = {
  qualified: 'Qualified',
  borderline: 'Borderline',
  doNotBid: 'Do Not Bid',
}

const CHECK_STATUS = {
  pass: 'pass',
  warning: 'warning',
  fail: 'fail',
  info: 'info',
}

const CHECK_SEVERITY = {
  critical: 'critical',
  warning: 'warning',
  info: 'info',
}

function normalizeText(value) {
  return value?.toString().trim().toLowerCase() || ''
}

function normalizeLabel(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, ' ').trim()
}

function uniqueLabels(values) {
  const seen = new Set()
  const result = []

  for (const value of values) {
    const label = typeof value === 'string' ? value : value?.label
    const normalized = normalizeLabel(label)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(typeof value === 'string' ? { label } : value)
  }

  return result
}

function extractStringRequirements(values) {
  if (!Array.isArray(values)) return []

  return values
    .map(item => {
      if (typeof item === 'string') return item.trim()
      return item?.label?.trim() || ''
    })
    .filter(Boolean)
}

function getStoragePathFromPublicUrl(filepath) {
  const urlParts = filepath?.split(`/object/public/${STORAGE_BUCKET}/`)
  if (!urlParts || urlParts.length < 2) return null
  return urlParts[1]
}

function getChecklistCompletion(tender) {
  const total = tender.checklistItems.length
  const done = tender.checklistItems.filter(item => item.done).length
  const percent = total > 0 ? Math.round((done / total) * 100) : 0

  return { total, done, percent }
}

function getLatestDocument(tender) {
  return tender.documents
    .filter(document => document.filename?.toLowerCase().endsWith('.pdf'))
    .sort((left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime())[0] || null
}

function matchesAny(values, sourceText) {
  const haystack = normalizeText(sourceText)
  if (!haystack) return null

  return values.find(value => haystack.includes(normalizeText(value))) || null
}

function getOpportunityEstimatedValue(tender) {
  return tender.opportunity?.estimatedValue ?? null
}

function buildChecklistExtras(tender, parsedAppointments = []) {
  const extras = []

  if (tender.briefingDate) {
    extras.push({
      label: 'Attend compulsory briefing',
      dueDate: tender.briefingDate,
      notes: 'Synced from the pursuit timeline.',
    })
  }

  const siteVisitAppointment = parsedAppointments.find(appointment => appointment.type === 'site_visit')
  if (siteVisitAppointment) {
    extras.push({
      label: 'Attend site visit',
      dueDate: siteVisitAppointment.date ? new Date(siteVisitAppointment.date) : null,
      notes: 'Synced from parsed source material.',
    })
  }

  if (tender.deadline) {
    extras.push({
      label: 'Finalize submission pack',
      dueDate: tender.deadline,
      notes: 'Final review before submission deadline.',
    })
  }

  return extras
}

async function downloadAndParseTenderPdf(document) {
  if (!document) return null

  const storagePath = getStoragePathFromPublicUrl(document.filepath)
  if (!storagePath) return null

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(storagePath)

  if (error || !data) {
    throw new Error('Could not download file from storage')
  }

  const buffer = Buffer.from(await data.arrayBuffer())
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  await parser.destroy()

  return parseProcurementDocument(result.text)
}

export async function parseTenderDocumentSet(tenderId) {
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      documents: { orderBy: { uploadedAt: 'desc' } },
      opportunity: {
        select: {
          parsedRequirements: true,
          parsedAppointments: true,
        },
      },
    },
  })

  if (!tender) {
    throw new Error('Tender not found.')
  }

  const latestPdf = getLatestDocument(tender)
  if (!latestPdf) {
    return {
      parsed: null,
      syncedRequirements: [],
      appointments: [],
    }
  }

  const parsed = await downloadAndParseTenderPdf(latestPdf)
  const synced = await syncTenderRequirements({
    tenderId,
    parserOutput: parsed,
  })

  return {
    parsed,
    syncedRequirements: synced.requirements,
    appointments: synced.appointments,
  }
}

export async function syncTenderRequirements({ tenderId, parserOutput = null }) {
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      opportunity: {
        select: {
          parsedRequirements: true,
          parsedAppointments: true,
        },
      },
      checklistItems: true,
      requirements: true,
    },
  })

  if (!tender) {
    throw new Error('Tender not found.')
  }

  const opportunityRequirements = extractStringRequirements(tender.opportunity?.parsedRequirements)
  const parserRequirements = extractStringRequirements(parserOutput?.requirements)
  const mergedRequirements = uniqueLabels([
    ...opportunityRequirements.map(label => ({ label, source: 'opportunity', notes: 'Imported from the source opportunity.' })),
    ...parserRequirements.map(label => ({ label, source: 'parser', notes: 'Extracted from the latest tender PDF.' })),
  ])

  const parserAppointments = Array.isArray(parserOutput?.appointments) ? parserOutput.appointments : []
  const checklistCandidates = buildTenderChecklistItems([
    ...mergedRequirements,
    ...buildChecklistExtras(tender, parserAppointments),
  ])

  const existingChecklistLabels = new Set(
    tender.checklistItems.map(item => normalizeLabel(item.label))
  )

  await prisma.$transaction(async tx => {
    await tx.tenderRequirement.deleteMany({ where: { tenderId } })

    if (mergedRequirements.length > 0) {
      await tx.tenderRequirement.createMany({
        data: mergedRequirements.map(requirement => ({
          tenderId,
          label: requirement.label,
          source: requirement.source || 'parser',
          notes: requirement.notes || null,
        })),
      })
    }

    const checklistToCreate = checklistCandidates.filter(item =>
      !existingChecklistLabels.has(normalizeLabel(item.label))
    )

    if (checklistToCreate.length > 0) {
      await tx.tenderChecklistItem.createMany({
        data: checklistToCreate.map(item => ({
          tenderId,
          label: item.label,
          dueDate: item.dueDate || null,
          notes: item.notes || null,
          responsible: item.responsible || null,
        })),
      })
    }
  })

  return {
    requirements: mergedRequirements,
    appointments: parserAppointments,
  }
}

function buildQualificationChecks({
  tender,
  firmProfile,
  firmPeople,
  firmExperiences,
  complianceDocuments,
  requirements,
}) {
  const now = new Date()
  const { total, done, percent } = getChecklistCompletion(tender)
  const daysRemaining = tender.deadline ? getDaysUntil(tender.deadline) : null
  const sourceText = [
    tender.title,
    tender.description,
    tender.entity,
    tender.opportunity?.title,
    tender.opportunity?.summary,
    tender.opportunity?.practiceArea,
  ].filter(Boolean).join(' ')
  const normalizedSourceText = normalizeText(sourceText)

  const checks = []

  function addCheck(check) {
    checks.push({
      sortOrder: checks.length,
      ...check,
    })
  }

  function findComplianceDocument(type) {
    return complianceDocuments
      .filter(document => document.documentType === type)
      .sort((left, right) => {
        if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      })[0] || null
  }

  function addComplianceCheck({
    checkKey,
    label,
    documentType,
    severity = CHECK_SEVERITY.critical,
    recommendation,
    allowMissingExpiry = true,
    missingStatus = CHECK_STATUS.fail,
  }) {
    const document = findComplianceDocument(documentType)

    if (!document) {
      addCheck({
        checkKey,
        label,
        status: missingStatus,
        severity,
        detail: `${documentType} is not available in the compliance vault.`,
        recommendation,
      })
      return
    }

    const status = getComplianceStatus(document)
    const hasExpired = status.daysUntilExpiry !== null && status.daysUntilExpiry < 0
    const missingExpiry = !document.expiryDate && !allowMissingExpiry

    if (hasExpired || missingExpiry) {
      addCheck({
        checkKey,
        label,
        status: severity === CHECK_SEVERITY.warning ? CHECK_STATUS.warning : CHECK_STATUS.fail,
        severity,
        detail: hasExpired
          ? `${document.filename} is expired.`
          : `${document.filename} has no expiry date recorded.`,
        recommendation,
      })
      return
    }

    addCheck({
      checkKey,
      label,
      status: CHECK_STATUS.pass,
      severity,
      detail: `${document.filename} is on file${status.label ? ` (${status.label})` : ''}.`,
      recommendation,
    })
  }

  addComplianceCheck({
    checkKey: 'tax-clearance',
    label: 'Tax clearance is current',
    documentType: 'Tax Clearance',
    severity: CHECK_SEVERITY.critical,
    recommendation: 'Upload a current SARS tax clearance or tax compliance proof into the vault.',
  })

  addComplianceCheck({
    checkKey: 'csd-registration',
    label: 'CSD registration is on file',
    documentType: 'CSD Registration',
    severity: CHECK_SEVERITY.critical,
    recommendation: 'Upload the latest CSD registration proof before proceeding.',
  })

  addComplianceCheck({
    checkKey: 'bbbee',
    label: 'B-BBEE evidence is available',
    documentType: 'B-BBEE Certificate',
    severity: CHECK_SEVERITY.warning,
    recommendation: 'Add the latest B-BBEE certificate or affidavit for scoring support.',
  })

  const hasProfileBasics = Boolean(firmProfile?.overview) && (firmProfile?.practiceAreas?.length || 0) > 0
  addCheck({
    checkKey: 'firm-profile',
    label: 'Firm profile is complete enough for bid use',
    status: hasProfileBasics ? CHECK_STATUS.pass : CHECK_STATUS.warning,
    severity: CHECK_SEVERITY.warning,
    detail: hasProfileBasics
      ? 'Overview and practice areas are configured in the firm workspace.'
      : 'The firm profile still needs fuller narrative or practice-area detail.',
    recommendation: 'Complete the firm overview and practice areas to improve qualification and drafting quality.',
  })

  const matchedPracticeArea = matchesAny(firmProfile?.practiceAreas || [], sourceText)
    || matchesAny(firmProfile?.targetWorkTypes || [], sourceText)
  addCheck({
    checkKey: 'practice-area-alignment',
    label: 'Opportunity aligns with the firm focus',
    status: matchedPracticeArea || (tender.opportunity?.fitScore ?? 0) >= 60 ? CHECK_STATUS.pass : CHECK_STATUS.warning,
    severity: CHECK_SEVERITY.warning,
    detail: matchedPracticeArea
      ? `Matched against "${matchedPracticeArea}" from the firm profile.`
      : 'No direct practice-area match was found in the firm settings.',
    recommendation: 'Refine practice areas and target work types if this class of work should be prioritized.',
  })

  const experiencedPeople = firmPeople.filter(person => (person.yearsExperience ?? 0) >= 5 || (person.qualifications?.length ?? 0) > 0)
  addCheck({
    checkKey: 'legal-personnel',
    label: 'Key legal personnel are configured',
    status: experiencedPeople.length > 0 ? CHECK_STATUS.pass : firmPeople.length > 0 ? CHECK_STATUS.warning : CHECK_STATUS.fail,
    severity: experiencedPeople.length > 0 ? CHECK_SEVERITY.warning : CHECK_SEVERITY.critical,
    detail: experiencedPeople.length > 0
      ? `${experiencedPeople.length} team member${experiencedPeople.length === 1 ? '' : 's'} have experience or qualifications recorded.`
      : firmPeople.length > 0
        ? 'Personnel exist, but years of experience or qualifications still need work.'
        : 'No key personnel have been configured for the firm.',
    recommendation: 'Add key attorneys or specialists with experience and qualifications in the firm workspace.',
  })

  const matchedExperience = firmExperiences.find(experience =>
    [experience.practiceArea, experience.workType, experience.summary, experience.matterName]
      .filter(Boolean)
      .some(value => normalizedSourceText.includes(normalizeText(value)))
  )

  addCheck({
    checkKey: 'experience-evidence',
    label: 'Relevant experience evidence exists',
    status: matchedExperience ? CHECK_STATUS.pass : firmExperiences.length > 0 ? CHECK_STATUS.warning : CHECK_STATUS.warning,
    severity: CHECK_SEVERITY.warning,
    detail: matchedExperience
      ? `Matched to representative matter "${matchedExperience.matterName}".`
      : firmExperiences.length > 0
        ? 'Firm experience is captured, but not obviously aligned to this pursuit yet.'
        : 'No representative matters are stored in the firm workspace.',
    recommendation: 'Add or tag representative matters that support similar public-sector legal work.',
  })

  const estimatedValue = getOpportunityEstimatedValue(tender)
  if (estimatedValue && (firmProfile?.minimumContractValue || firmProfile?.maximumContractValue)) {
    const belowMinimum = firmProfile.minimumContractValue && estimatedValue < firmProfile.minimumContractValue
    const aboveMaximum = firmProfile.maximumContractValue && estimatedValue > firmProfile.maximumContractValue

    addCheck({
      checkKey: 'contract-value-fit',
      label: 'Estimated contract value fits target band',
      status: belowMinimum || aboveMaximum ? CHECK_STATUS.warning : CHECK_STATUS.pass,
      severity: CHECK_SEVERITY.warning,
      detail: belowMinimum
        ? `Estimated value of R ${estimatedValue.toLocaleString('en-ZA')} is below the firm target band.`
        : aboveMaximum
          ? `Estimated value of R ${estimatedValue.toLocaleString('en-ZA')} exceeds the firm target band.`
          : `Estimated value of R ${estimatedValue.toLocaleString('en-ZA')} fits the firm target band.`,
      recommendation: 'Adjust target contract values in the firm workspace if your pursuit appetite has changed.',
    })
  } else {
    addCheck({
      checkKey: 'contract-value-fit',
      label: 'Estimated contract value fit',
      status: CHECK_STATUS.info,
      severity: CHECK_SEVERITY.info,
      detail: 'No usable contract value was available for this pursuit.',
      recommendation: 'Capture an estimated value when it becomes available to sharpen qualification decisions.',
    })
  }

  addCheck({
    checkKey: 'requirements-extracted',
    label: 'Submission requirements are captured',
    status: requirements.length > 0 ? CHECK_STATUS.pass : CHECK_STATUS.warning,
    severity: CHECK_SEVERITY.warning,
    detail: requirements.length > 0
      ? `${requirements.length} requirement${requirements.length === 1 ? '' : 's'} are in the pursuit record.`
      : 'No machine-readable requirements are stored yet.',
    recommendation: 'Parse the latest tender PDF or review the source pack to build the requirement set.',
  })

  const briefingItem = tender.checklistItems.find(item => normalizeLabel(item.label).includes('attend compulsory briefing'))
  if (tender.briefingDate) {
    const briefingPassed = new Date(tender.briefingDate).getTime() < now.getTime()
    const briefingDone = Boolean(briefingItem?.done)

    addCheck({
      checkKey: 'briefing-attendance',
      label: 'Briefing requirement is under control',
      status: briefingDone ? CHECK_STATUS.pass : briefingPassed ? CHECK_STATUS.fail : CHECK_STATUS.warning,
      severity: briefingPassed && !briefingDone ? CHECK_SEVERITY.critical : CHECK_SEVERITY.warning,
      detail: briefingDone
        ? 'The compulsory briefing item is marked complete.'
        : briefingPassed
          ? 'The briefing date has passed and the checklist item is still incomplete.'
          : `A briefing is scheduled for ${new Date(tender.briefingDate).toLocaleString('en-ZA')}.`,
      recommendation: 'Assign and complete the briefing attendance item before the session closes.',
    })
  } else {
    addCheck({
      checkKey: 'briefing-attendance',
      label: 'Briefing requirement is under control',
      status: CHECK_STATUS.info,
      severity: CHECK_SEVERITY.info,
      detail: 'No compulsory briefing is recorded for this pursuit.',
      recommendation: null,
    })
  }

  const checklistStatus = percent === 100
    ? CHECK_STATUS.pass
    : daysRemaining !== null && daysRemaining <= 7
      ? CHECK_STATUS.fail
      : CHECK_STATUS.warning

  addCheck({
    checkKey: 'checklist-readiness',
    label: 'Submission checklist is on track',
    status: total === 0 ? CHECK_STATUS.warning : checklistStatus,
    severity: checklistStatus === CHECK_STATUS.fail ? CHECK_SEVERITY.critical : CHECK_SEVERITY.warning,
    detail: total === 0
      ? 'No checklist items are attached to the pursuit yet.'
      : `${done} of ${total} checklist item${total === 1 ? '' : 's'} are complete (${percent}%).`,
    recommendation: 'Use the checklist as the final submission control before the bid is sent.',
  })

  return {
    checks,
    checklistCompletionPercent: percent,
  }
}

function summarizeAssessment(verdict, checks) {
  const failing = checks.filter(check => check.status === CHECK_STATUS.fail)
  const warnings = checks.filter(check => check.status === CHECK_STATUS.warning)
  const summarizeIssues = items =>
    items
      .slice(0, 2)
      .map(check => check.detail || check.recommendation || check.label)
      .map(text => text.replace(/\.$/, ''))
      .join('; ')

  if (verdict === QUALIFICATION_VERDICTS.doNotBid) {
    if (failing.length > 0) {
      return `Critical blockers remain: ${summarizeIssues(failing)}.`
    }

    return 'Critical blockers remain and the pursuit should not move forward until they are resolved.'
  }

  if (verdict === QUALIFICATION_VERDICTS.borderline) {
    return warnings.length > 0
      ? `Proceed only after addressing: ${summarizeIssues(warnings)}.`
      : 'Proceed with caution and review the outstanding gaps.'
  }

  return 'Core compliance, capability, and readiness checks are in place for this pursuit.'
}

function deriveVerdict(checks, readinessPercent) {
  const blockerCount = checks.filter(check =>
    check.status === CHECK_STATUS.fail && check.severity === CHECK_SEVERITY.critical
  ).length

  const warningCount = checks.filter(check => check.status === CHECK_STATUS.warning).length
    + checks.filter(check =>
      check.status === CHECK_STATUS.fail && check.severity !== CHECK_SEVERITY.critical
    ).length

  if (blockerCount > 0) {
    return {
      verdict: QUALIFICATION_VERDICTS.doNotBid,
      blockerCount,
      warningCount,
    }
  }

  if (warningCount > 0 || readinessPercent < 75) {
    return {
      verdict: QUALIFICATION_VERDICTS.borderline,
      blockerCount,
      warningCount,
    }
  }

  return {
    verdict: QUALIFICATION_VERDICTS.qualified,
    blockerCount,
    warningCount,
  }
}

export async function refreshTenderQualification({
  tenderId,
  organizationId,
  syncRequirements = false,
  parserOutput = null,
}) {
  if (syncRequirements) {
    await syncTenderRequirements({ tenderId, parserOutput })
  }

  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      opportunity: {
        select: {
          id: true,
          fitScore: true,
          estimatedValue: true,
          practiceArea: true,
          title: true,
          summary: true,
          parsedRequirements: true,
        },
      },
      checklistItems: true,
      documents: true,
      requirements: true,
    },
  })

  if (!tender) {
    throw new Error('Tender not found.')
  }

  if (!syncRequirements && tender.requirements.length === 0 && Array.isArray(tender.opportunity?.parsedRequirements) && tender.opportunity.parsedRequirements.length > 0) {
    await syncTenderRequirements({ tenderId })
    return refreshTenderQualification({ tenderId, organizationId, syncRequirements: false })
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      firmProfile: true,
      firmPeople: true,
      firmExperiences: true,
      complianceDocuments: true,
    },
  })

  if (!organization?.firmProfile) {
    throw new Error('Organization firm profile not found.')
  }

  const { checks, checklistCompletionPercent } = buildQualificationChecks({
    tender,
    firmProfile: organization.firmProfile,
    firmPeople: organization.firmPeople,
    firmExperiences: organization.firmExperiences,
    complianceDocuments: organization.complianceDocuments,
    requirements: tender.requirements,
  })

  const scoredChecks = checks.filter(check => check.status !== CHECK_STATUS.info)
  const readinessPercent = scoredChecks.length === 0
    ? checklistCompletionPercent
    : Math.round(
        (scoredChecks.reduce((sum, check) => {
          if (check.status === CHECK_STATUS.pass) return sum + 1
          if (check.status === CHECK_STATUS.warning) return sum + 0.5
          return sum
        }, 0) / scoredChecks.length) * 100
      )

  const verdictData = deriveVerdict(checks, readinessPercent)
  const summary = summarizeAssessment(verdictData.verdict, checks)

  const assessment = await prisma.$transaction(async tx => {
    const savedAssessment = await tx.qualificationAssessment.upsert({
      where: { tenderId },
      update: {
        organizationId,
        verdict: verdictData.verdict,
        summary,
        readinessPercent,
        checklistCompletionPercent,
        blockerCount: verdictData.blockerCount,
        warningCount: verdictData.warningCount,
        evaluatedAt: new Date(),
      },
      create: {
        organizationId,
        tenderId,
        verdict: verdictData.verdict,
        summary,
        readinessPercent,
        checklistCompletionPercent,
        blockerCount: verdictData.blockerCount,
        warningCount: verdictData.warningCount,
        evaluatedAt: new Date(),
      },
    })

    await tx.qualificationCheck.deleteMany({
      where: { assessmentId: savedAssessment.id },
    })

    if (checks.length > 0) {
      await tx.qualificationCheck.createMany({
        data: checks.map(check => ({
          assessmentId: savedAssessment.id,
          checkKey: check.checkKey,
          label: check.label,
          status: check.status,
          severity: check.severity,
          detail: check.detail || null,
          recommendation: check.recommendation || null,
          sortOrder: check.sortOrder,
        })),
      })
    }

    return tx.qualificationAssessment.findUnique({
      where: { id: savedAssessment.id },
      include: {
        checks: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })
  })

  return assessment
}
