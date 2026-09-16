import { resolve } from 'node:path'

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

const result = await Bun.build({
  entrypoints: ['src/cli/bootstrap.ts'],
  minify: true,
  sourcemap: 'linked',
  define: {
    __SENSOS_RUNTIME_BUILD_ID__: JSON.stringify(
      process.env.SENSOS_ENGINE_BUILD_ID?.trim() ?? 'development'
    ),
    __SENSOS_REGISTRY_ENDPOINT__: JSON.stringify(engineEndpoint),
    __SENSOS_STREAMS_URL__: JSON.stringify(streamsEndpoint),
  },
  compile: {
    outfile: 'dist/sensos',
  },
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
