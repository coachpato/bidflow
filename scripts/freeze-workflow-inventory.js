const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const appRoot = path.join(repoRoot, 'app')
const outputDir = path.join(repoRoot, 'rollout')
const outputFile = path.join(outputDir, 'workflow-inventory.json')

const WORKFLOW_RULES = [
  { key: 'auth', matchers: ['/(auth)/', '/api/auth/'] },
  { key: 'opportunities', matchers: ['/opportunities/', '/api/opportunities/'] },
  { key: 'pursuits_tenders', matchers: ['/pursuits/', '/tenders/', '/api/pursuits/', '/api/tenders/'] },
  { key: 'contracts', matchers: ['/contracts/', '/appointments/', '/api/contracts/'] },
  { key: 'appeals', matchers: ['/appeals/', '/challenges/', '/api/appeals/'] },
  { key: 'firm_settings', matchers: ['/firm/', '/settings/', '/api/firm/', '/api/settings/'] },
  { key: 'cross_cutting', matchers: ['/dashboard/', '/inbox/', '/notifications/', '/activity/', '/vault/', '/api/webhooks/'] },
]

function walk(dir, collector = []) {
  if (!fs.existsSync(dir)) return collector
  const items = fs.readdirSync(dir, { withFileTypes: true })
  for (const item of items) {
    const fullPath = path.join(dir, item.name)
    if (item.isDirectory()) {
      walk(fullPath, collector)
      continue
    }
    collector.push(fullPath)
  }
  return collector
}

function toPosixRelative(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/')
}

function classify(relPath) {
  const withLeadingSlash = `/${relPath}`
  for (const rule of WORKFLOW_RULES) {
    if (rule.matchers.some(matcher => withLeadingSlash.includes(matcher))) {
      return rule.key
    }
  }
  return 'unclassified'
}

function summarize(files) {
  const byWorkflow = {}
  for (const file of files) {
    const workflow = classify(file)
    if (!byWorkflow[workflow]) {
      byWorkflow[workflow] = { pages: [], layouts: [], apis: [], other: [] }
    }
    if (file.endsWith('/page.js')) byWorkflow[workflow].pages.push(file)
    else if (file.endsWith('/layout.js')) byWorkflow[workflow].layouts.push(file)
    else if (file.endsWith('/route.js')) byWorkflow[workflow].apis.push(file)
    else byWorkflow[workflow].other.push(file)
  }
  return byWorkflow
}

function main() {
  const allFiles = walk(appRoot)
    .map(toPosixRelative)
    .filter(relPath => relPath.endsWith('/page.js') || relPath.endsWith('/layout.js') || relPath.endsWith('/route.js'))

  const payload = {
    generatedAt: new Date().toISOString(),
    totalFiles: allFiles.length,
    byWorkflow: summarize(allFiles),
  }

  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Workflow inventory written to ${toPosixRelative(outputFile)}`)
}

main()
