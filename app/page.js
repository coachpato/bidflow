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
    <div className="relative bg-gradient-to-b from-[#f3f1ec] via-[#faf8f5] to-[#f3f1ec]">
      {/* Background Gradients */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top_left,_rgba(24,49,74,0.08),_transparent_32%)]" />
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top_right,_rgba(160,123,57,0.12),_transparent_26%)]" />
        <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_bottom,_rgba(41,94,72,0.06),_transparent_40%)]" />
      </div>

      {/* Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-white/40 bg-white/70 backdrop-blur-md">
        <nav className="app-page flex items-center justify-between py-4 sm:py-5">
          <AppLogo href="/" tone="dark" caption="" />
          <div className="flex items-center gap-3">
            <Link href="/login" className="app-button-secondary">
              Sign in
            </Link>
            <Link href="/register" className="app-button-primary">
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative">
        {/* Hero Section */}
        <section className="app-page py-16 sm:py-24 lg:py-32">
          <div className="max-w-4xl space-y-8">
            <div className="inline-flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[var(--brand-500)]" />
              <span className="app-kicker">For South African professional services firms</span>
            </div>

            <div className="space-y-6">
              <h1 className="app-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                Win more tenders. Spend less time finding them.
              </h1>
              <p className="text-lg leading-relaxed max-w-2xl text-[var(--foreground-secondary)]">
                Stop managing tenders in spreadsheets. Bid360 is the workspace that turns public tender feeds into your firm&apos;s bid pipeline — matched to your sector, tracked through to award.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link href="/register" className="app-button-primary app-button-lg">
                Get started
              </Link>
              <a href="#features" className="app-button-secondary app-button-lg">
                Learn more
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="border-t border-[var(--line)] py-16 sm:py-24 bg-white/30">
          <div className="app-page space-y-16">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="app-kicker">Capabilities</span>
              <h2 className="app-display text-4xl sm:text-5xl font-bold">
                What Bid360 does for your firm
              </h2>
              <p className="text-lg text-[var(--foreground-secondary)]">
                A complete workspace for tender discovery, pursuit, and contract tracking.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                title="Sector Radar"
                description="Daily scans of public tender portals, filtered to opportunities that match your firm's sector, certifications, and experience."
              />
              <FeatureCard
                title="Disciplined Pursuits"
                description="Run active bids with clear deadlines, document checklists, and a structured workflow from interest to submission."
              />
              <FeatureCard
                title="Document Management"
                description="Upload and organise tender documents, appointment letters and SLA files alongside the bids they belong to."
              />
              <FeatureCard
                title="Award Tracking"
                description="Move awarded tenders into contract tracking. Watch appointment dates, milestones, and renewal reminders."
              />
              <FeatureCard
                title="Challenge Management"
                description="Manage bid protests and administrative appeals with structured timelines, evidence checklists, and clear deadlines."
              />
            </div>
          </div>
        </section>

        {/* Sectors Section */}
        <section className="py-16 sm:py-24 border-t border-[var(--line)]">
          <div className="app-page space-y-16">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="app-kicker">Tailored for your industry</span>
              <h2 className="app-display text-4xl sm:text-5xl font-bold">
                Built for the firms behind the work
              </h2>
              <p className="text-lg text-[var(--foreground-secondary)]">
                Configured for the unique workflows of three professional services sectors.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              <SectorCard
                title="Built Environment"
                description="For engineers, quantity surveyors, architects, and project managers."
                features={['Engineering frameworks, etc.']}
              />
              <SectorCard
                title="Legal"
                description="For law firms and attorneys serving government and state-owned entities."
                features={['Panel appointments, etc.']}
              />
              <SectorCard
                title="Accounting"
                description="For audit, tax, and advisory firms in the public sector."
                features={['Audit panel work, etc.']}
              />
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 sm:py-24 bg-white/30 border-t border-[var(--line)]">
          <div className="app-page space-y-16">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="app-kicker">Getting started</span>
              <h2 className="app-display text-4xl sm:text-5xl font-bold">
                Set up in minutes
              </h2>
            </div>

            <div className="grid gap-8 md:grid-cols-4">
              <StepCard step="1" title="Create your workspace" description="Sign up with your work email and confirm your firm's sector." />
              <StepCard step="2" title="Build your firm profile" description="Add disciplines, certifications, and experience so matches are relevant to your work." />
              <StepCard step="3" title="Receive matched opportunities" description="Bid360 scans public tender portals daily and emails you a digest of opportunities that fit your firm." />
              <StepCard step="4" title="Pursue, track, and win" description="Run pursuits, manage documents, track awards, and handle challenges — all in one place." />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 sm:py-24 border-t border-[var(--line)]">
          <div className="app-page">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--brand-500)] to-[var(--brand-600)] p-12 sm:p-16 text-white">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.4),_transparent_60%)]" />
              <div className="relative max-w-2xl space-y-8">
                <div className="space-y-4">
                  <h2 className="text-4xl sm:text-5xl font-bold leading-tight">
                    Built with the firms using it
                  </h2>
                  <p className="text-lg text-white/90">
                    Bid360 is in early access. The firms who join during this phase get the workspace free and a direct line to the team. Tell us what makes tender management difficult, and we&apos;ll build toward it.
                  </p>
                </div>
                <Link href="/register" className="app-button-primary">
                  Get started
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--line)] bg-white/40 py-12">
        <div className="app-page">
          <div className="flex flex-col gap-8 border-b border-[var(--line)] pb-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <AppLogo />
              <p className="max-w-md text-sm text-[var(--foreground-secondary)]">
                Tender and contract management for South African professional services firms.
              </p>
            </div>
            <nav className="flex flex-wrap gap-4 text-sm font-semibold text-[var(--foreground-secondary)]">
              <Link href="/privacy" className="hover:text-[var(--brand-500)]">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-[var(--brand-500)]">
                Terms
              </Link>
              <a href="mailto:hello@bid360.co.za" className="hover:text-[var(--brand-500)]">
                hello@bid360.co.za
              </a>
            </nav>
          </div>
          <p className="pt-8 text-sm text-[var(--muted)]">
            © 2026 Talita Consulting Services (Pty) Ltd, trading as Bid360.
          </p>
        </div>
      </footer>
    </div>
  )
}

// Component: Feature Card
function FeatureCard({ title, description }) {
  return (
    <div className="app-card group">
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-sm text-[var(--foreground-secondary)]">{description}</p>
    </div>
  )
}

// Component: Sector Card
function SectorCard({ title, description, features }) {
  return (
    <div className="app-card">
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-sm text-[var(--foreground-secondary)] mb-6">{description}</p>
      <ul className="space-y-2">
        {features.map((feature, i) => (
          <li key={i} className="text-sm text-[var(--foreground)]">
            {feature}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Component: Step Card
function StepCard({ step, title, description }) {
  return (
    <div className="text-center space-y-4">
      <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-[var(--brand-500)] text-white font-bold text-lg">
        {step}
      </div>
      <h3 className="font-bold text-lg">{title}</h3>
      <p className="text-sm text-[var(--foreground-secondary)]">{description}</p>
    </div>
  )
}
