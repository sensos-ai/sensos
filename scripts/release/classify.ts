import {
  Release,
  parseStableRelease,
} from 'actions/autoship/lib/semver/release'
import { git, outputs, required, workspaces } from './common'
import { assetBytes, github } from './github'

const sha = required('SOURCE_SHA')
const runNumber = required('CI_RUN_NUMBER')
if (
  !/^[0-9a-f]{40}$/.test(sha) ||
  !/^[1-9]\d*$/.test(runNumber) ||
  git('rev-parse', 'HEAD') !== sha
)
  throw new Error('Invalid validated source identity')
const source = await Bun.file(required('CI_SOURCE_PATH')).json()
if (
  source.source_sha !== sha ||
  String(source.run_number) !== runNumber ||
  !/^[0-9a-f]{40}$/.test(source.base_sha)
)
  throw new Error('CI source artifact does not match triggering run')
const base = /^0+$/.test(source.base_sha)
  ? git('hash-object', '-t', 'tree', '/dev/null')
  : source.base_sha
const changed = git('diff', '--name-only', base, sha).split('\n')
const relevant = changed.some(
  path =>
    !path.startsWith('apps/docs/') &&
    /^(packages\/|scripts\/|\.github\/(actions\/|workflows\/)|\.changeset\/|\.release\/preparation\.json$|package\.json$|bun\.lock$|bunup\.config\.ts$|turbo\.json$|biome\.jsonc?$|tsconfig[^/]*\.json$)/.test(
      path
    )
)
if (!relevant) {
  await outputs({ channel: 'none', source_sha: sha })
} else {
  const versions = await Promise.all(
    workspaces.map(
      async name =>
        (await Bun.file(`packages/${name}/package.json`).json())
          .version as string
    )
  )
  if (new Set(versions).size !== 1)
    throw new Error('Release workspace versions must match')
  const current = parseStableRelease(versions[0])
  let channel: 'stable' | 'canary' = 'canary'
  let version = `${current.next('patch').version}-canary.${runNumber}`
  if (changed.includes('.release/preparation.json')) {
    const metadata = await Bun.file('.release/preparation.json').json()
    if (
      metadata.channel !== 'stable' ||
      metadata.version !== current.version ||
      !/^[0-9a-f]{40}$/.test(metadata.sourceSha)
    )
      throw new Error('Invalid stable preparation metadata')
    git('merge-base', '--is-ancestor', metadata.sourceSha, sha)
    channel = 'stable'
    version = current.version
  }
  // The final marker is written only after every destination and channel decision succeeds.
  // GitHub-only completion is insufficient: R2 publication may still need recovery.
  const tag = new Release(version).tagName
  const published = await github(`releases/tags/${tag}`, {}, true)
  const complete = published?.assets.find(
    (asset: { name: string }) => asset.name === 'complete.json'
  )
  if (complete) {
    const record = JSON.parse(
      new TextDecoder().decode(await assetBytes(complete))
    )
    if (
      record.sourceSha !== sha ||
      record.version !== version ||
      record.complete !== true
    )
      throw new Error('Conflicting release completion marker')
    await outputs({ channel: 'none', source_sha: sha })
  } else
    await outputs({
      channel,
      version,
      source_sha: sha,
      tag,
      release_name: `Sensos ${version}`,
    })
}
