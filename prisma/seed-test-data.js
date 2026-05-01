const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding test data...')

  try {
    // Create test users
    console.log('\nCreating test users...')

    // Admin user
    const admin = await prisma.user.upsert({
      where: { email: 'admin@bidflow.test' },
      update: {},
      create: {
        name: 'Admin User',
        email: 'admin@bidflow.test',
        password: await bcrypt.hash('admin123', 10),
        role: 'admin',
      },
    })

    // Manager user
    const manager = await prisma.user.upsert({
      where: { email: 'manager@bidflow.test' },
      update: {},
      create: {
        name: 'Manager User',
        email: 'manager@bidflow.test',
        password: await bcrypt.hash('manager123', 10),
        role: 'manager',
      },
    })

    // Staff user
    const staff = await prisma.user.upsert({
      where: { email: 'staff@bidflow.test' },
      update: {},
      create: {
        name: 'Staff User',
        email: 'staff@bidflow.test',
        password: await bcrypt.hash('staff123', 10),
        role: 'staff',
      },
    })

    console.log('✅ Users created successfully:')
    console.log(`   Admin:   ${admin.email} / admin123`)
    console.log(`   Manager: ${manager.email} / manager123`)
    console.log(`   Staff:   ${staff.email} / staff123`)

    // Create test organization
    console.log('\nCreating test organization...')

    const org = await prisma.organization.upsert({
      where: { slug: 'test-firm' },
      update: {},
      create: {
        name: 'Test Architecture Firm',
        slug: 'test-firm',
      },
    })

    console.log(`✅ Organization created: ${org.name}`)

    // Add users to organization
    console.log('\nAdding users to organization...')

    await prisma.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: admin.id,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        userId: admin.id,
        role: 'admin',
      },
    })

    await prisma.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: manager.id,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        userId: manager.id,
        role: 'manager',
      },
    })

    await prisma.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: staff.id,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        userId: staff.id,
        role: 'member',
      },
    })

    console.log('✅ Users added to organization')

    // Create firm profile
    console.log('\nCreating firm profile...')

    await prisma.firmProfile.upsert({
      where: { organizationId: org.id },
      update: {},
      create: {
        organizationId: org.id,
        displayName: 'Test Architecture Firm',
        serviceSector: 'BUILT_ENVIRONMENT',
      },
    })

    console.log('✅ Firm profile created')

    console.log('\n✨ Test data seeding complete!')
    console.log('\n📋 TEST CREDENTIALS:')
    console.log('═════════════════════════════════════════')
    console.log('Admin User:')
    console.log('  Email:    admin@bidflow.test')
    console.log('  Password: admin123')
    console.log('')
    console.log('Manager User:')
    console.log('  Email:    manager@bidflow.test')
    console.log('  Password: manager123')
    console.log('')
    console.log('Staff User:')
    console.log('  Email:    staff@bidflow.test')
    console.log('  Password: staff123')
    console.log('═════════════════════════════════════════')
    console.log('\nOrganization: Test Architecture Firm')
    console.log('All users are members of this organization')
    console.log('\n🚀 Ready to test! Access the app at http://localhost:3000')
  } catch (e) {
    console.error('\n❌ Error seeding data:', e.message)
    console.error('\nFull error:', e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
