// Colors for each tender/appeal status
const STATUS_STYLES = {
  // Tender statuses
  New: 'bg-slate-100 text-slate-700',
  'Under Review': 'bg-yellow-100 text-yellow-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  Submitted: 'bg-purple-100 text-purple-800',
  Awarded: 'bg-green-100 text-green-800',
  Lost: 'bg-red-100 text-red-800',
  Cancelled: 'bg-slate-100 text-slate-500',
  // Appeal statuses
  Pending: 'bg-yellow-100 text-yellow-800',
  Won: 'bg-green-100 text-green-800',
  // Checklist
  Done: 'bg-green-100 text-green-800',
  'Not Done': 'bg-slate-100 text-slate-600',
}

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-700'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {status}
    </span>
  )
}
