import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const packageJson = JSON.parse(read('package.json'))
const renovate = JSON.parse(read('renovate.json'))
const dockerfile = read('Dockerfile')
const dockerignore = read('.dockerignore')
const workflow = read('.github/workflows/ci-build.yml')
const nodeVersion = read('.node-version').trim()
const failures = []

const requireInvariant = (condition, message) => {
  if (!condition) failures.push(message)
}

const nodeParts = nodeVersion.split('.')
const packageManagerMatch = /^npm@(\d+\.\d+\.\d+)$/.exec(packageJson.packageManager ?? '')

requireInvariant(/^\d+\.\d+\.\d+$/.test(nodeVersion), '.node-version must contain an exact Node.js version')
requireInvariant(
  packageJson.engines?.node === `${nodeParts[0]}.${nodeParts[1]}.x`,
  'package.json engines.node must match the pinned Node.js major/minor version',
)
requireInvariant(Boolean(packageManagerMatch), 'packageManager must pin an exact npm version')
requireInvariant(
  packageManagerMatch && packageJson.engines?.npm === `${packageManagerMatch[1].split('.').slice(0, 2).join('.')}.x`,
  'package.json engines.npm must match the pinned npm major/minor version',
)

const fromLines = dockerfile.match(/^FROM\s+.+$/gm) ?? []
requireInvariant(fromLines.length === 2, 'Dockerfile must keep exactly two pinned build stages')
for (const fromLine of fromLines) {
  requireInvariant(
    /^FROM\s+[^\s:]+(?:\/[^\s:]+)*:[^\s@]+@sha256:[a-f0-9]{64}(?:\s+AS\s+\S+)?$/.test(fromLine),
    `Docker base must use an explicit tag and sha256 digest: ${fromLine}`,
  )
}
requireInvariant(
  dockerfile.includes(`FROM node:${nodeVersion}-alpine@sha256:`),
  'Docker build stage must use the version from .node-version',
)
requireInvariant(dockerfile.includes('RUN npm ci --ignore-scripts'), 'Docker dependency install must use npm ci --ignore-scripts')
requireInvariant(
  dockerignore.includes('!.github/workflows/ci-build.yml'),
  'Docker build context must retain the workflow used by the supply-chain check',
)
for (const generatedPath of ['coverage', 'test-results', 'stock-analyst-ui.spdx.json']) {
  requireInvariant(
    dockerignore.split(/\r?\n/).includes(generatedPath),
    `Docker build context must exclude generated output: ${generatedPath}`,
  )
}

const actionReferences = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#\s*(.+))?$/gm)]
requireInvariant(actionReferences.length > 0, 'CI workflow must contain actions')
for (const [, reference, annotation] of actionReferences) {
  if (reference.startsWith('./')) continue
  requireInvariant(
    /@[a-f0-9]{40}$/.test(reference),
    `GitHub Action must be pinned to a full commit SHA: ${reference}`,
  )
  requireInvariant(Boolean(annotation), `Pinned GitHub Action must retain a readable version comment: ${reference}`)
}

requireInvariant(workflow.includes("node-version-file: '.node-version'"), 'CI must consume .node-version')
requireInvariant(workflow.includes('run: npm run docs:check'), 'CI must gate documentation contracts')
requireInvariant(workflow.includes('npm ci --ignore-scripts'), 'CI dependency install must disable package lifecycle scripts')

requireInvariant(
  JSON.stringify(renovate.extends) === JSON.stringify(['github>krbob/renovate-config:monthly']),
  'Renovate must inherit the shared monthly update policy',
)
requireInvariant(
  !renovate.packageRules?.some((rule) => rule.automerge === false),
  'Package rules must not disable automerge for selected dependencies',
)

if (failures.length > 0) {
  console.error('Supply-chain policy violations:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(
    `Supply-chain policy valid: Node ${nodeVersion}, ${fromLines.length} Docker bases, ${actionReferences.length} action references`,
  )
}
