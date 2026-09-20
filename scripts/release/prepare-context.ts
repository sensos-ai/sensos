import { parseStableRelease } from 'actions/autoship/lib/semver'
import { git, outputs, required } from './common'
import { github } from './github'

// A workflow rerun reuses its committed preparation, even after main advances.
// The run ID identifies the preparation; it never contributes to its version.
const runId = required('GITHUB_RUN_ID')
const commits = git(
  'log',
  '--format=%H',
  '--',
  '.release/preparation.json'
)
  .split('\n')
  .filter(Boolean)
let prepared: { sha: string; version: string } | undefined
for (const sha of commits) {
  const result = Bun.spawnSync([
    'git',
    'show',
    `${sha}:.release/preparation.json`,
  ])
  if (result.exitCode !== 0) continue
  const metadata = JSON.parse(result.stdout.toString())
  if (metadata.runId === runId) {
    const version = parseStableRelease(metadata.version)
    if (metadata.channel !== 'stable')
      throw new Error('Unsupported release channel')
    prepared = { sha, version: version.version }
    break
  }
}
if (prepared) {
  await outputs({
    resume: 'true',
    source_sha: prepared.sha,
    version: prepared.version,
  })
} else {
  // Avoid advancing past a version whose publication needs to be retried.
  const version = parseStableRelease(
    (await Bun.file('packages/cli/package.json').json()).version
  )
  if (version.version !== '0.0.0') {
    const release = await github(
      `releases/tags/${version.tagName}`,
      {},
      true
    )
    if (
      !release?.assets.some(
        (asset: { name: string }) => asset.name === 'complete.json'
      )
    )
      throw new Error(
        `Finish the existing ${version.tagName} release by rerunning its workflow before preparing another`
      )
  }
  await outputs({ resume: 'false' })
}
