import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const packages = ['shared', 'client'] as const

async function run(command: string[], cwd: string) {
  const process = Bun.spawn(command, {
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const exitCode = await process.exited
  if (exitCode !== 0) {
    throw new Error(`${command.join(' ')} exited with code ${exitCode}`)
  }
}

function exportedFiles(manifest: Record<string, unknown>) {
  const files = new Set<string>()
  const visit = (value: unknown) => {
    if (typeof value === 'string' && value.startsWith('./dist/')) {
      files.add(value.slice(2))
    } else if (value && typeof value === 'object') {
      for (const nested of Object.values(value)) visit(nested)
    }
  }
  visit(manifest.exports)
  visit(manifest.main)
  visit(manifest.types)
  return files
}

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), 'sensos-package-ci-')
)

try {
  for (const packageName of packages) {
    const packageDirectory = resolve('packages', packageName)
    const archiveDirectory = join(temporaryDirectory, packageName)
    await run(
      ['bun', 'pm', 'pack', '--destination', archiveDirectory, '--quiet'],
      packageDirectory
    )

    const archives = (await readdir(archiveDirectory)).filter(name =>
      name.endsWith('.tgz')
    )
    if (archives.length !== 1) {
      throw new Error(
        `${packageName}: expected one package archive, found ${archives.length}`
      )
    }

    await run(
      [
        'tar',
        '-xzf',
        join(archiveDirectory, archives[0]),
        '-C',
        archiveDirectory,
      ],
      resolve('.')
    )

    const packedRoot = join(archiveDirectory, 'package')
    const packedManifest = JSON.parse(
      await readFile(join(packedRoot, 'package.json'), 'utf8')
    ) as Record<string, unknown>
    const packedFiles = await Array.fromAsync(
      new Bun.Glob('**/*').scan({ cwd: packedRoot, onlyFiles: true })
    )

    for (const file of packedFiles) {
      if (file !== 'package.json' && !file.startsWith('dist/')) {
        throw new Error(`${packageName}: unexpected packed file ${file}`)
      }
    }

    for (const file of exportedFiles(packedManifest)) {
      if (!(await Bun.file(join(packedRoot, file)).exists())) {
        throw new Error(
          `${packageName}: exported file is missing: ${file}`
        )
      }
    }

    if (packedManifest.private === true) {
      throw new Error(
        `${packageName}: private packages cannot be previewed`
      )
    }

    console.log(`${packageName}: package archive is valid`)
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
