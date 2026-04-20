import Header from '@/app/components/Header'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import { ensureOrganizationContext } from '@/lib/organization'
import { getServiceSectorLabel } from '@/lib/service-sectors'
import FirmProfileForm from './FirmProfileForm'
import FirmPeopleManager from './FirmPeopleManager'
import FirmExperienceManager from './FirmExperienceManager'

function formatJoinedList(values, fallback = 'Not set yet') {
  return Array.isArray(values) && values.length > 0 ? values.join(', ') : fallback
}

function formatCurrency(value) {
  if (value === null || value === undefined) return 'Not set yet'
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value)
}

export default async function FirmPage() {
  const session = await requireAuth()
  const organizationContext = await ensureOrganizationContext(session.userId)

  const memberships = await prisma.membership.findMany({
    where: { organizationId: organizationContext.organization.id },
    orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  })
  const people = await prisma.firmPerson.findMany({
    where: { organizationId: organizationContext.organization.id },
    orderBy: [{ yearsExperience: 'desc' }, { fullName: 'asc' }],
  })
  const experience = await prisma.firmExperience.findMany({
    where: { organizationId: organizationContext.organization.id },
    orderBy: [{ completedYear: 'desc' }, { matterName: 'asc' }],
  })

  const meta = [
    { label: 'Organization', value: organizationContext.organization.name },
    { label: 'Sector', value: getServiceSectorLabel(organizationContext.firmProfile.serviceSector) },
    { label: 'Team members', value: `${memberships.length}` },
    { label: 'Practice areas', value: `${organizationContext.firmProfile.practiceAreas.length}` },
    { label: 'Key people', value: `${people.length}` },
    { label: 'Experience records', value: `${experience.length}` },
  ]

  return (
    <div className="space-y-6">
      <Header
        title="Firm workspace"
        eyebrow="Matching setup"
        meta={meta}
        secondaryAction={{ href: '/dashboard', label: 'Back to dashboard' }}
      />

      <div className="app-page grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <FirmProfileForm initialProfile={organizationContext.firmProfile} />

        <div className="space-y-6">
          <section className="app-surface rounded-[24px] p-5">
            <h2 className="text-xl font-semibold text-slate-950">Current focus</h2>
            <dl className="mt-4 space-y-4 text-sm text-slate-600">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sector</dt>
                <dd className="mt-1 leading-6 text-slate-900">
                  {getServiceSectorLabel(organizationContext.firmProfile.serviceSector)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Practice areas</dt>
                <dd className="mt-1 leading-6 text-slate-900">
                  {formatJoinedList(organizationContext.firmProfile.practiceAreas)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Preferred entities</dt>
                <dd className="mt-1 leading-6 text-slate-900">
                  {formatJoinedList(organizationContext.firmProfile.preferredEntities)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Target work</dt>
                <dd className="mt-1 leading-6 text-slate-900">
                  {formatJoinedList(organizationContext.firmProfile.targetWorkTypes)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Target provinces</dt>
                <dd className="mt-1 leading-6 text-slate-900">
                  {formatJoinedList(organizationContext.firmProfile.targetProvinces)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Target value band</dt>
                <dd className="mt-1 leading-6 text-slate-900">
                  {organizationContext.firmProfile.minimumContractValue || organizationContext.firmProfile.maximumContractValue
                    ? `${formatCurrency(organizationContext.firmProfile.minimumContractValue)} to ${formatCurrency(organizationContext.firmProfile.maximumContractValue)}`
                    : 'Not set yet'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="app-surface rounded-[24px] p-5">
            <h2 className="text-xl font-semibold text-slate-950">Team linked to this workspace</h2>
            <div className="mt-4 space-y-3">
              {memberships.map(member => (
                <div key={member.id} className="rounded-[18px] border border-slate-200 bg-white/80 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{member.user.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{member.user.email}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Workspace role: {member.role}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="app-surface rounded-[24px] p-5">
            <h2 className="text-xl font-semibold text-slate-950">Operating notes</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>Populate the firm profile with value bands, entities, and practice areas so the opportunity radar stays relevant.</li>
              <li>Add the people and experience records you want visible when the team reviews opportunities and active pursuits.</li>
              <li>Keep this workspace current so the same firm context follows the team from discovery into live pursuits.</li>
            </ul>
          </section>
        </div>
      </div>

      <div className="app-page grid gap-6 xl:grid-cols-2">
        <FirmPeopleManager initialPeople={people} />
        <FirmExperienceManager initialExperience={experience} />
      </div>
    </div>
  )
}
