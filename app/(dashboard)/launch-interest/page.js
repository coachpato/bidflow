import { redirect } from 'next/navigation'
import Header from '@/app/components/Header'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/session'

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function LaunchInterestPage() {
  const session = await requireAuth()
  if (session.role !== 'admin') {
    redirect('/dashboard')
  }

  const leads = await prisma.pilotLead.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const monthlySignals = leads.filter(lead => lead.pricingPreference === 'Monthly subscription').length
  const lifetimeSignals = leads.filter(lead => lead.pricingPreference === 'One-time license').length

  return (
    <div className="space-y-6">
      <Header
        title="Pilot interest"
        eyebrow="Launch signals"
        meta={[
          { label: 'Leads', value: `${leads.length}` },
          { label: 'Monthly', value: `${monthlySignals}` },
          { label: 'Lifetime', value: `${lifetimeSignals}` },
        ]}
      />

      <div className="app-page">
        {leads.length === 0 ? (
          <section className="app-surface rounded-[24px] px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-800">No pilot requests yet.</p>
          </section>
        ) : (
          <section className="space-y-4">
            {leads.map(lead => (
              <article key={lead.id} className="app-surface rounded-[24px] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-950">{lead.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {[lead.company, lead.role].filter(Boolean).join(' · ') || lead.email}
                    </p>
                    {lead.company ? (
                      <p className="mt-1 text-sm text-slate-500">{lead.email}</p>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {formatDate(lead.createdAt)}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Info label="Team size" value={lead.teamSize || 'Not set'} />
                  <Info label="Pricing" value={lead.pricingPreference || 'Not set'} />
                  <Info label="Monthly" value={lead.monthlyBudget || 'Not set'} />
                  <Info label="Lifetime" value={lead.lifetimeBudget || 'Not set'} />
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <Note label="Who would use it?" value={lead.whoWouldUseIt} />
                  <Note label="Pain point" value={lead.painPoint || 'Not provided'} />
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="rounded-[18px] bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function Note({ label, value }) {
  return (
    <div className="rounded-[20px] bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-7 text-slate-700">{value}</p>
    </div>
  )
}
