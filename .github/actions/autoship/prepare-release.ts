import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { parseStableRelease, type StableReleaseType } from './lib/semver'

const packages = [
  '@sensos-ai/cli',
  '@sensos-ai/shared',
  '@sensos-ai/client',
]
const changesetPath = '.changeset/autoship-stable.md'
type VersionInput = {
  currentVersion: string
  latestTag: string | null
  nextVersion: string
  nextTag: string
  releaseType: StableReleaseType
  releaseTypeSource: 'ai' | 'input'
}
type StagedRelease = {
  input: VersionInput
  notes: string
  changeset: string
  sourceSha: string
}

async function run(command: string[]): Promise<string> {
  const child = Bun.spawn(command, { stderr: 'pipe', stdout: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (code !== 0) throw new Error(`${command.join(' ')} failed: ${stderr}`)
  return stdout.trim()
}

function stagePath(): string {
  if (!process.env.RUNNER_TEMP) throw new Error('RUNNER_TEMP is required')
  return join(process.env.RUNNER_TEMP, 'sensos-stable-release.json')
}

function validate(input: VersionInput, notes: string): void {
  const current = parseStableRelease(input.currentVersion)
  const next = parseStableRelease(input.nextVersion)
  if (
    current.next(input.releaseType).version !== next.version ||
    input.nextTag !== next.tagName ||
    !notes.trim()
  ) {
    throw new Error('Invalid version metadata or empty release notes')
  }
}

async function writeChangeset(staged: StagedRelease): Promise<void> {
  await mkdir('.changeset', { recursive: true })
  await Bun.write(changesetPath, staged.changeset)
}

async function stage(): Promise<void> {
  const input = (await Bun.file(
    '.release/version.json'
  ).json()) as VersionInput
  const notes = (await Bun.file('.release/changelog.md').text()).trim()
  validate(input, notes)
  const sourceSha = await run(['git', 'rev-parse', 'HEAD'])
  const changeset = `---\n${packages.map(name => `"${name}": ${input.releaseType}`).join('\n')}\n---\n\n${notes}\n`
  const staged: StagedRelease = { input, notes, changeset, sourceSha }
  await writeChangeset(staged)
  await Bun.write(stagePath(), JSON.stringify(staged))
}

async function apply(): Promise<void> {
  const staged = (await Bun.file(stagePath()).json()) as StagedRelease
  validate(staged.input, staged.notes)
  if (!/^[0-9a-f]{40}$/.test(staged.sourceSha))
    throw new Error('Invalid source SHA')
  for (const name of packages) {
    const path = `packages/${name.split('/')[1]}/package.json`
    const manifest = await Bun.file(path).json()
    if (
      manifest.name !== name ||
      manifest.version !== staged.input.currentVersion
    ) {
      throw new Error(`Unexpected package identity or version in ${path}`)
    }
  }
  await writeChangeset(staged)
  await run(['bun', 'run', 'changeset:version'])
  for (const name of packages) {
    const path = `packages/${name.split('/')[1]}/package.json`
    const manifest = await Bun.file(path).json()
    if (manifest.version !== staged.input.nextVersion) {
      throw new Error(
        `Changesets produced unexpected ${name} version ${manifest.version}`
      )
    }
  }
  const rootChangelog = Bun.file('CHANGELOG.md')
  const previous = (await rootChangelog.exists())
    ? (await rootChangelog.text()).trim()
    : '# Changelog'
  if (!previous.startsWith('# Changelog'))
    throw new Error('CHANGELOG.md must begin with # Changelog')
  if (previous.includes(`## ${staged.input.nextTag}`))
    throw new Error(`Root changelog already has ${staged.input.nextTag}`)
  const heading = `## ${staged.input.nextTag} - ${new Date().toISOString().slice(0, 10)}`
  await Bun.write(
    'CHANGELOG.md',
    `${previous.replace(/^# Changelog\s*/, `# Changelog\n\n${heading}\n\n${staged.notes}\n\n`)}\n`
  )
  await mkdir('.release', { recursive: true })
  await Bun.write(
    '.release/preparation.json',
    `${JSON.stringify(
      {
        version: staged.input.nextVersion,
        sourceSha: staged.sourceSha,
        channel: 'stable',
        releaseType: staged.input.releaseType,
        baseTag: staged.input.latestTag,
      },
      null,
      2
    )}\n`
  )
  // The action commits every worktree addition; AI context and scratch notes
  // must not become part of the reviewed release PR.
  await rm('.release/version.json', { force: true })
  await rm('.release/changelog.md', { force: true })
}

await (process.argv[2] === 'apply' ? apply() : stage())
