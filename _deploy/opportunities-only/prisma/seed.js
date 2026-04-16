// Run with: npx prisma db seed
// This creates demo data so you can see the app in action immediately.

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding BidFlow demo data...')

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@bidflow.co.za' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@bidflow.co.za',
      password: hashedPassword,
      role: 'admin',
    },
  })

  // Create a team member
  const memberPassword = await bcrypt.hash('member123', 10)
  const member = await prisma.user.upsert({
    where: { email: 'thabo@bidflow.co.za' },
    update: {},
    create: {
      name: 'Thabo Nkosi',
      email: 'thabo@bidflow.co.za',
      password: memberPassword,
      role: 'member',
    },
  })

  // Create demo tenders
  const tender1 = await prisma.tender.create({
    data: {
      title: 'Legal Advisory Services for eThekwini Municipality',
      reference: 'ETH-2024-LEGAL-001',
      entity: 'eThekwini Metropolitan Municipality',
      description: 'Appointment of a panel of legal advisors to provide legal advisory, litigation and conveyancing services.',
      deadline: new Date('2024-12-15T11:00:00'),
      briefingDate: new Date('2024-11-20T10:00:00'),
      contactPerson: 'Ms Nompumelelo Dlamini',
      contactEmail: 'tenders@ethekwini.gov.za',
      status: 'In Progress',
      assignedTo: 'Thabo Nkosi, Admin User',
      notes: 'Compulsory briefing session — attendance required. Bring proof of CSD registration.',
      userId: admin.id,
    },
  })

  const tender2 = await prisma.tender.create({
    data: {
      title: 'Supply and Delivery of Office Furniture — SAPS Western Cape',
      reference: 'SAPS-WC-2024-0089',
      entity: 'South African Police Service',
      description: 'Supply and delivery of office furniture for SAPS Western Cape provincial offices.',
      deadline: new Date('2024-11-30T12:00:00'),
      briefingDate: null,
      contactPerson: 'Lt Col Petersen',
      contactEmail: 'procurement@saps.gov.za',
      status: 'Submitted',
      assignedTo: 'Admin User',
      userId: admin.id,
    },
  })

  const tender3 = await prisma.tender.create({
    data: {
      title: 'IT Infrastructure Upgrade — Gauteng Department of Health',
      reference: 'GDOH-ICT-2024-015',
      entity: 'Gauteng Department of Health',
      description: 'Upgrading of server infrastructure, networking equipment and workstations across 5 health facilities.',
      deadline: new Date('2025-01-20T11:00:00'),
      status: 'New',
      userId: admin.id,
    },
  })

  // Add checklist items to tender 1
  await prisma.tenderChecklistItem.createMany({
    data: [
      { label: 'Tax Clearance Certificate (SARS)', done: true, tenderId: tender1.id, responsible: 'Admin User' },
      { label: 'CSD (Central Supplier Database) Registration', done: true, tenderId: tender1.id },
      { label: 'B-BBEE Certificate', done: true, tenderId: tender1.id, responsible: 'Thabo Nkosi' },
      { label: 'Company Registration Documents (CIPC)', done: true, tenderId: tender1.id },
      { label: 'Pricing Schedule', done: false, tenderId: tender1.id, responsible: 'Admin User', dueDate: new Date('2024-12-10') },
      { label: 'SBD 1 — Invitation to Bid', done: false, tenderId: tender1.id },
      { label: 'SBD 4 — Declaration of Interest', done: false, tenderId: tender1.id },
      { label: 'SBD 6.1 — Preference Points Claim', done: false, tenderId: tender1.id },
      { label: 'Technical Proposal / Methodology', done: false, tenderId: tender1.id, responsible: 'Thabo Nkosi' },
    ],
  })

  // Add checklist to tender 2 (mostly done — submitted)
  await prisma.tenderChecklistItem.createMany({
    data: [
      { label: 'Tax Clearance Certificate (SARS)', done: true, tenderId: tender2.id },
      { label: 'CSD Registration', done: true, tenderId: tender2.id },
      { label: 'B-BBEE Certificate', done: true, tenderId: tender2.id },
      { label: 'Company Registration', done: true, tenderId: tender2.id },
      { label: 'Pricing Schedule', done: true, tenderId: tender2.id },
      { label: 'SBD Forms', done: true, tenderId: tender2.id },
    ],
  })

  // Create a demo contract (from an old awarded tender)
  const contract = await prisma.contract.create({
    data: {
      title: 'Legal Services — City of Cape Town 2023',
      client: 'City of Cape Town',
      startDate: new Date('2023-03-01'),
      endDate: new Date('2025-02-28'),
      renewalDate: new Date('2025-01-15'),
      value: 1500000,
      notes: 'Annual retainer for municipal legal advisory services. 3-year contract with optional 2-year extension.',
    },
  })

  // Create a demo appeal
  const appeal = await prisma.appeal.create({
    data: {
      reason: 'Incorrectly scored on B-BBEE criteria — Level 1 certificate not properly recognized',
      deadline: new Date('2024-12-05'),
      status: 'Pending',
      tenderId: tender2.id,
      notes: 'Our B-BBEE Level 1 certificate was issued by a SANAS-accredited agency. The evaluation committee appears to have applied incorrect weighting.',
      template: `[Date]

City of Cape Town
Civic Centre, 12 Hertzog Boulevard
Cape Town, 8001

Dear Sir/Madam,

RE: INTENTION TO APPEAL — SAPS-WC-2024-0089: Supply and Delivery of Office Furniture

We, [COMPANY NAME], hereby give formal notice of our intention to appeal the award decision made in respect of the above tender.

We believe the scoring of our B-BBEE certificate was incorrectly applied, resulting in an inaccurate preference point calculation that disadvantaged our bid.

We request that the award be placed on hold pending the outcome of this appeal.

Yours faithfully,

[NAME]
[DESIGNATION]
[COMPANY NAME]`,
    },
  })

  // Create some notifications
  await prisma.notification.createMany({
    data: [
      {
        message: 'Tender deadline approaching: Legal Advisory Services for eThekwini — due 15 Dec 2024',
        type: 'warning',
        read: false,
      },
      {
        message: 'Contract "Legal Services — City of Cape Town 2023" expires in 60 days. Renewal date: 15 Jan 2025.',
        type: 'warning',
        read: false,
      },
      {
        message: 'Welcome to BidFlow! Start by creating your first tender.',
        type: 'info',
        read: true,
      },
    ],
  })

  // Log some activities
  await prisma.activityLog.createMany({
    data: [
      { action: 'Created tender: Legal Advisory Services for eThekwini Municipality', userId: admin.id, tenderId: tender1.id },
      { action: 'Created tender: Supply and Delivery of Office Furniture — SAPS Western Cape', userId: admin.id, tenderId: tender2.id },
      { action: 'Status changed from "In Progress" to "Submitted" on tender: Supply and Delivery of Office Furniture', userId: admin.id, tenderId: tender2.id },
      { action: 'Created contract: Legal Services — City of Cape Town 2023', userId: admin.id, contractId: contract.id },
      { action: 'Created appeal for tender ID ' + tender2.id + ': Incorrectly scored on B-BBEE criteria', userId: admin.id, appealId: appeal.id, tenderId: tender2.id },
      { action: 'Checklist item "Tax Clearance Certificate (SARS)" marked as done', userId: admin.id, tenderId: tender1.id },
      { action: 'Checklist item "B-BBEE Certificate" marked as done', userId: member.id, tenderId: tender1.id },
    ],
  })

  console.log('✅ Seed complete!')
  console.log('')
  console.log('Demo login credentials:')
  console.log('  Admin:  admin@bidflow.co.za / admin123')
  console.log('  Member: thabo@bidflow.co.za / member123')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
