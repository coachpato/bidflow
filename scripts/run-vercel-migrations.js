const { spawn } = require('node:child_process')

const isVercelBuild = process.env.VERCEL === '1' || process.env.VERCEL === 'true'

if (!isVercelBuild) {
  console.log('[migrate] Skipping Prisma migrate deploy outside Vercel.')
  process.exit(0)
}

console.log('[migrate] Running Prisma migrate deploy on Vercel.')

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const child = spawn(command, ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: false,
  env: process.env,
})

child.on('exit', code => {
  process.exit(code ?? 1)
})
