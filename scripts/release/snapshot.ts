import { mkdir, readdir, rm } from 'node:fs/promises'
import { required, run, workspaces } from './common'
import { parseStableRelease } from 'actions/autoship/lib/semver/release'

const number = required('CI_RUN_NUMBER')
if (!/^[1-9]\d*$/.test(number)) throw new Error('Invalid CI run number')
const current = parseStableRelease(
  (await Bun.file('packages/cli/package.json').json()).version
)
const expected = `${current.next('patch').version}-canary.${number}`
if (required('VERSION') !== expected)
  throw new Error('Snapshot identity mismatch')
await mkdir('.changeset', { recursive: true })
// Disposable runner checkout only. Pending feature changesets must not inflate canaries.
for (const file of await readdir('.changeset')) {
  if (file.endsWith('.md') && file !== 'README.md')
    await rm(`.changeset/${file}`)
}
await Bun.write(
  '.changeset/autoship-canary.md',
  `---\n${workspaces.map(name => `"@sensos-ai/${name}": patch`).join('\n')}\n---\n\nCanary snapshot.\n`
)
await run([
  'bun',
  'run',
  'changeset',
  'version',
  '--snapshot',
  `canary.${number}`,
])
await run(['bun', 'install', '--lockfile-only', '--ignore-scripts'])
for (const name of workspaces) {
  if (
    (await Bun.file(`packages/${name}/package.json`).json()).version !==
    expected
  )
    throw new Error(`Unexpected ${name} snapshot version`)
}
