import { appendFile, mkdir } from 'node:fs/promises'
import { libraries, run } from './common'

await run([
  'bun',
  'run',
  'turbo:build',
  ...libraries.map(name => `--filter=@sensos-ai/${name}`),
])
await run(['bun', 'run', 'scripts/ci/validate-package-tarballs.ts'])
await mkdir('.release', { recursive: true })
const output = '.release/preview.json'
await run([
  'bun',
  'run',
  'pkg-pr-new',
  'publish',
  '--previewVersion',
  '--no-compact',
  '--packageManager=bun',
  '--comment=update',
  '--bun',
  `--json=${output}`,
  ...libraries.map(name => `./packages/${name}`),
])
const metadata = await Bun.file(output).json()
if (!Array.isArray(metadata.packages) || metadata.packages.length !== 2)
  throw new Error('Expected exactly two preview packages')
const lines = ['## Shared/client previews', '']
for (const name of libraries) {
  const pkg = metadata.packages.find(
    (pkg: { name: string }) => pkg.name === `@sensos-ai/${name}`
  )
  if (!pkg || new URL(pkg.url).hostname !== 'pkg.pr.new')
    throw new Error(`Missing preview URL for ${name}`)
  lines.push(`- ${pkg.name}: ${pkg.url}`, `  \`bun add ${pkg.url}\``)
}
console.log(lines.join('\n'))
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `${lines.join('\n')}\n`
  )
