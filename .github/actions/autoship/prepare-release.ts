import { mkdir } from 'node:fs/promises'
import { parseStableRelease, type StableReleaseType } from './lib/semver'

type ReleaseVersionMetadata = {
  currentVersion: string
  latestTag: string | null
  nextTag: string
  nextVersion: string
  releaseType: StableReleaseType
  releaseTypeSource: 'ai' | 'input'
}

function updateCliLockVersion(
  lockfile: string,
  currentVersion: string,
  nextVersion: string
): string {
  const startMarker = '    "packages/cli": {'
  const endMarker = '    "packages/client": {'
  const start = lockfile.indexOf(startMarker)
  const end = lockfile.indexOf(endMarker, start)
  if (start === -1 || end === -1) {
    throw new Error('bun.lock does not contain the CLI workspace entry')
  }

  const block = lockfile.slice(start, end)
  const currentEntry = `"version": "${currentVersion}"`
  if (block.split(currentEntry).length !== 2) {
    throw new Error(
      `bun.lock CLI version does not match packages/cli/package.json (${currentVersion})`
    )
  }

  return `${lockfile.slice(0, start)}${block.replace(
    currentEntry,
    `"version": "${nextVersion}"`
  )}${lockfile.slice(end)}`
}

async function main(): Promise<void> {
  const version = (await Bun.file(
    '.release/version.json'
  ).json()) as ReleaseVersionMetadata
  const currentRelease = parseStableRelease(version.currentVersion)
  const nextRelease = parseStableRelease(version.nextVersion)
  if (
    !['major', 'minor', 'patch'].includes(version.releaseType) ||
    parseStableRelease(currentRelease.version).next(version.releaseType)
      .version !== nextRelease.version ||
    version.nextTag !== nextRelease.tagName
  ) {
    throw new Error('Version metadata does not match the release type')
  }

  const cliPackagePath = 'packages/cli/package.json'
  const cliPackage = await Bun.file(cliPackagePath).json()
  if (String(cliPackage.version) !== currentRelease.version) {
    throw new Error(
      'CLI package version changed during release preparation'
    )
  }
  cliPackage.version = nextRelease.version

  const releaseNotes = (
    await Bun.file('.release/changelog.md').text()
  ).trim()
  if (!releaseNotes) throw new Error('Generated changelog is empty')

  const changelogFile = Bun.file('CHANGELOG.md')
  const existingChangelog = (await changelogFile.exists())
    ? (await changelogFile.text()).trim()
    : '# Changelog'
  if (!existingChangelog.startsWith('# Changelog')) {
    throw new Error('CHANGELOG.md must begin with "# Changelog"')
  }
  if (existingChangelog.includes(`## ${nextRelease.tagName}`)) {
    throw new Error(`CHANGELOG.md already contains ${nextRelease.tagName}`)
  }

  const date = new Date().toISOString().slice(0, 10)
  const nextChangelog = existingChangelog.replace(
    /^# Changelog\s*/,
    `# Changelog\n\n## ${nextRelease.tagName} - ${date}\n\n${releaseNotes}\n\n`
  )
  const lockfile = await Bun.file('bun.lock').text()
  const nextLockfile = updateCliLockVersion(
    lockfile,
    version.currentVersion,
    nextRelease.version
  )
  const releaseBranch = `release/prepare-${nextRelease.tagName}`
  const additions = [
    {
      contents: Buffer.from(
        `${JSON.stringify(cliPackage, null, 2)}\n`
      ).toString('base64'),
      path: cliPackagePath,
    },
    {
      contents: Buffer.from(`${nextChangelog.trim()}\n`).toString(
        'base64'
      ),
      path: 'CHANGELOG.md',
    },
    {
      contents: Buffer.from(nextLockfile).toString('base64'),
      path: 'bun.lock',
    },
  ]

  await mkdir('.release', { recursive: true })
  await Bun.write(
    '.release/preparation.json',
    `${JSON.stringify(
      {
        additions,
        baseTag: version.latestTag ?? 'none',
        branch: releaseBranch,
        commitMessage: `chore(release): prepare ${nextRelease.tagName}`,
        prBody: [
          `Prepares **${nextRelease.tagName}** for human review.`,
          '',
          `- Release type: \`${version.releaseType}\`${version.releaseTypeSource === 'ai' ? ' (AI suggested)' : ''}`,
          `- Previous stable tag: \`${version.latestTag ?? 'none'}\``,
          '- Changelog generated from package-only changes with Vercel AI Gateway',
          '',
          'Merging this PR will allow the tag-release workflow to validate and tag the exact merge commit.',
        ].join('\n'),
        releaseType: version.releaseType,
        releaseTypeSource: version.releaseTypeSource,
        title: `chore(release): prepare ${nextRelease.tagName}`,
        version: nextRelease.version,
      },
      null,
      2
    )}\n`
  )
}

await main()
