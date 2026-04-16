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

const root = process.cwd()
const fileEnv = {
  ...parseEnvFile(path.join(root, '.env')),
  ...parseEnvFile(path.join(root, '.env.local')),
}

const env = { ...fileEnv, ...process.env }

env.DATABASE_URL ||= env.POSTGRES_PRISMA_URL || env.POSTGRES_URL
env.DIRECT_URL ||= env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL

const child = spawn(command, {
  stdio: 'inherit',
  shell: true,
  env,
})

child.on('exit', code => {
  process.exit(code ?? 1)
})
