export const COMPLIANCE_DOCUMENT_TYPES = [
  'Tax Clearance',
  'CSD Registration',
  'B-BBEE Certificate',
  'Bank Letter',
  'Professional Indemnity Insurance',
  'CIPC Registration',
  'Attorney Admission Certificate',
  'Fidelity Fund Certificate',
  'CV',
  'Reference Letter',
  'Other',
]

const MS_PER_DAY = 1000 * 60 * 60 * 24

export function getDaysUntil(dateValue) {
  if (!dateValue) return null
  const diff = new Date(dateValue).getTime() - Date.now()
  return Math.ceil(diff / MS_PER_DAY)
}

export function getComplianceStatus(document) {
  if (!document.expiryDate) {
    return {
      tone: 'neutral',
      label: 'No expiry set',
      daysUntilExpiry: null,
    }
  }

  const daysUntilExpiry = getDaysUntil(document.expiryDate)

  if (daysUntilExpiry < 0) {
    return {
      tone: 'danger',
      label: `Expired ${Math.abs(daysUntilExpiry)} day${Math.abs(daysUntilExpiry) === 1 ? '' : 's'} ago`,
      daysUntilExpiry,
    }
  }

  if (daysUntilExpiry <= 30) {
    return {
      tone: 'warning',
      label: daysUntilExpiry === 0
        ? 'Expires today'
        : `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`,
      daysUntilExpiry,
    }
  }

  return {
    tone: 'good',
    label: `Current for ${daysUntilExpiry} more day${daysUntilExpiry === 1 ? '' : 's'}`,
    daysUntilExpiry,
  }
}
