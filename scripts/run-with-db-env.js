const { spawn } = require('node:child_process')

const command = process.argv.slice(2).join(' ')

if (!command) {
  console.error('Usage: node scripts/run-with-db-env.js "<command>"')
  process.exit(1)
}

const env = { ...process.env }

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
