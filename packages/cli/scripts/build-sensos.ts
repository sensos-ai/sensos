import { copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { targets } from '../../../scripts/lib/targets'

const manifest = await Bun.file('package.json').json()
const version =
  process.env.SENSOS_RELEASE_VERSION?.trim() || manifest.version
if (
  !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(
    version
  )
) {
  throw new Error(`Invalid CLI version: ${version}`)
}
const selected = process.env.SENSOS_BUILD_TARGET
const buildTargets = selected
  ? targets.filter(target => target.name === selected)
  : targets
if (!buildTargets.length)
  throw new Error(`Unsupported build target: ${selected}`)

const engineEndpoint = process.env.SENSOS_REGISTRY_ENDPOINT?.trim() ?? ''
const streamsEndpoint = process.env.SENSOS_STREAMS_URL?.trim() ?? ''
if (Boolean(engineEndpoint) !== Boolean(streamsEndpoint)) {
  throw new Error(
    'Release builds require both SENSOS_REGISTRY_ENDPOINT and SENSOS_STREAMS_URL'
  )
}
if (process.env.SENSOS_RELEASE_BUILD === 'true') {
  if (
    !engineEndpoint ||
    !streamsEndpoint ||
    !process.env.SENSOS_ENGINE_BUILD_ID?.trim() ||
    process.env.SENSOS_ENGINE_BUILD_ID === 'development'
  ) {
    throw new Error(
      'Release builds require production endpoints and SENSOS_ENGINE_BUILD_ID'
    )
  }
  for (const endpoint of [engineEndpoint, streamsEndpoint]) {
    if (new URL(endpoint).protocol !== 'https:')
      throw new Error('Release endpoints must use HTTPS')
  }
}

const keyringPackage = resolve(
  'node_modules/@napi-rs/keyring/package.json'
)
if (!(await Bun.file(keyringPackage).exists())) {
  throw new Error(
    'Sensos cannot build: @napi-rs/keyring is not installed.'
  )
}

const define = {
  __SENSOS_VERSION__: JSON.stringify(version),
  __SENSOS_RUNTIME_BUILD_ID__: JSON.stringify(
    process.env.SENSOS_ENGINE_BUILD_ID?.trim() ?? 'development'
  ),
  __SENSOS_REGISTRY_ENDPOINT__: JSON.stringify(engineEndpoint),
  __SENSOS_STREAMS_URL__: JSON.stringify(streamsEndpoint),
}

for (const target of buildTargets) {
  const binding = Bun.resolveSync(
    `@napi-rs/keyring-${target.keyring}`,
    Bun.resolveSync('@napi-rs/keyring', process.cwd())
  )
  if (!(await Bun.file(binding).exists()))
    throw new Error(`Missing native keyring binding: ${target.keyring}`)
  const result = await Bun.build({
    entrypoints: ['src/cli/bootstrap.ts'],
    minify: true,
    sourcemap: 'linked',
    define,
    compile: {
      outfile: `dist/sensos-${target.name}`,
      target: target.bun,
    },
  })

  if (!result.success) {
    for (const log of result.logs) console.error(log)
    process.exit(1)
  }
}

const hostTarget = `${process.platform}-${process.arch === 'x64' ? 'x64' : 'arm64'}`
const hostBuild = buildTargets.find(target => target.name === hostTarget)
if (hostBuild) {
  await copyFile(`dist/sensos-${hostBuild.name}`, 'dist/sensos')
}
