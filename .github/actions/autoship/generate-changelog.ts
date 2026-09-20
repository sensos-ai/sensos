import { generateChangelog } from './lib/ai'
import { CHANGELOG_HEADINGS } from './lib/changelog'
import { parseStableRelease } from './lib/semver'

const ALLOWED_HEADINGS = new Set<string>(CHANGELOG_HEADINGS)

type VersionMetadata = {
  commits: string
  diff: string
  diffStat: string
  latestTag: string | null
  nextVersion: string
}

function validateChangelog(markdown: string): string {
  const normalized = markdown.trim().replaceAll('\r\n', '\n')
  if (!normalized) throw new Error('The model returned an empty changelog')
  if (normalized.length > 8_000)
    throw new Error('The generated changelog is too long')
  if (normalized.includes('```') || normalized.includes('<')) {
    throw new Error(
      'The generated changelog contains forbidden formatting'
    )
  }

  const forbidden = [
    /\b(?:commit|pull request|\bpr\b|sha|workflow|ci|refactor|test suite)\b/i,
    /(?:packages|scripts|src|\.github)\//i,
    /\b[0-9a-f]{7,40}\b/i,
    /\b[\w.-]+\.(?:ts|tsx|js|json|yml|yaml)\b/i,
  ]
  if (forbidden.some(pattern => pattern.test(normalized))) {
    throw new Error(
      'The generated changelog contains an internal implementation reference'
    )
  }

  let sawHeading = false
  let bulletsInSection = 0
  for (const line of normalized.split('\n')) {
    if (!line.trim()) continue
    if (line.startsWith('### ')) {
      if (sawHeading && bulletsInSection === 0) {
        throw new Error(
          'Every changelog section must contain at least one bullet'
        )
      }
      const heading = line.slice(4)
      if (!ALLOWED_HEADINGS.has(heading)) {
        throw new Error(`Unsupported changelog heading: ${heading}`)
      }
      sawHeading = true
      bulletsInSection = 0
      continue
    }
    if (!sawHeading || !/^- \*\*[^*]+:\*\* \S/.test(line)) {
      throw new Error(`Invalid changelog line: ${line}`)
    }
    bulletsInSection += 1
  }

  if (!sawHeading || bulletsInSection === 0) {
    throw new Error(
      'The changelog must contain headings with non-empty bullets'
    )
  }
  return normalized
}

async function main(): Promise<void> {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error('AI_GATEWAY_API_KEY is required')
  }

  const model = process.env.CHANGELOG_MODEL

  const version = (await Bun.file(
    '.release/version.json'
  ).json()) as VersionMetadata
  const release = parseStableRelease(version.nextVersion)

  // generate the changelog text with ai sdk
  const { text } = await generateChangelog({
    model,
    tagName: release.tagName,
    version,
  })

  await Bun.write('.release/changelog.md', `${validateChangelog(text)}\n`)
}

await main()
