import { mkdir } from 'node:fs/promises'
import { suggestReleaseType } from './lib/ai'
import {
  isStableReleaseType,
  parseStableRelease,
  SemVer,
  type StableReleaseType,
} from './lib/semver'

const RELEASE_PATHS = [
  'packages',
  '.github/actions/autoship',
  'package.json',
  'bun.lock',
  'bunup.config.ts',
  'turbo.json',
]
const MAX_COMMITS_LENGTH = 12_000
const MAX_DIFF_LENGTH = 48_000

async function run(command: string[]): Promise<string> {
  const process = Bun.spawn(command, {
    stderr: 'pipe',
    stdout: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ])
  if (exitCode !== 0) {
    throw new Error(`${command.join(' ')} failed:\n${stderr.trim()}`)
  }
  return stdout.trim()
}

function truncate(value: string, maximumLength: number): string {
  if (value.length <= maximumLength) return value
  return `${value.slice(0, maximumLength)}\n[context truncated]`
}

async function main(): Promise<void> {
  const releaseTypeInput = process.argv[2]?.trim()
  if (releaseTypeInput && !isStableReleaseType(releaseTypeInput)) {
    throw new Error('Release type must be patch, minor, major')
  }

  const cliPackage = await Bun.file('packages/cli/package.json').json()
  const currentVersion = parseStableRelease(String(cliPackage.version))

  const tags = (await run(['git', 'tag', '--list', 'v*']))
    .split('\n')
    .filter(Boolean)
    .flatMap(tag => {
      try {
        return [parseStableRelease(tag.slice(1), { tagged: true })]
      } catch {
        return []
      }
    })
    .sort((left, right) =>
      new SemVer(left.version).compareMain(right.version)
    )
  const latestRelease = tags.at(-1)
  const latestTag = latestRelease?.tagName ?? null
  if (latestRelease && currentVersion.version !== latestRelease.version) {
    throw new Error(
      `CLI version ${currentVersion.version} does not match latest stable tag ${latestTag}`
    )
  }
  if (latestTag) {
    await run(['git', 'merge-base', '--is-ancestor', latestTag, 'HEAD'])
  }

  const range = latestTag ? `${latestTag}..HEAD` : 'HEAD'
  const emptyTree = await run([
    'git',
    'hash-object',
    '-t',
    'tree',
    '/dev/null',
  ])
  const diffBase = latestTag ?? emptyTree
  const commits = await run([
    'git',
    'log',
    '--format=%h %s',
    range,
    '--',
    ...RELEASE_PATHS,
  ])
  const diff = await run([
    'git',
    'diff',
    '--no-ext-diff',
    '--unified=2',
    diffBase,
    'HEAD',
    '--',
    ...RELEASE_PATHS,
  ])
  if (!commits || !diff) {
    throw new Error(
      `No package changes found since ${latestTag ?? 'the initial commit'}`
    )
  }

  const filesChanged = (
    await run([
      'git',
      'diff',
      '--name-only',
      diffBase,
      'HEAD',
      '--',
      ...RELEASE_PATHS,
    ])
  )
    .split('\n')
    .filter(Boolean)
    .slice(0, 100)
  const context = {
    commits: truncate(commits, MAX_COMMITS_LENGTH),
    diff: truncate(diff, MAX_DIFF_LENGTH),
    filesChanged,
    previousVersion: latestRelease?.version ?? currentVersion.version,
  }
  const releaseType = releaseTypeInput
    ? (releaseTypeInput as StableReleaseType)
    : await suggestReleaseType(context)

  const nextRelease = (latestRelease ?? currentVersion).next(releaseType)
  const nextVersion = nextRelease.version
  const nextTag = nextRelease.tagName

  if ((await run(['git', 'tag', '--list', nextTag])).trim()) {
    throw new Error(`Tag ${nextTag} already exists`)
  }

  await mkdir('.release', { recursive: true })
  await Bun.write(
    '.release/version.json',
    `${JSON.stringify(
      {
        ...context,
        releaseType,
        releaseTypeSource: releaseTypeInput ? 'input' : 'ai',
        currentVersion: currentVersion.version,
        latestTag,
        nextTag,
        nextVersion,
      },
      null,
      2
    )}\n`
  )
}

await main()
