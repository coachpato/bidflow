import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppLogo from '@/app/components/AppLogo'

export default async function RootPage() {
  const session = await getSession()
  if (session.userId) {
    redirect('/dashboard')
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,_rgba(24,49,74,0.1),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(160,123,57,0.14),_transparent_26%),linear-gradient(180deg,#f7f5f1_0%,#f3f1ec_54%,#efeae2_100%)]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.82),transparent_68%)]" />

      <header className="app-page flex items-center justify-between py-6 sm:py-8">
        <AppLogo href="/" tone="dark" caption="Legal public-sector work operations" />
        <div className="flex items-center gap-3">
          <Link href="/login" className="app-button-secondary">
            Sign in
          </Link>
          <Link href="/register" className="app-button-primary">
            Create account
          </Link>
        </div>
      </header>

      <main className="app-page pb-10 pt-6 sm:pb-16 sm:pt-10">
        <section className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] xl:items-end">
          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full border border-[rgba(22,33,50,0.12)] bg-white/78 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-600 shadow-[0_12px_30px_rgba(22,33,50,0.06)]">
              BidFlow V2
            </div>

            <div className="max-w-4xl space-y-5">
              <h1 className="app-display max-w-4xl text-[3.4rem] font-semibold leading-[0.94] text-slate-950 sm:text-[4.6rem] xl:text-[5.6rem]">
                Public-sector legal work,
                <br />
                run end to end.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Find opportunities, run live pursuits, track appointments, and keep the firm’s state-work pipeline in one disciplined workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/login" className="app-button-primary">
                Open workspace
              </Link>
              <Link href="/register" className="app-button-secondary">
                Create account
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <SignalCard label="Opportunities" value="See the right work sooner" />
              <SignalCard label="Pursuits" value="Track active bids with discipline" />
              <SignalCard label="Appointments" value="Keep post-award follow-through visible" />
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 top-10 hidden h-28 w-28 rounded-full bg-[rgba(160,123,57,0.12)] blur-3xl xl:block" />
            <section className="app-surface relative overflow-hidden rounded-[32px] border-white/55 bg-[rgba(255,255,255,0.78)] p-5 sm:p-6">
              <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(16,36,54,0.07),transparent)]" />
              <div className="relative space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="app-kicker">Today</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                      One desk for the full value chain
                    </h2>
                  </div>
                  <span className="rounded-full bg-[rgba(24,49,74,0.08)] px-3 py-1 text-xs font-semibold text-slate-700">
                    Live
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <PanelStat label="Due soon" value="3 pursuits" tone="text-amber-700" />
                  <PanelStat label="Assigned" value="5 matters" tone="text-slate-950" />
                  <PanelStat label="Appointments" value="2 follow-ups" tone="text-emerald-700" />
                  <PanelStat label="Inbox" value="4 alerts" tone="text-slate-950" />
                </div>

                <div className="space-y-3 rounded-[26px] border border-slate-200/80 bg-white/88 p-4">
                  <WorkspaceRow
                    title="Municipal legal services"
                    meta="Pursuit"
                    status="4d left"
                  />
                  <WorkspaceRow
                    title="Panel appointment follow-up"
                    meta="Appointment"
                    status="Needs instruction"
                  />
                  <WorkspaceRow
                    title="Assigned to you"
                    meta="My Work"
                    status="2 active items"
                  />
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  )
}

function SignalCard({ label, value }) {
  return (
    <div className="rounded-[22px] border border-[rgba(22,33,50,0.1)] bg-white/76 px-4 py-4 shadow-[0_16px_40px_rgba(22,33,50,0.06)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function PanelStat({ label, value, tone }) {
  return (
    <div className="rounded-[22px] bg-[rgba(246,242,236,0.82)] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-2 text-base font-semibold ${tone}`}>{value}</p>
    </div>
  )
}

function WorkspaceRow({ title, meta, status }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[20px] border border-slate-200/75 bg-[rgba(249,247,244,0.88)] px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{meta}</p>
      </div>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
        {status}
      </span>
    </div>
  )
}
