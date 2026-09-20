import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { required, libraries, run } from './common'
import { stagePackages } from './stage-packages'
import { parseStableRelease } from 'actions/autoship/lib/semver/release'

const channel = required('CHANNEL')
const version = parseStableRelease(required('VERSION'))
if (channel !== 'stable')
  throw new Error('Invalid release channel/version')
if (process.env.GITHUB_ACTIONS !== 'true')
  throw new Error(
    'Registry publishing is restricted to the release workflow'
  )
const stage = await stagePackages()
const originals = new Map<string, string>()
try {
  for (const name of libraries) {
    const path = `packages/${name}/package.json`
    const original = await Bun.file(path).text()
    originals.set(path, original)
    const manifest = JSON.parse(original)
    if (manifest.version !== version.version)
      throw new Error(`Version mismatch for ${name}`)
    manifest.publishConfig.directory = join(stage, name, 'package')
    await Bun.write(path, `${JSON.stringify(manifest, null, 2)}\n`)
  }
  // Keep Changesets' NDJSON publication events intact for the publish action.
  // A version-specific tag avoids moving latest backward on an old retry.
  await run([
    'bun',
    'run',
    'changeset',
    'publish',
    '--tag',
    `release-${version.version}`,
  ])
} finally {
  for (const [path, original] of originals) await Bun.write(path, original)
  await rm(stage, { recursive: true, force: true })
}
