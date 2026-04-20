import { logActivity } from '@/lib/activity'
import { crawlETenders, downloadPDF, getPDFLinksFromTender, getTenderDetails } from '@/lib/crawler/etenders-crawler'
import { analyzeTenderForSector } from '@/lib/crawler/keyword-matcher'
import { extractTextFromPDF } from '@/lib/crawler/pdf-extractor'
import { getAppUrl, sendEmail } from '@/lib/email'
import { ensureOrganizationContext } from '@/lib/organization'
import {
  buildOpportunityDedupeKey,
  evaluateOpportunityMatch,
  summarizeMatchReasons,
} from '@/lib/opportunity-radar'
import prisma from '@/lib/prisma'
import { getServiceSectorLabel, normalizeServiceSector } from '@/lib/service-sectors'
import { ensureStorageBucket, getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

const SOURCE_KEY = 'etenders-gov-za'
const SOURCE_NAME = 'eTenders.gov.za'
const SOURCE_BASE_URL = 'https://www.etenders.gov.za'
const OPPORTUNITIES_URL = 'https://www.etenders.gov.za/Home/opportunities?id=1'

function toNullableDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isAuthorizedCron(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

async function uploadPDFToSupabase(fileName, pdfBuffer, opportunityId) {
  try {
    await ensureStorageBucket()

    const supabase = getSupabaseAdmin()
    const filePath = `opportunities/${opportunityId}/${Date.now()}_${fileName.replace(/[^a-z0-9._-]/gi, '_')}`

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (error) {
      throw new Error(`Supabase upload error: ${error.message}`)
    }

    const { data: publicUrl } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath)

    return {
      fileName,
      filePath: publicUrl.publicUrl,
    }
  } catch (error) {
    console.error('Error uploading PDF:', error)
    return null
  }
}

async function ensureSourceRecord() {
  return prisma.source.upsert({
    where: { key: SOURCE_KEY },
    update: {
      name: SOURCE_NAME,
      type: 'portal',
      baseUrl: SOURCE_BASE_URL,
    },
    create: {
      key: SOURCE_KEY,
      name: SOURCE_NAME,
      type: 'portal',
      baseUrl: SOURCE_BASE_URL,
    },
  })
}

async function loadOrganizationsForRadar() {
  let organizations = await prisma.organization.findMany({
    include: {
      firmProfile: true,
    },
    orderBy: { id: 'asc' },
  })

  if (organizations.length === 0) {
    const users = await prisma.user.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    })

    for (const user of users) {
      await ensureOrganizationContext(user.id)
    }

    organizations = await prisma.organization.findMany({
      include: {
        firmProfile: true,
      },
      orderBy: { id: 'asc' },
    })
  }

  return organizations.filter(organization => organization.firmProfile)
}

async function buildTenderSourcePack(tender) {
  const tenderDetails = await getTenderDetails(tender)
  const pdfLinks = await getPDFLinksFromTender(tender)
  const pdfAssets = []
  const extractedTextSnippets = []

  for (const pdfLink of pdfLinks) {
    try {
      const pdfBuffer = await downloadPDF(pdfLink.url)
      if (!pdfBuffer) continue

      const pdfContent = await extractTextFromPDF(pdfBuffer)
      const extractedText = pdfContent.text || ''

      if (extractedText) {
        extractedTextSnippets.push(extractedText)
      }

      pdfAssets.push({
        ...pdfLink,
        fileName: pdfLink.text || 'tender-document.pdf',
        buffer: pdfBuffer,
        text: extractedText,
      })
    } catch (error) {
      console.error(`Error processing PDF ${pdfLink.text}:`, error.message)
    }
  }

  return {
    tenderDetails,
    pdfAssets,
    pdfText: extractedTextSnippets.join('\n\n'),
  }
}

function buildOpportunitySummary(match, tender, tenderDetails) {
  const summaryBits = [
    `${match.practiceArea || 'Relevant'} opportunity`,
    summarizeMatchReasons(match.matchReasons),
    tenderDetails.entity ? `Issuing entity: ${tenderDetails.entity}` : null,
    tender.category ? `Category: ${tender.category}` : null,
  ].filter(Boolean)

  return summaryBits.join('. ')
}

function buildOpportunityNotes(match) {
  const keywordLine = match.matchedKeywords.length > 0
    ? `Matched keywords: ${match.matchedKeywords.join(', ')}`
    : null

  return [
      'Identified through the Bid360 opportunity radar.',
    ...match.matchReasons,
    keywordLine,
  ].filter(Boolean).join('\n\n')
}

async function upsertOpportunityForOrganization({
  organization,
  source,
  sourceRun,
  tender,
  tenderDetails,
  match,
  pdfAssets,
}) {
  const deadline = toNullableDate(tender.deadline)
  const dedupeKey = buildOpportunityDedupeKey({
    organizationId: organization.id,
    sourceKey: source.key,
    externalId: tender.reference,
    title: tender.title,
    entity: tenderDetails.entity || tender.category || 'Unknown Entity',
    deadline,
  })

  const existing = await prisma.opportunity.findFirst({
    where: {
      organizationId: organization.id,
      dedupeKey,
    },
    select: {
      id: true,
      status: true,
      notes: true,
      _count: {
        select: {
          documents: true,
        },
      },
    },
  })

  const baseData = {
    organizationId: organization.id,
    title: tender.title,
    reference: tender.reference || null,
    externalId: tender.reference || null,
    dedupeKey,
    entity: tenderDetails.entity || tender.category || 'Unknown Entity',
    sourceName: source.name,
    sourceUrl: tender.url || OPPORTUNITIES_URL,
    category: tender.category || null,
    practiceArea: match.practiceArea,
    summary: buildOpportunitySummary(match, tender, tenderDetails),
    publishedAt: toNullableDate(tender.advertised),
    deadline,
    briefingDate: tenderDetails.briefingDate || null,
    siteVisitDate: tenderDetails.siteVisitDate || null,
    contactPerson: tenderDetails.contactPerson || null,
    contactEmail: tenderDetails.contactEmail || null,
    fitScore: match.fitScore,
    sourceId: source.id,
    sourceRunId: sourceRun.id,
  }

  let opportunity

  if (existing) {
    opportunity = await prisma.opportunity.update({
      where: { id: existing.id },
      data: {
        ...baseData,
      },
    })
  } else {
    opportunity = await prisma.opportunity.create({
      data: {
        ...baseData,
        status: match.recommendedStatus,
        notes: buildOpportunityNotes(match),
      },
    })
  }

  await prisma.opportunityMatch.upsert({
    where: {
      opportunityId_organizationId: {
        opportunityId: opportunity.id,
        organizationId: organization.id,
      },
    },
    update: {
      verdict: match.verdict,
      fitScore: match.fitScore,
      matchedKeywords: match.matchedKeywords,
      matchReasons: match.matchReasons,
      reviewedAt: existing && existing.status !== 'New' ? new Date() : null,
    },
    create: {
      organizationId: organization.id,
      opportunityId: opportunity.id,
      verdict: match.verdict,
      fitScore: match.fitScore,
      matchedKeywords: match.matchedKeywords,
      matchReasons: match.matchReasons,
    },
  })

  if ((!existing || existing._count.documents === 0) && pdfAssets.length > 0) {
    for (const pdfAsset of pdfAssets) {
      const uploadResult = await uploadPDFToSupabase(
        pdfAsset.fileName,
        pdfAsset.buffer,
        opportunity.id
      )

      if (!uploadResult) continue

      await prisma.opportunityDocument.create({
        data: {
          filename: uploadResult.fileName,
          filepath: uploadResult.filePath,
          opportunityId: opportunity.id,
        },
      })
    }
  }

  return {
    opportunity,
    isNew: !existing,
  }
}

function getDigestRecipients(organization) {
  const recipients = [
    organization.firmProfile?.primaryContactEmail,
    ...(process.env.CRAWLER_EMAIL_RECIPIENTS || '')
      .split(',')
      .map(email => email.trim())
      .filter(Boolean),
  ].filter(Boolean)

  return Array.from(new Set(recipients))
}

async function sendDailyDigestEmail({ organization, sourceRun, opportunities }) {
  const recipients = getDigestRecipients(organization)
  if (recipients.length === 0 || opportunities.length === 0) return

  const appUrl = getAppUrl()
  const sectorLabel = getServiceSectorLabel(organization.firmProfile?.serviceSector)
  const listRows = opportunities
    .map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          <strong>${item.title}</strong><br/>
          <small>${item.entity} | Ref: ${item.reference || 'N/A'}</small>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.practiceArea || 'Relevant Services'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.fitScore ?? 'Not scored'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.matchSummary}</td>
      </tr>
    `)
    .join('')

  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; color: #111827;">
        <h2>Daily ${sectorLabel} Opportunity Digest</h2>
        <p>${organization.name} has <strong>${opportunities.length} new relevant opportunity match(es)</strong> from ${SOURCE_NAME}.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
          <thead>
            <tr style="background-color: #f8fafc;">
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Opportunity</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Practice Area</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Fit</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Why It Matched</th>
            </tr>
          </thead>
          <tbody>${listRows}</tbody>
        </table>

        <p>Source run started at: ${sourceRun.startedAt.toLocaleString('en-ZA')}</p>
        ${appUrl ? `<p><a href="${appUrl}/opportunities" style="display: inline-block; padding: 12px 18px; background: #0f766e; color: #fff; text-decoration: none; border-radius: 8px;">Open opportunity radar</a></p>` : ''}
      </body>
    </html>
  `

  const text = [
    `Daily ${sectorLabel} Opportunity Digest`,
    '',
    `${organization.name} has ${opportunities.length} new relevant opportunity match(es) from ${SOURCE_NAME}.`,
    '',
    ...opportunities.map(item => `- ${item.title} | ${item.entity} | ${item.fitScore ?? 'Not scored'} | ${item.matchSummary}`),
    '',
      appUrl ? `Review in Bid360: ${appUrl}/opportunities` : null,
  ].filter(Boolean).join('\n')

  await Promise.all(
    recipients.map(recipient => sendEmail({
      to: recipient,
      subject: `Daily ${sectorLabel.toLowerCase()} opportunities: ${opportunities.length} new match(es)`,
      html,
      text,
    }))
  )
}

async function createDigestNotification({ organizationId, sourceRunId, count }) {
  await prisma.notification.upsert({
    where: {
      sourceKey: `opportunity-digest:${sourceRunId}:${organizationId}`,
    },
    update: {
      title: 'Opportunity digest ready',
      message: `${count} new relevant opportunity match${count === 1 ? '' : 'es'} landed in your radar today.`,
      type: 'opportunity',
      organizationId,
      userId: null,
      read: false,
      linkUrl: '/opportunities',
      linkLabel: 'Open radar',
    },
    create: {
      sourceKey: `opportunity-digest:${sourceRunId}:${organizationId}`,
      title: 'Opportunity digest ready',
      message: `${count} new relevant opportunity match${count === 1 ? '' : 'es'} landed in your radar today.`,
      type: 'opportunity',
      organizationId,
      userId: null,
      linkUrl: '/opportunities',
      linkLabel: 'Open radar',
    },
  })
}

export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const source = await ensureSourceRecord()
  const sourceRun = await prisma.sourceRun.create({
    data: {
      sourceId: source.id,
      status: 'running',
    },
  })

  try {
    const organizations = await loadOrganizationsForRadar()
    const tenders = await crawlETenders()

    const results = {
      source: source.name,
      totalFound: tenders.length,
      organizationsEvaluated: organizations.length,
      matchedCount: 0,
      newOpportunitiesCreated: 0,
      digestsSent: 0,
      opportunitiesByOrganization: {},
      errors: [],
    }

    for (const tender of tenders) {
      try {
        const sourcePack = await buildTenderSourcePack(tender)
        const sectorAnalysisCache = new Map()

        for (const organization of organizations) {
          const serviceSector = normalizeServiceSector(organization.firmProfile?.serviceSector) || 'LEGAL'
          let tenderAnalysis = sectorAnalysisCache.get(serviceSector)

          if (!tenderAnalysis) {
            tenderAnalysis = analyzeTenderForSector(
              serviceSector,
              tender.title,
              tender.description,
              sourcePack.pdfText
            )
            sectorAnalysisCache.set(serviceSector, tenderAnalysis)
          }

          if (!tenderAnalysis.isSectorOpportunity) continue

          const match = evaluateOpportunityMatch({
            firmProfile: organization.firmProfile,
            tender,
            tenderDetails: sourcePack.tenderDetails,
            tenderAnalysis,
          })

          if (!match.isMatch) continue

          const { opportunity, isNew } = await upsertOpportunityForOrganization({
            organization,
            source,
            sourceRun,
            tender,
            tenderDetails: sourcePack.tenderDetails,
            match,
            pdfAssets: sourcePack.pdfAssets,
          })

          results.matchedCount += 1
          if (isNew) {
            results.newOpportunitiesCreated += 1

            if (!results.opportunitiesByOrganization[organization.id]) {
              results.opportunitiesByOrganization[organization.id] = {
                organizationId: organization.id,
                organizationName: organization.name,
                opportunities: [],
              }
            }

            results.opportunitiesByOrganization[organization.id].opportunities.push({
              id: opportunity.id,
              title: opportunity.title,
              reference: opportunity.reference,
              entity: opportunity.entity,
              practiceArea: opportunity.practiceArea,
              fitScore: opportunity.fitScore,
              matchSummary: summarizeMatchReasons(match.matchReasons),
            })

            await logActivity(`Opportunity radar matched: ${opportunity.title}`, {})
          }
        }
      } catch (error) {
        console.error(`Error processing tender "${tender.title}":`, error.message)
        results.errors.push({
          tender: tender.title,
          error: error.message,
        })
      }
    }

    for (const organizationResult of Object.values(results.opportunitiesByOrganization)) {
      const organization = organizations.find(item => item.id === organizationResult.organizationId)
      if (!organization || organizationResult.opportunities.length === 0) continue

      await sendDailyDigestEmail({
        organization,
        sourceRun,
        opportunities: organizationResult.opportunities,
      })
      await createDigestNotification({
        organizationId: organization.id,
        sourceRunId: sourceRun.id,
        count: organizationResult.opportunities.length,
      })
      results.digestsSent += 1
    }

    await prisma.sourceRun.update({
      where: { id: sourceRun.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        totalFound: results.totalFound,
        matchedCount: results.matchedCount,
        newCount: results.newOpportunitiesCreated,
        errorCount: results.errors.length,
        summary: {
          organizationsEvaluated: results.organizationsEvaluated,
          digestsSent: results.digestsSent,
          organizationsWithMatches: Object.keys(results.opportunitiesByOrganization).length,
        },
      },
    })

    if (results.errors.length > 0) {
      for (const organization of organizations) {
        await prisma.notification.upsert({
          where: {
            sourceKey: `crawler-error:${sourceRun.id}:${organization.id}`,
          },
          update: {
            title: 'Crawler completed with warnings',
            message: `${results.errors.length} source-processing issue${results.errors.length === 1 ? '' : 's'} were recorded during the latest radar run.`,
            type: 'warning',
            organizationId: organization.id,
            read: false,
            linkUrl: '/opportunities',
            linkLabel: 'Open radar',
          },
          create: {
            sourceKey: `crawler-error:${sourceRun.id}:${organization.id}`,
            title: 'Crawler completed with warnings',
            message: `${results.errors.length} source-processing issue${results.errors.length === 1 ? '' : 's'} were recorded during the latest radar run.`,
            type: 'warning',
            organizationId: organization.id,
            linkUrl: '/opportunities',
            linkLabel: 'Open radar',
          },
        })
      }
    }

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    })
  } catch (error) {
    console.error('[Crawler] Fatal error:', error)

    await prisma.sourceRun.update({
      where: { id: sourceRun.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorCount: 1,
        summary: {
          error: error.message,
        },
      },
    })

    return Response.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
