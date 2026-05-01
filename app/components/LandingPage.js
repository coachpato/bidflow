import Link from 'next/link'
import AppLogo from '@/app/components/AppLogo'

export default function LandingPage() {
  return (
    <div className="relative bg-[#f7f5f0]">
      <header className="sticky top-0 z-40 border-b border-white/40 bg-white/70 backdrop-blur-md">
        <nav className="app-page flex items-center justify-between py-4 sm:py-5">
          <AppLogo href="/landing" tone="dark" caption="" />
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
        <section className="app-page py-16 sm:py-24 lg:py-32">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-8 animate-slideInUp">
              <div className="inline-flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-var(--brand-500)" />
                <span className="app-kicker">Private pilot now open</span>
              </div>

              <div className="space-y-6">
                <h1 className="app-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                  Bid360 for Tenders &amp; Awarded Contracts
                </h1>
                <p className="max-w-xl text-lg leading-relaxed text-[var(--foreground-secondary)]">
                  Move tender work out of scattered spreadsheets. Bid360 helps South African built environment, legal, finance, and green-energy teams assess opportunities, manage pursuits, and track awarded contracts.
                </p>
              </div>

              <div className="flex flex-wrap gap-4 pt-4">
                <Link href="/register" className="app-button-primary app-button-lg">
                  Join the pilot
                </Link>
                <a href="#features" className="app-button-secondary app-button-lg">
                  Learn more
                </a>
              </div>

              <div className="grid gap-3 border-t border-[var(--line)] pt-8 sm:grid-cols-3">
                <TrustItem title="Opportunity radar" body="Qualified opportunity matching" />
                <TrustItem title="Pursuit control" body="Deadlines and checklists" />
                <TrustItem title="Awarded contracts" body="Dates and reminders" />
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="relative space-y-6 rounded-2xl border border-white/70 bg-white/85 p-8 shadow-xl backdrop-blur">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold">Pilot Workspace</h3>
                  <span className="app-badge app-badge-success">Ready</span>
                </div>
                <div className="space-y-4">
                  <DashboardItem label="Ready" value="Review and shortlist" />
                  <DashboardItem label="Active pursuits" value="Assign, prepare, submit" />
                  <DashboardItem label="Awarded work" value="Convert to contract" />
                  <DashboardItem label="Challenge dates" value="Track appeal timelines" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-[var(--line)] bg-white/30 py-16 sm:py-24">
          <div className="app-page space-y-16">
            <div className="mx-auto max-w-2xl space-y-4 text-center">
              <span className="app-kicker">Features</span>
              <h2 className="app-display text-4xl font-bold sm:text-5xl">
                Built for your firm&apos;s workflow
              </h2>
              <p className="text-lg text-[var(--foreground-secondary)]">
                Everything your team needs to discover tenders, manage pursuits, and track awarded contracts in one place.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon="Radar"
                title="Opportunity Radar"
                description="Sector-aware matching helps your team focus on qualified opportunities by service line, entity, and province."
              />
              <FeatureCard
                icon="Pursuits"
                title="Disciplined Pursuits"
                description="Run active bids with clear deadlines, document checklists, and team accountability."
              />
              <FeatureCard
                icon="Docs"
                title="Document Management"
                description="Upload, organize, and manage tender documents."
              />
              <FeatureCard
                icon="Awards"
                title="Awarded Contract Tracking"
                description="Convert awarded bids into contract records with key dates, appointments, and reminders."
              />
              <FeatureCard
                icon="Appeals"
                title="Challenge Management"
                description="Manage bid protests and appeals with clear timelines and communication trails."
              />
              <FeatureCard
                icon="Team"
                title="Team Collaboration"
                description="Assign tenders, track progress, and communicate without leaving the workspace."
              />
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--line)] py-16 sm:py-24">
          <div className="app-page space-y-16">
            <div className="mx-auto max-w-2xl space-y-4 text-center">
              <span className="app-kicker">Choose your sector</span>
              <h2 className="app-display text-4xl font-bold sm:text-5xl">
                Tailored for your work
              </h2>
              <p className="text-lg text-[var(--foreground-secondary)]">
                Bid360 is customized for the unique workflows of each sector.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              <SectorCard
                title="Built Environment"
                description="For engineering, quantity surveying, architecture, and project-management teams."
                features={['Engineering frameworks', 'Project experience', 'CIDB compliance']}
              />
              <SectorCard
                title="Legal"
                description="For law firms and attorneys handling public-sector panels, collections, and advisory work."
                features={['Panel appointments', 'Legal collections', 'Public-sector compliance']}
              />
              <SectorCard
                title="Finance & Advisory"
                description="For audit, tax, transaction advisory, and AFS-preparation teams."
                features={['Audit panels', 'AFS preparation', 'Advisory support']}
              />
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--line)] bg-white/30 py-16 sm:py-24">
          <div className="app-page space-y-16">
            <div className="mx-auto max-w-2xl space-y-4 text-center">
              <span className="app-kicker">Getting started</span>
              <h2 className="app-display text-4xl font-bold sm:text-5xl">
                Quick setup in minutes
              </h2>
            </div>

            <div className="grid gap-8 md:grid-cols-4">
              <StepCard
                step="1"
                title="Create workspace"
                description="Sign up with your email and choose your sector."
              />
              <StepCard
                step="2"
                title="Build your profile"
                description="Add firm details, certifications, and experience."
              />
              <StepCard
                step="3"
                title="Start discovering"
                description="Review qualified matches and shortlist priority opportunities."
              />
              <StepCard
                step="4"
                title="Track & win"
                description="Manage pursuits, submissions, awards, and contract obligations."
              />
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--line)] py-16 sm:py-24">
          <div className="app-page">
            <div className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-white p-12 text-[var(--foreground)] shadow-[var(--shadow-card)] sm:p-16">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.4),_transparent_60%)]" />
              <div className="relative max-w-2xl space-y-8">
                <div className="space-y-4">
                  <h2 className="text-4xl font-bold leading-tight sm:text-5xl">
                    Ready for a controlled pilot?
                  </h2>
                  <p className="text-lg text-[var(--foreground-secondary)]">
                    Create a private workspace, invite your team, and manage real tender and contract workflows in Bid360.
                  </p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <Link href="/register" className="app-button app-button-primary">
                    Join the pilot
                  </Link>
                  <Link href="/login" className="app-button app-button-secondary">
                    Sign in -&gt;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] bg-white/40 py-12">
        <div className="app-page">
          <div className="mb-8 flex justify-center text-center">
            <div className="max-w-md space-y-4">
              <AppLogo href="/landing" tone="dark" caption="" />
              <p className="text-sm text-[var(--foreground-secondary)]">
                Tender and awarded-contract management for South African professional-services firms.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center justify-between border-t border-[var(--line)] pt-8 text-sm text-[var(--muted)] sm:flex-row">
            <p>&copy; 2026 Bid360. All rights reserved.</p>
            <p>Built for firms behind South Africa&apos;s biggest projects.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function TrustItem({ title, body, text }) {
  return (
    <div>
      {text ? (
        <p className="text-sm font-semibold text-[var(--brand-600)]">{text}</p>
      ) : (
        <>
          <p className="text-sm font-semibold text-[var(--brand-600)]">{title}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
        </>
      )}
    </div>
  )
}

function DashboardItem({ label, value, text }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/50 p-4">
      <div>
        {text ? (
          <p className="font-semibold text-[var(--foreground)]">{text}</p>
        ) : (
          <>
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="font-semibold text-[var(--foreground)]">{value}</p>
          </>
        )}
      </div>
      <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-500)]" aria-hidden="true" />
    </div>
  )
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="app-card group">
      <div className="mb-4 inline-flex rounded-md border border-[var(--line)] bg-[var(--background-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--brand-600)]">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-bold">{title}</h3>
      <p className="text-sm text-[var(--foreground-secondary)]">{description}</p>
    </div>
  )
}

function SectorCard({ title, description, features }) {
  return (
    <div className="app-card">
      <h3 className="mb-2 text-xl font-bold">{title}</h3>
      <p className="mb-6 text-sm text-[var(--foreground-secondary)]">{description}</p>
      <ul className="space-y-2">
        {features.map(feature => (
          <li key={feature} className="flex items-center gap-2 text-sm">
            <span className="text-[var(--brand-500)]">✓</span>
            {feature}
          </li>
        ))}
      </ul>
    </div>
  )
}

function StepCard({ step, title, description }) {
  return (
    <div className="space-y-4 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-500)] text-lg font-bold text-white">
        {step}
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="text-sm text-[var(--foreground-secondary)]">{description}</p>
    </div>
  )
}
