import Header from '@/app/components/Header'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import { ensureOrganizationContext } from '@/lib/organization'
import { syncComplianceExpiryNotifications } from '@/lib/compliance-documents'
import { getComplianceStatus } from '@/lib/compliance-status'
import ComplianceVaultManager from './ComplianceVaultManager'

export default async function VaultPage() {
  const session = await requireAuth()
  const organizationContext = await ensureOrganizationContext(session.userId)
  await syncComplianceExpiryNotifications(organizationContext.organization.id)

  const documents = await prisma.complianceDocument.findMany({
    where: { organizationId: organizationContext.organization.id },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [
      { expiryDate: 'asc' },
      { documentType: 'asc' },
      { createdAt: 'desc' },
    ],
  })

  const expiringSoon = documents.filter(document => {
    const days = getComplianceStatus(document).daysUntilExpiry
    return days !== null && days <= 30
  }).length

  return (
    <div className="space-y-6">
      <Header
        title="Compliance vault"
        eyebrow="Sprint 2"
        meta={[
          { label: 'Documents', value: `${documents.length}` },
          { label: 'Expiring soon', value: `${expiringSoon}` },
          { label: 'Organization', value: organizationContext.organization.name },
        ]}
        primaryAction={{ href: '/firm', label: 'Open firm workspace' }}
        secondaryAction={{ href: '/dashboard', label: 'Back to dashboard' }}
      />

      <div className="app-page">
        <ComplianceVaultManager initialDocuments={documents} />
      </div>
    </div>
  )
}
