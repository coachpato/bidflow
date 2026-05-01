const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const inventoryPath = path.join(repoRoot, 'rollout', 'workflow-inventory.json')

const REQUIRED_WORKFLOWS = [
  'auth',
  'opportunities',
  'pursuits_tenders',
  'contracts',
  'appeals',
  'firm_settings',
]

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function fileExists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath))
}

function checkWorkflowCoverage(inventory) {
  const failures = []
  for (const workflow of REQUIRED_WORKFLOWS) {
    const section = inventory.byWorkflow[workflow]
    if (!section) {
      failures.push(`Missing workflow section: ${workflow}`)
      continue
    }
    if (section.pages.length === 0) {
      failures.push(`No pages found in workflow: ${workflow}`)
    }
    if (section.apis.length === 0 && workflow !== 'firm_settings') {
      failures.push(`No API routes found in workflow: ${workflow}`)
    }
  }
  return failures
}

function checkCriticalPaths() {
  const criticalPaths = [
    'app/(auth)/login/page.js',
    'app/(auth)/register/page.js',
    'app/(dashboard)/dashboard/page.js',
    'app/(dashboard)/opportunities/page.js',
    'app/(dashboard)/pursuits/page.js',
    'app/(dashboard)/contracts/page.js',
    'app/(dashboard)/appeals/page.js',
    'app/api/auth/login/route.js',
    'app/api/opportunities/route.js',
    'app/api/pursuits/route.js',
    'app/api/contracts/route.js',
    'app/api/appeals/route.js',
  ]

  return criticalPaths.filter(criticalPath => !fileExists(criticalPath))
}

function main() {
  assert(fs.existsSync(inventoryPath), 'Inventory file missing. Run `npm run rollout:inventory` first.')
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'))

  const coverageFailures = checkWorkflowCoverage(inventory)
  const missingCriticalPaths = checkCriticalPaths()

  if (coverageFailures.length > 0 || missingCriticalPaths.length > 0) {
    console.error('Workflow regression failed.')
    if (coverageFailures.length > 0) {
      console.error('\nCoverage failures:')
      for (const failure of coverageFailures) console.error(`- ${failure}`)
    }
    if (missingCriticalPaths.length > 0) {
      console.error('\nMissing critical paths:')
      for (const failure of missingCriticalPaths) console.error(`- ${failure}`)
    }
    process.exit(1)
  }

  console.log('Workflow regression passed: inventory and critical paths are intact.')
}

main()
