import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const { packageManager } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
if (!/^npm@\d+\.\d+\.\d+$/.test(packageManager ?? '')) {
  throw new Error('packageManager must pin an exact npm version')
}

execFileSync('npm', ['install', '--global', '--ignore-scripts', '--no-audit', '--no-fund', packageManager], {
  stdio: 'inherit',
})
const actual = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim()
if (`npm@${actual}` !== packageManager) {
  throw new Error(`Expected ${packageManager}, found npm@${actual}`)
}
