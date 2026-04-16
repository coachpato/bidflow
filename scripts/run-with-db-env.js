const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const command = process.argv.slice(2).join(' ')

if (!command) {
  console.error('Usage: node scripts/run-with-db-env.js "<command>"')
  process.exit(1)
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  const fileEnv = {}
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const match = line.match(/^([\w.-]+)\s*=\s*(.*)$/)
    if (!match) continue

    const [, key, rawValue] = match
    let value = rawValue.trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1)
    }

    fileEnv[key] = value
  }

  return fileEnv
}

function parseUrl(value) {
  try {
    return value ? new URL(value) : null
  } catch {
    return null
  }
}

function commandNeedsDirectConnection(commandValue) {
  return /\bprisma\s+(migrate|db\s+(pull|push|execute|seed)|introspect)\b/i.test(commandValue)
}

function buildSupabaseSessionPoolerUrl(databaseUrl) {
  const pooledUrl = parseUrl(databaseUrl)
  if (!pooledUrl) return null
  if (!pooledUrl.hostname.endsWith('.pooler.supabase.com')) return null

  pooledUrl.port = '5432'
  pooledUrl.searchParams.delete('pgbouncer')
  pooledUrl.searchParams.delete('connection_limit')

  return pooledUrl.toString()
}

function shouldUseSupabaseSessionFallback(envValue, commandValue) {
  if (!commandNeedsDirectConnection(commandValue)) return false

  const databaseUrl = parseUrl(envValue.DATABASE_URL)
  const directUrl = parseUrl(envValue.DIRECT_URL)

  if (!databaseUrl || !directUrl) return false
  if (!databaseUrl.hostname.endsWith('.pooler.supabase.com')) return false

  // Supabase direct database hosts are IPv6-only by default. When they are not
  // reachable from this environment, Prisma migrate/introspection can fail with
  // a generic schema engine error. Falling back to the session pooler keeps
  // admin commands working in IPv4-only environments.
  return directUrl.hostname.startsWith('db.') && directUrl.hostname.endsWith('.supabase.co')
}

const root = process.cwd()
const fileEnv = {
  ...parseEnvFile(path.join(root, '.env')),
  ...parseEnvFile(path.join(root, '.env.local')),
}

const env = { ...fileEnv, ...process.env }

env.DATABASE_URL ||= env.POSTGRES_PRISMA_URL || env.POSTGRES_URL
env.DIRECT_URL ||= env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL

if (shouldUseSupabaseSessionFallback(env, command)) {
  const sessionPoolerUrl = buildSupabaseSessionPoolerUrl(env.DATABASE_URL)
  if (sessionPoolerUrl) {
    env.DIRECT_URL = sessionPoolerUrl
    console.warn(
      '[db-env] Using Supabase session pooler for Prisma admin commands because the direct host may be unreachable from this environment.'
    )
  }
}

const child = spawn(command, {
  stdio: 'inherit',
  shell: true,
  env,
})

child.on('exit', code => {
  process.exit(code ?? 1)
})
