import { copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const targets = [
  { name: 'linux-x64', bun: 'bun-linux-x64' },
  { name: 'linux-arm64', bun: 'bun-linux-arm64' },
  { name: 'darwin-x64', bun: 'bun-darwin-x64' },
  { name: 'darwin-arm64', bun: 'bun-darwin-arm64' },
] as const

const engineEndpoint = process.env.SENSOS_REGISTRY_ENDPOINT?.trim() ?? ''
const streamsEndpoint = process.env.SENSOS_STREAMS_URL?.trim() ?? ''
if (Boolean(engineEndpoint) !== Boolean(streamsEndpoint)) {
  throw new Error(
    'Release builds require both SENSOS_REGISTRY_ENDPOINT and SENSOS_STREAMS_URL'
  )
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
  __SENSOS_RUNTIME_BUILD_ID__: JSON.stringify(
    process.env.SENSOS_ENGINE_BUILD_ID?.trim() ?? 'development'
  ),
  __SENSOS_REGISTRY_ENDPOINT__: JSON.stringify(engineEndpoint),
  __SENSOS_STREAMS_URL__: JSON.stringify(streamsEndpoint),
}

for (const target of targets) {
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
const hostBuild = targets.find(target => target.name === hostTarget)
if (hostBuild) {
  await copyFile(`dist/sensos-${hostBuild.name}`, 'dist/sensos')
}
