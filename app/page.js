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
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div className="space-y-8 animate-slideInUp">
              <div className="inline-flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-var(--brand-500)" />
                <span className="app-kicker">Built for South Africa's biggest projects</span>
              </div>

              <div className="space-y-6">
                <h1 className="app-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                  Bid360<br />
                  <span className="text-[var(--accent-500)]">for Tenders & Contracts</span>
                </h1>
                <p className="text-lg leading-relaxed max-w-xl text-[var(--foreground-secondary)]">
                  Stop managing tenders in spreadsheets. Bid360 is the only workspace built for built environment, legal, and accounting firms behind South Africa's biggest projects.
                </p>
              </div>

              <div className="flex flex-wrap gap-4 pt-4">
                <Link href="/register" className="app-button-primary app-button-lg">
                  Create workspace
                </Link>
                <a href="#features" className="app-button-secondary app-button-lg">
                  Learn more
                </a>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-8 border-t border-[var(--line)]">
                <StatItem number="500+" label="Tenders" />
                <StatItem number="50+" label="Firms" />
                <StatItem number="R1B+" label="Value tracked" />
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--brand-500)]/10 to-[var(--accent-500)]/10 rounded-3xl blur-3xl" />
              <div className="relative bg-white/80 backdrop-blur rounded-3xl border border-white/60 shadow-xl p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold">Your Dashboard</h3>
                  <span className="app-badge app-badge-success">Live</span>
                </div>
                <div className="space-y-4">
                  <DashboardItem icon="📊" label="New opportunities" value="12 matches" />
                  <DashboardItem icon="📋" label="Active pursuits" value="8 bids" />
                  <DashboardItem icon="✅" label="Awarded" value="2 contracts" />
                  <DashboardItem icon="⚖️" label="Challenges" value="1 deadline" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="border-t border-[var(--line)] py-16 sm:py-24 bg-white/30">
          <div className="app-page space-y-16">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="app-kicker">Features</span>
              <h2 className="app-display text-4xl sm:text-5xl font-bold">
                Built for your firm's workflow
              </h2>
              <p className="text-lg text-[var(--foreground-secondary)]">
                Everything you need to discover, pursue, and track tenders and contracts in one place.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon="🎯"
                title="Smart Tender Radar"
                description="AI-powered matching finds the right tenders for your firm's sector, experience, and location."
              />
              <FeatureCard
                icon="📈"
                title="Disciplined Pursuits"
                description="Run active bids with clear deadlines, document checklists, and team accountability."
              />
              <FeatureCard
                icon="📎"
                title="Document Management"
                description="Upload, organize, and manage tender documents, BEE certificates, and compliance files."
              />
              <FeatureCard
                icon="🏆"
                title="Award Tracking"
                description="Keep awarded tenders visible as contracts. Track dates, appointments, and reminders."
              />
              <FeatureCard
                icon="⚖️"
                title="Challenge Management"
                description="Manage bid protests and appeals with clear timelines and communication trails."
              />
              <FeatureCard
                icon="👥"
                title="Team Collaboration"
                description="Assign tenders, track progress, and communicate without leaving the workspace."
              />
            </div>
          </div>
        </section>

        {/* Sectors Section */}
        <section className="py-16 sm:py-24 border-t border-[var(--line)]">
          <div className="app-page space-y-16">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="app-kicker">Choose your sector</span>
              <h2 className="app-display text-4xl sm:text-5xl font-bold">
                Tailored for your industry
              </h2>
              <p className="text-lg text-[var(--foreground-secondary)]">
                Bid360 is customized for the unique workflows of each sector.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              <SectorCard
                title="Built Environment"
                description="For engineers, quantity surveyors, architects, and project managers."
                features={['Engineering frameworks', 'Project experience', 'CIDB compliance']}
              />
              <SectorCard
                title="Legal"
                description="For law firms and attorneys doing government and state work."
                features={['Legal frameworks', 'B-BBEE compliance', 'SBD forms']}
              />
              <SectorCard
                title="Accounting"
                description="For audit, tax, and advisory firms serving public sector."
                features={['Accounting frameworks', 'Audit experience', 'Tax compliance']}
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
                Quick setup in minutes
              </h2>
            </div>

            <div className="grid gap-8 md:grid-cols-4">
              <StepCard step="1" title="Create workspace" description="Sign up with your email and choose your sector." />
              <StepCard step="2" title="Build your profile" description="Add firm details, certifications, and experience." />
              <StepCard step="3" title="Start discovering" description="Connect your tenderer accounts and get matched." />
              <StepCard step="4" title="Track & win" description="Manage pursuits, submissions, and awards." />
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
                    Ready to bid smarter?
                  </h2>
                  <p className="text-lg text-white/90">
                    Join firms across South Africa that are winning more tenders with Bid360.
                  </p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <Link href="/register" className="app-button-primary">
                    Start free trial
                  </Link>
                  <Link href="/login" className="text-white hover:underline font-semibold">
                    Sign in →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--line)] bg-white/40 py-12">
        <div className="app-page">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="space-y-4">
              <h4 className="font-bold">Bid360</h4>
              <p className="text-sm text-[var(--foreground-secondary)]">
                Tender and contract management for South African firms.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="font-bold text-sm uppercase tracking-wider">Product</h4>
              <ul className="space-y-2 text-sm text-[var(--foreground-secondary)]">
                <li><a href="#features" className="hover:text-[var(--brand-500)]">Features</a></li>
                <li><a href="#features" className="hover:text-[var(--brand-500)]">Pricing</a></li>
                <li><a href="#" className="hover:text-[var(--brand-500)]">Security</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-bold text-sm uppercase tracking-wider">Company</h4>
              <ul className="space-y-2 text-sm text-[var(--foreground-secondary)]">
                <li><a href="#" className="hover:text-[var(--brand-500)]">About</a></li>
                <li><a href="#" className="hover:text-[var(--brand-500)]">Blog</a></li>
                <li><a href="#" className="hover:text-[var(--brand-500)]">Contact</a></li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-bold text-sm uppercase tracking-wider">Legal</h4>
              <ul className="space-y-2 text-sm text-[var(--foreground-secondary)]">
                <li><a href="#" className="hover:text-[var(--brand-500)]">Privacy</a></li>
                <li><a href="#" className="hover:text-[var(--brand-500)]">Terms</a></li>
                <li><a href="#" className="hover:text-[var(--brand-500)]">Cookies</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[var(--line)] pt-8 flex flex-col sm:flex-row justify-between items-center text-sm text-[var(--muted)]">
            <p>&copy; 2026 Bid360. All rights reserved.</p>
            <p>Built for firms behind South Africa's biggest projects.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Component: Statistics
function StatItem({ number, label }) {
  return (
    <div>
      <p className="text-2xl sm:text-3xl font-bold text-[var(--brand-500)]">{number}</p>
      <p className="text-sm text-[var(--muted)]">{label}</p>
    </div>
  )
}

// Component: Dashboard Preview Item
function DashboardItem({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white/50 rounded-lg">
      <div>
        <p className="text-sm text-[var(--muted)]">{label}</p>
        <p className="font-semibold text-[var(--foreground)]">{value}</p>
      </div>
      <span className="text-2xl">{icon}</span>
    </div>
  )
}

// Component: Feature Card
function FeatureCard({ icon, title, description }) {
  return (
    <div className="app-card group">
      <div className="text-4xl mb-4">{icon}</div>
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
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="text-[var(--brand-500)]">✓</span>
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
