import Link from 'next/link'
import AppLogo from '@/app/components/AppLogo'

export const metadata = {
  title: 'Privacy Policy - Bid360',
  description: 'Privacy Policy for Bid360 and Talita Consulting Services (Pty) Ltd.',
}

const sections = [
  {
    title: '1. Who we are',
    body: [
      'Talita Consulting Services (Pty) Ltd, trading as Bid360, is the responsible party for the personal information collected through this service.',
      'Registered office: 54 Smith Avenue, Eden Glen, Edenvale, 1609, South Africa',
      'Contact email: hello@bid360.co.za',
      'Information Officer: contactable at hello@bid360.co.za',
    ],
  },
  {
    title: '2. What information we collect',
    body: ['We collect the following categories of personal information:', 'Information you provide when you subscribe:'],
    list: [
      'Your email address',
      'Your entity or business name',
      'The sector you subscribe to',
      'Optional tender keywords and location preferences',
    ],
    afterList: ['Information about your use of the service:'],
    secondList: [
      'Subscription updates you make',
      'Digest delivery, unsubscribe, and basic usage data needed to operate the service',
    ],
    footer: [
      'Information from third-party sign-in:',
      'Bid360 does not use password or Google sign-in accounts for the subscription MVP.',
    ],
  },
  {
    title: '3. How we use your information',
    body: ['We use your personal information to:'],
    list: [
      'Provide the Bid360 subscription service to you and your entity',
      'Match public tender opportunities to your selected sector and preferences',
      'Send you tender digest emails and subscription-related notifications',
      'Maintain the security of the service and prevent abuse',
      'Respond to your enquiries and support requests',
      'Comply with our legal obligations',
    ],
    footer: ['We do not sell your personal information. We do not use it for advertising.'],
  },
  {
    title: '4. The lawful basis for processing',
    body: ['Under POPIA, we process your personal information on the following bases:'],
    list: [
      'Your consent, given when you subscribe and use the service',
      'Performance of our agreement with you (the Terms of Use)',
      'Our legitimate interests in operating, securing, and improving the service',
      'Compliance with the law',
    ],
    footer: ['You may withdraw your consent at any time by unsubscribing or contacting us, although this may mean we can no longer provide the service to you.'],
  },
  {
    title: '5. Who we share your information with',
    body: ['We share your personal information only with parties that help us operate the service. These include:'],
    list: [
      'Cloud hosting and database providers that store your data securely',
      'Email service providers that deliver our verification and digest emails',
      'Operational providers we use to secure and monitor the service',
    ],
    footer: [
      'We require these providers to handle your information responsibly and only on our instructions. We do not share your personal information with marketers, data brokers, or other third parties for their own purposes.',
      'We may disclose your information if required by South African law, by a court order, or to protect the rights and safety of Bid360, our users, or the public.',
    ],
  },
  {
    title: '6. Where your information is stored',
    body: ["Bid360's primary database is hosted in the European Union. Some of our service providers may process your information outside South Africa. When this happens, we take reasonable steps to ensure your information receives a level of protection equivalent to what POPIA requires."],
  },
  {
    title: '7. How long we keep your information',
    body: ['We keep your personal information for as long as your subscription is active. If you unsubscribe or ask us to delete your details, we will delete or anonymise your personal information within a reasonable period, except where we are required by law to retain it for longer.'],
  },
  {
    title: '8. How we protect your information',
    body: ['We use industry-standard technical and organisational measures to protect your information, including:'],
    list: [
      'Encrypted connections (HTTPS) for all traffic between you and Bid360',
      'Restricted access to subscription records',
      'Access controls limiting who can reach the production database',
      'Regular review of our security practices',
    ],
    footer: ['No system is perfectly secure. If we discover a security breach affecting your personal information, we will notify you and the Information Regulator as required by POPIA.'],
  },
  {
    title: '9. Your rights under POPIA',
    body: ['POPIA gives you the following rights in respect of your personal information:'],
    list: [
      'The right to know what information we hold about you',
      'The right to access that information',
      'The right to ask us to correct information that is inaccurate or incomplete',
      'The right to ask us to delete your information, subject to legal exceptions',
      'The right to object to certain types of processing',
      'The right to withdraw consent you previously gave',
      'The right to lodge a complaint with the Information Regulator',
    ],
    footer: ['To exercise any of these rights, contact our Information Officer at hello@bid360.co.za. We will respond within a reasonable period and free of charge.'],
  },
  {
    title: '10. The Information Regulator',
    body: [
      'If you are not satisfied with how we have handled your personal information, you have the right to complain to the Information Regulator of South Africa.',
      'Website: inforegulator.org.za',
      'Email: popiacomplaints@inforegulator.org.za',
    ],
  },
  {
    title: '11. Cookies and similar technologies',
    body: ['Bid360 uses only the cookies and browser storage needed to operate the service and protect public forms. We do not use cookies for advertising or third-party tracking.'],
  },
  {
    title: '12. Changes to this policy',
    body: ['We may update this policy from time to time. When we do, we will change the "Last updated" date at the top of this page. If the change is significant, we will notify subscribers by email.'],
  },
  {
    title: '13. Contact us',
    body: [
      'For any privacy-related question or request, contact:',
      'Talita Consulting Services (Pty) Ltd',
      '54 Smith Avenue, Eden Glen, Edenvale, 1609',
      'hello@bid360.co.za',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <LegalPageShell>
      <article className="app-surface mx-auto max-w-3xl rounded-[24px] p-6 sm:p-10 lg:p-12">
        <div className="space-y-5">
          <h1 className="app-display text-4xl font-bold text-[var(--brand-500)] sm:text-5xl">
            Privacy Policy
          </h1>
          <div className="space-y-4 text-base leading-7 text-[var(--foreground-secondary)]">
            <p>This Privacy Policy explains how Bid360 collects, uses, and protects your personal information. Bid360 is operated by Talita Consulting Services (Pty) Ltd (registration number 2019/623147/07), a company registered in South Africa.</p>
            <p>We take your privacy seriously and process personal information in accordance with the Protection of Personal Information Act, 2013 (POPIA).</p>
            <p>Last updated: 4 May 2026</p>
          </div>
        </div>

        <div className="mt-12 space-y-12">
          {sections.map(section => (
            <PolicySection key={section.title} section={section} />
          ))}
        </div>
      </article>
    </LegalPageShell>
  )
}

function PolicySection({ section }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-[var(--brand-500)]">{section.title}</h2>
      {section.body?.map(paragraph => (
        <p key={paragraph} className="text-base leading-7 text-[var(--foreground-secondary)]">
          {paragraph}
        </p>
      ))}
      {section.list && <LegalList items={section.list} />}
      {section.afterList?.map(paragraph => (
        <p key={paragraph} className="text-base leading-7 text-[var(--foreground-secondary)]">
          {paragraph}
        </p>
      ))}
      {section.secondList && <LegalList items={section.secondList} />}
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
