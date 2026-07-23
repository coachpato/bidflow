import Link from 'next/link'
import AppLogo from '@/app/components/AppLogo'

export const metadata = {
  title: 'Terms of Use - Bid360',
  description: 'Terms of Use for Bid360 and Talita Consulting Services (Pty) Ltd.',
}

const sections = [
  {
    title: '1. The service',
    body: [
      'Bid360 is a subscription service that helps South African entities discover public tender opportunities. We collect tender information from public sources, match it to your selected sector and preferences, and send digest emails.',
      'Bid360 is currently in pilot. The service is operational, but features may change, be added, or be removed as we develop the product. We will give you reasonable notice of significant changes.',
    ],
  },
  {
    title: '2. Subscriptions and eligibility',
    body: ['To use Bid360, you must:'],
    list: [
      'Be at least 18 years old',
      'Provide accurate registration information',
      'Provide accurate subscription information',
      'Be authorised to act on behalf of any entity whose details you provide',
    ],
    footer: ['You are responsible for the subscription details you provide. If you suspect unauthorised use of your email address, contact us immediately at hello@bid360.co.za.'],
  },
  {
    title: '3. Acceptable use',
    body: ['When using Bid360, you agree not to:'],
    list: [
      'Use the service for any unlawful purpose',
      'Misrepresent your identity or your firm',
      "Upload content that infringes another party's rights",
      "Attempt to access another subscriber's data",
      'Probe, scan, or test the security of the service',
      'Disrupt or interfere with the service',
      'Use automated tools to extract data from Bid360',
      'Resell or commercially exploit the service without our written agreement',
    ],
    footer: ['We may suspend or close subscriptions that we believe are being used in breach of these terms.'],
  },
  {
    title: '4. Tender information',
    body: ['Bid360 displays information about tenders that have been published on public sources, including South African government tender portals. We do our best to keep this information accurate and current, but:'],
    list: [
      'We do not control the public sources we collect from',
      'Tender information may be incomplete, delayed, or out of date',
      'Deadlines, contact details, and award status are determined by the issuing entity, not by Bid360',
      'You remain responsible for verifying tender details directly with the issuing entity before submitting a bid',
    ],
    footer: ['Bid360 is a tool to help you discover and manage opportunities. It is not a substitute for your own due diligence.'],
  },
  {
    title: '5. Your content',
    body: [
      'When you upload documents, notes, or other content to Bid360, you keep ownership of that content. You give us a limited licence to store, display, and process it for the purpose of providing the service to you.',
      "You confirm that you have the right to upload any content you place in Bid360, and that doing so does not breach anyone else's rights.",
    ],
  },
  {
    title: '6. Fees',
    body: ['Bid360 is currently free to use during the pilot. If we introduce paid plans in future, we will give you reasonable notice and you will not be charged without your explicit agreement.'],
  },
  {
    title: '7. Service availability',
    body: ['We aim to keep Bid360 available at all times, but we do not guarantee uninterrupted service. The service may be unavailable due to maintenance, upgrades, technical problems, or events outside our control.'],
  },
  {
    title: '8. Disclaimers',
    body: ['To the fullest extent permitted by South African law:'],
    list: [
      'Bid360 is provided "as is" and without warranties of any kind, whether express or implied',
      'We do not warrant that the service will be error-free, uninterrupted, or that any specific result will be achieved',
      'We do not warrant the accuracy, completeness, or timeliness of tender information displayed in the service',
      'You use Bid360 at your own discretion and risk',
    ],
    footer: ['Nothing in these terms excludes or limits any liability that cannot be excluded under South African law, including under the Consumer Protection Act, 2008.'],
  },
  {
    title: '9. Limitation of liability',
    body: ['To the fullest extent permitted by law, Talita Consulting Services (Pty) Ltd is not liable for:'],
    list: [
      'Indirect, consequential, or special damages',
      'Loss of profits, business, contracts, or revenue',
      'Loss of data',
      'Damages arising from your reliance on tender information shown in the service',
      'Damages arising from a tender being missed, mis-classified, or incorrectly displayed',
    ],
    footer: ['Our total liability for any claim arising out of these terms or your use of the service is limited to the amount, if any, you paid us in the twelve months before the event giving rise to the claim. During the pilot, when no fees are charged, this amount is zero.'],
  },
  {
    title: '10. Termination',
    body: [
      'You may unsubscribe at any time using your digest link, the manage page, or by contacting hello@bid360.co.za.',
      'We may suspend or terminate your subscription if you breach these terms, if we are required to do so by law, or if we discontinue the service. We will give you reasonable notice where possible.',
      'When your subscription ends, your right to receive the service ends. We will deal with your personal information in accordance with our Privacy Policy.',
    ],
  },
  {
    title: '11. Changes to these terms',
    body: ['We may update these terms from time to time. When we do, we will change the "Last updated" date at the top of this page. If the change is significant, we will notify subscribers by email. Your continued use of the service after a change means you accept the updated terms.'],
  },
  {
    title: '12. Governing law and disputes',
    body: ['These terms are governed by the laws of the Republic of South Africa. The courts of South Africa have exclusive jurisdiction over any dispute arising out of or relating to these terms or your use of Bid360.'],
  },
  {
    title: '13. Contact',
    body: [
      'Talita Consulting Services (Pty) Ltd',
      '54 Smith Avenue, Eden Glen, Edenvale, 1609',
      'hello@bid360.co.za',
    ],
  },
]

export default function TermsPage() {
  return (
    <LegalPageShell>
      <article className="app-surface mx-auto max-w-3xl rounded-[24px] p-6 sm:p-10 lg:p-12">
        <div className="space-y-5">
          <h1 className="app-display text-4xl font-bold text-[var(--brand-500)] sm:text-5xl">
            Terms of Use
          </h1>
          <div className="space-y-4 text-base leading-7 text-[var(--foreground-secondary)]">
            <p>These Terms of Use govern your access to and use of Bid360. Bid360 is provided by Talita Consulting Services (Pty) Ltd (registration number 2019/623147/07), trading as Bid360.</p>
            <p>By subscribing or using the service, you agree to these terms. Please read them carefully.</p>
            <p>Last updated: 4 May 2026</p>
          </div>
        </div>

        <div className="mt-12 space-y-12">
          {sections.map(section => (
            <TermsSection key={section.title} section={section} />
          ))}
        </div>
      </article>
    </LegalPageShell>
  )
}

function TermsSection({ section }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-[var(--brand-500)]">{section.title}</h2>
      {section.body?.map(paragraph => (
        <p key={paragraph} className="text-base leading-7 text-[var(--foreground-secondary)]">
          {paragraph}
        </p>
      ))}
      {section.list && <LegalList items={section.list} />}
      {section.footer?.map(paragraph => (
        <p key={paragraph} className="text-base leading-7 text-[var(--foreground-secondary)]">
          {paragraph}
        </p>
      ))}
    </section>
  )
}

function LegalList({ items }) {
  return (
    <ul className="list-disc space-y-2 pl-6 text-base leading-7 text-[var(--foreground-secondary)]">
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function LegalPageShell({ children }) {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#f3f1ec] via-[#faf8f5] to-[#f3f1ec]">
      <header className="border-b border-white/40 bg-white/70 backdrop-blur-md">
        <nav className="app-page flex items-center justify-between py-4 sm:py-5">
          <AppLogo href="/" tone="dark" caption="" />
          <div className="flex items-center gap-3">
            <Link href="/manage" className="app-button-secondary">
              Manage
            </Link>
            <Link href="/" className="app-button-primary">
              Subscribe
            </Link>
          </div>
        </nav>
      </header>
      <main className="app-page py-12 sm:py-16 lg:py-20">{children}</main>
      <LegalFooter />
    </div>
  )
}

function LegalFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-white/40 py-12">
      <div className="app-page">
        <div className="flex flex-col gap-8 border-b border-[var(--line)] pb-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <AppLogo />
            <p className="max-w-md text-sm text-[var(--foreground-secondary)]">
              South African tender digests matched to your sector.
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
          (c) 2026 Talita Consulting Services (Pty) Ltd, trading as Bid360.
        </p>
      </div>
    </footer>
  )
}
