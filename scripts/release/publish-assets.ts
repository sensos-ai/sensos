import { S3Client } from 'bun'
import { join } from 'node:path'
import { Release, SemVer } from 'actions/autoship/lib/semver'
import { git, libraries, required, run } from './common'
import { assetBytes, github, uploadAsset } from './github'
import { targets } from '../lib/targets'

const version = new Release(required('VERSION'))
const channel = required('CHANNEL')
const sha = required('SOURCE_SHA')
const number = Number(required('CI_RUN_NUMBER'))
const directory = required('ASSET_DIR')
if (
  !['stable', 'canary'].includes(channel) ||
  version.isPrerelease !== (channel === 'canary') ||
  !Number.isSafeInteger(number) ||
  number < 1 ||
  git('rev-parse', 'HEAD') !== sha
)
  throw new Error('Invalid publication identity')
const client = new S3Client({
  endpoint: required('R2_ENDPOINT'),
  bucket: required('R2_BUCKET'),
  accessKeyId: required('AWS_ACCESS_KEY_ID'),
  secretAccessKey: required('AWS_SECRET_ACCESS_KEY'),
  region: 'auto',
})
const hash = (bytes: Uint8Array) =>
  new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const files = new Map<string, Uint8Array>()
const digests: Record<string, string> = {}
for (const target of targets) {
  const name = `sensos-${target.name}.tar.gz`
  const bytes = await Bun.file(join(directory, name)).bytes()
  files.set(name, bytes)
  digests[name] = hash(bytes)
}
const sums = Object.entries(digests)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, digest]) => `${digest}  ${name}\n`)
  .join('')
// Workflow checksum generation and publication must agree exactly.
if ((await Bun.file(join(directory, 'SHA256SUMS')).text()) !== sums)
  throw new Error('SHA256SUMS does not match archives')
files.set('SHA256SUMS', new TextEncoder().encode(sums))

async function ensureTag(tag: string, moving = false) {
  const ref = await github(`git/ref/tags/${tag}`, {}, true)
  if (!ref) {
    await github('git/refs', {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/tags/${tag}`, sha }),
    })
  } else if (moving) {
    await github(`git/refs/tags/${tag}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha, force: true }),
    })
  } else {
    let object = ref.object
    while (object.type === 'tag')
      object = (await github(`git/tags/${object.sha}`)).object
    if (object.sha !== sha)
      throw new Error(`Existing ${tag} points to a different source`)
  }
}

await ensureTag(version.tagName)
let release = await github(`releases/tags/${version.tagName}`, {}, true)
if (
  release &&
  (release.tag_name !== version.tagName ||
    release.prerelease !== (channel === 'canary'))
) {
  throw new Error(
    'Existing GitHub release has conflicting channel metadata'
  )
}
const notes =
  channel === 'stable'
    ? (await Bun.file('CHANGELOG.md').text())
        .split(
          new RegExp(
            `## v${version.version.replaceAll('.', '\\.')}[^\\n]*\\n`
          )
        )[1]
        ?.split(/\n## v/)[0]
        ?.trim()
    : `Canary snapshot ${version.version} from ${sha}.`
if (!notes) throw new Error('Release notes are missing')
if (!release)
  release = await github('releases', {
    method: 'POST',
    body: JSON.stringify({
      tag_name: version.tagName,
      target_commitish: sha,
      name: `Sensos ${version.version}`,
      body: notes,
      draft: true,
      prerelease: channel === 'canary',
      make_latest: 'false',
    }),
  })

function validateAttestation(bytes: Uint8Array, archive: string) {
  const bundle = JSON.parse(new TextDecoder().decode(bytes))
  const payload = bundle.dsseEnvelope?.payload
  if (typeof payload !== 'string')
    throw new Error(`Invalid attestation for ${archive}`)
  const statement = JSON.parse(Buffer.from(payload, 'base64').toString())
  if (
    !statement.subject?.some(
      (subject: { digest?: { sha256?: string } }) =>
        subject.digest?.sha256 === digests[archive]
    )
  )
    throw new Error(`Attestation does not match ${archive}`)
}

for (const target of targets) {
  const name = `sensos-${target.name}.intoto.jsonl`
  // Attestations carry timestamps/signatures; preserve an existing valid bundle on retries.
  const existing = release.assets.find(
    (asset: { name: string }) => asset.name === name
  )
  const bytes = existing
    ? await assetBytes(existing)
    : await Bun.file(join(directory, name)).bytes()
  validateAttestation(bytes, `sensos-${target.name}.tar.gz`)
  files.set(name, bytes)
}
const metadata = {
  version: version.version,
  channel,
  sourceSha: sha,
  runNumber: number,
  digests: Object.fromEntries(
    [...files].map(([name, bytes]) => [name, hash(bytes)])
  ),
}
files.set(
  'release.json',
  new TextEncoder().encode(`${JSON.stringify(metadata, null, 2)}\n`)
)

async function put(key: string, bytes: Uint8Array, immutable: boolean) {
  const file = client.file(key)
  if (immutable && (await file.exists())) {
    if (hash(await file.bytes()) !== hash(bytes))
      throw new Error(`Conflicting R2 object ${key}`)
    return
  }
  const response = await fetch(
    file.presign({ method: 'PUT', expiresIn: 600 }),
    {
      method: 'PUT',
      headers: {
        'Cache-Control': immutable
          ? 'public,max-age=31536000,immutable'
          : 'no-store',
        'Content-Type': key.endsWith('.json')
          ? 'application/json'
          : 'application/octet-stream',
      },
      body: new Uint8Array(bytes),
    }
  )
  if (!response.ok) throw new Error(`R2 upload ${key}: ${response.status}`)
}

for (const [name, bytes] of files) {
  const existing = release.assets.find(
    (asset: { name: string }) => asset.name === name
  )
  if (existing) {
    if (hash(await assetBytes(existing)) !== hash(bytes))
      throw new Error(`Conflicting GitHub asset ${name}`)
  } else await uploadAsset(release, name, bytes)
  await put(`${version.version}/${name}`, bytes, true)
}
await github(`releases/${release.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ draft: false, make_latest: 'false' }),
})

const pointer = channel === 'stable' ? 'latest' : 'canary'
const stateFile = client.file(`${pointer}.json`)
const state = (await stateFile.exists()) ? await stateFile.json() : null
if (state && state.version === version.version && state.sourceSha !== sha)
  throw new Error('Channel identity conflicts with source')
const advance =
  !state ||
  (channel === 'stable'
    ? (new SemVer(version.version).compare(state.version) ?? -1) >= 0
    : number >= state.runNumber)
if (advance) {
  // Reserve channel order before mutations. An interrupted run can retry, but an older run cannot roll it back.
  await put(
    `${pointer}.json`,
    new TextEncoder().encode(`${JSON.stringify(metadata)}\n`),
    false
  )
  for (const name of libraries) {
    await run([
      'npm',
      'dist-tag',
      'add',
      `@sensos-ai/${name}@${version.version}`,
      channel === 'stable' ? 'latest' : 'canary',
      '--registry=https://npm.pkg.github.com',
    ])
  }
  if (channel === 'canary') {
    await ensureTag('canary', true)
    let alias = await github('releases/tags/canary', {}, true)
    if (!alias)
      alias = await github('releases', {
        method: 'POST',
        body: JSON.stringify({
          tag_name: 'canary',
          target_commitish: sha,
          name: 'Canary',
          prerelease: true,
          make_latest: 'false',
          body: notes,
        }),
      })
    for (const [name, bytes] of files) {
      const existing = alias.assets.find(
        (asset: { name: string }) => asset.name === name
      )
      if (existing && hash(await assetBytes(existing)) === hash(bytes))
        continue
      if (existing)
        await github(`releases/assets/${existing.id}`, {
          method: 'DELETE',
        })
      await uploadAsset(alias, name, bytes)
    }
    await github(`releases/${alias.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ body: notes }),
    })
  } else
    await github(`releases/${release.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ make_latest: 'true' }),
    })
  await put(
    `${pointer}.txt`,
    new TextEncoder().encode(`${version.version}\n`),
    false
  )
} else console.log(`Keeping newer ${pointer} channel ${state.version}`)

const completion = new TextEncoder().encode(
  `${JSON.stringify({ ...metadata, complete: true })}\n`
)
await put(`${version.version}/complete.json`, completion, true)
const existingCompletion = release.assets.find(
  (asset: { name: string }) => asset.name === 'complete.json'
)
if (existingCompletion) {
  if (hash(await assetBytes(existingCompletion)) !== hash(completion))
    throw new Error('Conflicting completion marker')
} else await uploadAsset(release, 'complete.json', completion)
console.log(`Published ${version.tagName} from ${sha}`)
