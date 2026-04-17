import { PrismaClient } from '@prisma/client'

// Support Supabase's Vercel integration env vars without requiring manual aliases.
process.env.DATABASE_URL ||= process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL
process.env.DIRECT_URL ||= process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL

function getPrismaDatasourceUrl() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return undefined

  try {
    const url = new URL(databaseUrl)

    // In local dev and local production-style runs, Prisma can reuse a session
    // pooler connection more effectively than the transaction pooler URL that
    // Vercel integrations default to. This trims a few seconds off repeated
    // queries without changing the deployed production configuration.
    if (
      process.env.NODE_ENV !== 'production' &&
      !process.env.VERCEL &&
      url.hostname.endsWith('.pooler.supabase.com')
    ) {
      url.port = '5432'
      url.searchParams.delete('pgbouncer')
      url.searchParams.delete('connection_limit')
      return url.toString()
    }
  } catch {
    return databaseUrl
  }

  return databaseUrl
}

// Prevent multiple Prisma instances during development (Next.js hot reload)
const globalForPrisma = globalThis
const prismaOptions = {}
const datasourceUrl = getPrismaDatasourceUrl()

if (datasourceUrl) {
  prismaOptions.datasourceUrl = datasourceUrl
}

const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaOptions)

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
