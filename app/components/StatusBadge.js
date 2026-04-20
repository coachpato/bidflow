// Colors for each tender/appeal status
const STATUS_STYLES = {
  // Tender statuses
  New: { badge: 'border border-slate-200 bg-slate-50 text-slate-700', dot: 'bg-slate-500' },
  'Under Review': { badge: 'border border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  'In Progress': { badge: 'border border-blue-200 bg-blue-50 text-blue-800', dot: 'bg-blue-600' },
  Submitted: { badge: 'border border-indigo-200 bg-indigo-50 text-indigo-800', dot: 'bg-indigo-500' },
  Awarded: { badge: 'border border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-600' },
  Lost: { badge: 'border border-rose-200 bg-rose-50 text-rose-800', dot: 'bg-rose-600' },
  Cancelled: { badge: 'border border-slate-200 bg-slate-50 text-slate-500', dot: 'bg-slate-400' },
  // Opportunity statuses
  Reviewing: { badge: 'border border-cyan-200 bg-cyan-50 text-cyan-800', dot: 'bg-cyan-600' },
  Watch: { badge: 'border border-cyan-200 bg-cyan-50 text-cyan-800', dot: 'bg-cyan-600' },
  Pursue: { badge: 'border border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-600' },
  Skipped: { badge: 'border border-slate-200 bg-slate-50 text-slate-600', dot: 'bg-slate-400' },
  Ignore: { badge: 'border border-slate-200 bg-slate-50 text-slate-600', dot: 'bg-slate-400' },
  Converted: { badge: 'border border-violet-200 bg-violet-50 text-violet-800', dot: 'bg-violet-600' },
  // Appointment statuses
  Appointed: { badge: 'border border-cyan-200 bg-cyan-50 text-cyan-800', dot: 'bg-cyan-600' },
  Dormant: { badge: 'border border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  Active: { badge: 'border border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-600' },
  Completed: { badge: 'border border-violet-200 bg-violet-50 text-violet-800', dot: 'bg-violet-600' },
  Closed: { badge: 'border border-slate-200 bg-slate-50 text-slate-600', dot: 'bg-slate-400' },
  'No Instruction': { badge: 'border border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  'Instruction Received': { badge: 'border border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-600' },
  // Appeal statuses
  Pending: { badge: 'border border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  Won: { badge: 'border border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' },
  'Administrative Appeal': { badge: 'border border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  'Bid Protest': { badge: 'border border-rose-200 bg-rose-50 text-rose-800', dot: 'bg-rose-600' },
  Review: { badge: 'border border-cyan-200 bg-cyan-50 text-cyan-800', dot: 'bg-cyan-600' },
  // Checklist
  Done: { badge: 'border border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' },
  'Not Done': { badge: 'border border-slate-200 bg-slate-50 text-slate-600', dot: 'bg-slate-400' },
}

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || { badge: 'border border-slate-200 bg-slate-50 text-slate-700', dot: 'bg-slate-500' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}>
      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
      {status}
    </span>
  )
}
