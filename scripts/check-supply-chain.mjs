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
requireInvariant(workflow.includes('npm audit --audit-level=high'), 'CI must gate HIGH and CRITICAL npm advisories')
requireInvariant(workflow.includes('anchore/sbom-action@'), 'CI must generate an image SBOM')
requireInvariant(workflow.includes('format: spdx-json'), 'CI image SBOM must use SPDX JSON')
requireInvariant(workflow.includes('aquasecurity/trivy-action@'), 'CI must scan the built image')
requireInvariant(workflow.includes('ignore-unfixed: true'), 'Image vulnerability gate must focus on actionable findings')
requireInvariant(workflow.includes('severity: HIGH,CRITICAL'), 'Image vulnerability gate must cover HIGH and CRITICAL findings')
requireInvariant(workflow.includes('timeout: 15m'), 'Image vulnerability gate must tolerate a cold vulnerability database download')

requireInvariant(renovate.branchPrefix === 'renovate/', 'Renovate branch prefix must remain explicit')
requireInvariant(renovate.prCreation === 'immediate', 'Renovate must create pull requests for dependency branches')
requireInvariant(renovate.timezone === 'Europe/Warsaw', 'Renovate must use the ecosystem timezone')
requireInvariant(
  JSON.stringify(renovate.schedule) === JSON.stringify(['at any time']),
  'Renovate must create mature dependency pull requests continuously',
)
requireInvariant(renovate.automerge === true, 'Every Renovate update must be eligible for automerge')
requireInvariant(renovate.automergeType === 'pr', 'Renovate must merge through pull requests')
requireInvariant(renovate.automergeStrategy === 'squash', 'Renovate must squash dependency pull requests')
requireInvariant(renovate.platformAutomerge === false, 'Platform automerge must stay disabled to enforce the monthly window')
requireInvariant(renovate.ignoreTests === false, 'Renovate automerge must require passing tests')
requireInvariant(
  JSON.stringify(renovate.automergeSchedule) === JSON.stringify(['* * 1-3 * *']),
  'Renovate may automerge only during the first three days of each month',
)
requireInvariant(renovate.rebaseWhen === 'behind-base-branch', 'Renovate branches must stay current before merge')
requireInvariant(renovate.updateNotScheduled === true, 'Existing Renovate branches must update outside the creation window')
requireInvariant(renovate.minimumReleaseAge === '7 days', 'Renovate updates must retain a seven-day maturity delay')
requireInvariant(
  renovate.minimumReleaseAgeBehaviour === 'timestamp-optional',
  'Renovate updates without release timestamps must remain eligible',
)
requireInvariant(renovate.lockFileMaintenance?.automerge === true, 'Lockfile maintenance must follow the automerge policy')
requireInvariant(renovate.vulnerabilityAlerts?.automerge === true, 'Security updates must follow the automerge policy')
requireInvariant(
  !renovate.packageRules?.some((rule) => rule.automerge === false),
  'Package rules must not disable automerge for selected dependencies',
)
requireInvariant(renovate.commitHourlyLimit === 0, 'Renovate commits must not be rate-limited')
requireInvariant(renovate.prConcurrentLimit === 0, 'Renovate pull requests must not have a concurrent limit')
requireInvariant(renovate.branchConcurrentLimit === 0, 'Renovate branches must not have a concurrent limit')
requireInvariant(renovate.prHourlyLimit === 0, 'Renovate pull requests must not have an hourly limit')
requireInvariant(
  renovate.extends?.includes('helpers:pinGitHubActionDigests'),
  'Renovate must preserve immutable GitHub Action pins',
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
