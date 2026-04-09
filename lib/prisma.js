import { PrismaClient } from '@prisma/client'

// Support Supabase's Vercel integration env vars without requiring manual aliases.
process.env.DATABASE_URL ||= process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
process.env.DIRECT_URL ||= process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL

// Prevent multiple Prisma instances during development (Next.js hot reload)
const globalForPrisma = globalThis

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
