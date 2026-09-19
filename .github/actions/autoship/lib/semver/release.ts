import { SemVer, type ReleaseId } from './semver'
import type { StableReleaseType } from './constants'

export function parseStableRelease(
  version: string,
  options: { tagged?: boolean } = {}
): Release {
  const parsed = new SemVer(version)
  if (
    parsed.version !== version ||
    parsed.prerelease.length > 0 ||
    parsed.build.length > 0
  ) {
    throw new TypeError(`Expected a canonical stable SemVer: ${version}`)
  }
  return new Release(parsed, options)
}

export class Release {
  private current: SemVer
  private taggedVersion: string | null = null

  constructor(input: SemVer | string, options: { tagged?: boolean } = {}) {
    this.current = new SemVer(
      input instanceof SemVer ? input.version : input
    )
    if (options.tagged) this.taggedVersion = this.current.version
  }

  get version(): string {
    return this.current.version
  }

  get isStable(): boolean {
    return (
      this.current.prerelease.length === 0 &&
      this.current.build.length === 0
    )
  }

  get isPrerelease(): boolean {
    return this.current.prerelease.length > 0
  }

  get isTagged(): boolean {
    return this.taggedVersion === this.version
  }

  get tagName(): `v${string}` {
    return `v${this.version}`
  }

  toString(): string {
    return this.version
  }

  // Call only after the corresponding Git tag has been created successfully.
  markTagged(): string {
    if (this.isTagged) {
      throw new Error(`${this.tagName} is already marked as tagged`)
    }
    this.taggedVersion = this.version
    return this.tagName
  }

  private transition(next: SemVer): this {
    this.current = next
    this.taggedVersion = null
    return this
  }

  startPrerelease(
    releaseType: StableReleaseType,
    identifier: ReleaseId
  ): this {
    if (this.isPrerelease) {
      throw new Error(
        'Promote the current prerelease before starting another'
      )
    }
    return this.transition(
      new SemVer(this.version).inc(`pre${releaseType}`, identifier)
    )
  }

  nextPrerelease(identifier?: ReleaseId): this {
    if (!this.isPrerelease) {
      throw new Error('Start a prerelease before incrementing it')
    }
    return this.transition(
      new SemVer(this.version).inc('prerelease', identifier)
    )
  }

  promote(): this {
    if (!this.isPrerelease) {
      throw new Error(`${this.version} is already a stable release`)
    }
    return this.transition(new SemVer(this.version).inc('release'))
  }

  next(releaseType: StableReleaseType): this {
    if (this.isPrerelease) {
      throw new Error(
        'Promote the current prerelease before bumping a stable release'
      )
    }
    return this.transition(new SemVer(this.version).inc(releaseType))
  }

  release(): this {
    return this.promote()
  }

  pre(identifier: ReleaseId): this {
    return this.isPrerelease
      ? this.nextPrerelease(identifier)
      : this.startPrerelease('patch', identifier)
  }

  bump(releaseType: StableReleaseType): this {
    return this.next(releaseType)
  }
}
