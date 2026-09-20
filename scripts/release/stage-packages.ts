import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { libraries, run } from './common'

export function exportPaths(manifest: Record<string, unknown>): string[] {
  const paths = new Set<string>()
  const visit = (value: unknown) => {
    if (typeof value === 'string' && value.startsWith('./'))
      paths.add(value)
    else if (value && typeof value === 'object')
      Object.values(value).forEach(visit)
  }
  visit(manifest.exports)
  visit(manifest.main)
  visit(manifest.types)
  return [...paths]
}

export async function validatePackage(directory: string) {
  const manifest = await Bun.file(join(directory, 'package.json')).json()
  if (
    manifest.private ||
    !libraries.some(name => manifest.name === `@sensos-ai/${name}`)
  )
    throw new Error('Only shared/client may be published')
  for (const section of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    for (const version of Object.values(manifest[section] ?? {})) {
      if (
        typeof version !== 'string' ||
        /^(workspace:|catalog:|file:|link:)/.test(version)
      )
        throw new Error(
          `Unresolved ${section} in ${manifest.name}: ${version}`
        )
    }
  }
  for (const path of exportPaths(manifest)) {
    if (
      !path.startsWith('./dist/') ||
      path.includes('..') ||
      !(await Bun.file(join(directory, path)).exists())
    )
      throw new Error(
        `Invalid or missing export ${manifest.name}: ${path}`
      )
  }
  return manifest
}

export async function stagePackages(): Promise<string> {
  const stage = await mkdtemp(join(tmpdir(), 'sensos-publish-'))
  try {
    for (const name of libraries) {
      const destination = join(stage, name)
      await mkdir(destination)
      await run(
        [
          'bun',
          'pm',
          'pack',
          '--destination',
          destination,
          '--quiet',
          '--ignore-scripts',
        ],
        resolve('packages', name)
      )
      const archives = (await readdir(destination)).filter(name =>
        name.endsWith('.tgz')
      )
      if (archives.length !== 1)
        throw new Error(`Expected one archive for ${name}`)
      await run([
        'tar',
        '-xzf',
        join(destination, archives[0]),
        '-C',
        destination,
      ])
      const directory = join(destination, 'package')
      const manifest = await validatePackage(directory)
      // Staged packages have no source tooling; Changesets publishes these directories.
      delete manifest.scripts
      delete manifest.devDependencies
      delete manifest.publishConfig.directory
      await Bun.write(
        join(directory, 'package.json'),
        `${JSON.stringify(manifest, null, 2)}\n`
      )
    }
    return stage
  } catch (error) {
    await rm(stage, { recursive: true, force: true })
    throw error
  }
}

if (import.meta.main) console.log(await stagePackages())
