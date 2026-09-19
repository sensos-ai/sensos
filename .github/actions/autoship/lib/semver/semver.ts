import { MAX_LENGTH, MAX_SAFE_INTEGER } from './constants'
import type { ReleaseType } from './constants'
import { safeRe as re, t } from './re'
import { isPrereleaseIdentifier, compareIdentifiers } from './utils'

export type ReleaseId = 'beta' | 'alpha' | (string & {})

type IdOpts = {
  identifier?: ReleaseId
  identifierBase?: any
}

function validateIncIds(
  release: ReleaseId,
  opts: IdOpts & {
    matcher: Parameters<String['match']>[0]
  }
) {
  if (release.startsWith('pre')) {
    if (!opts.identifier && opts.identifierBase === false) {
      throw new Error('invalid increment argument: identifier is empty')
    }
    // Avoid an invalid semver results
    if (opts.identifier) {
      const match = `-${opts.identifier}`.match(opts.matcher)
      if (!match || match[1] !== opts.identifier) {
        throw new Error(`invalid identifier: ${opts.identifier}`)
      }
    }
  }
}

function handlePre(params: IdOpts & { prerelease: any[] }) {
  const base = Number(params.identifierBase) ? 1 : 0

  const res = { prerelease: [...params.prerelease] }

  if (params.prerelease.length === 0) {
    res.prerelease = [base]
  } else {
    let i = res.prerelease.length
    while (--i >= 0) {
      if (typeof res.prerelease[i] === 'number') {
        ;(res.prerelease[i] as number)++
        i = -2
      }
    }
    if (i === -1) {
      // didn't increment anything
      if (
        params.identifier === res.prerelease.join('.') &&
        params.identifierBase === false
      ) {
        throw new Error(
          'invalid increment argument: identifier already exists'
        )
      }
      res.prerelease.push(base)
    }
  }
  if (params.identifier) {
    // 1.2.0-beta.1 bumps to 1.2.0-beta.2,
    // 1.2.0-beta.fooblz or 1.2.0-beta bumps to 1.2.0-beta.0
    let prerelease = [params.identifier, base]
    if (params.identifierBase === false) {
      prerelease = [params.identifier]
    }
    if (isPrereleaseIdentifier(res.prerelease, params.identifier)) {
      const prereleaseBase =
        res.prerelease[params.identifier.split('.').length]
      if (typeof prereleaseBase !== 'number') {
        res.prerelease = prerelease
      }
    } else {
      res.prerelease = prerelease
    }
  }
  return res.prerelease
}

type Input = { version: string } | string
type Options = { loose?: boolean; includePrerelease?: boolean }

export class SemVer {
  version!: string
  loose!: boolean

  options: Options = {} as Options
  includePrerelease!: boolean

  major!: number
  minor!: number
  patch!: number

  prerelease!: (string | number)[]
  build!: string[]
  raw!: string

  constructor(input: SemVer | Input, options: Options = {}) {
    let version: string

    if (input instanceof SemVer) {
      if (
        input.loose === !!options.loose &&
        input.includePrerelease === !!options.includePrerelease
      ) {
        Object.assign(this, input)
        return
      } else {
        version = input.version
      }
    }

    if (typeof input !== 'string') {
      throw new TypeError(
        `Invalid version. Must be a string. Got type "${typeof input}".`
      )
    }

    if (input.length > MAX_LENGTH) {
      throw new TypeError(
        `version is longer than ${MAX_LENGTH} characters`
      )
    }

    version = input

    this.options = options
    this.loose = !!options.loose
    // this isn't actually relevant for versions, but keep it so that we
    // don't run into trouble passing this.options around.
    this.includePrerelease = !!options.includePrerelease

    const m = version
      .trim()
      .match(options.loose ? re[t.LOOSE] : re[t.FULL])

    if (!m) {
      throw new TypeError(`Invalid Version: ${version}`)
    }

    this.raw = version

    // these are actually numbers
    this.major = +m[1]
    this.minor = +m[2]
    this.patch = +m[3]

    if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
      throw new TypeError('Invalid major version')
    }

    if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
      throw new TypeError('Invalid minor version')
    }

    if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
      throw new TypeError('Invalid patch version')
    }

    // numberify any prerelease numeric ids
    if (!m[4]) {
      this.prerelease = []
    } else {
      this.prerelease = m[4].split('.').map(id => {
        if (/^[0-9]+$/.test(id)) {
          const num = +id
          if (num >= 0 && num < MAX_SAFE_INTEGER) {
            return num
          }
        }
        return id
      })
    }

    this.build = m[5] ? m[5].split('.') : []
    this.version = this.format()
  }

  format() {
    this.version = `${this.major}.${this.minor}.${this.patch}`
    if (this.prerelease.length) {
      this.version += `-${this.prerelease.join('.')}`
    }
    return this.version
  }

  toString() {
    return this.version
  }

  compare(other: Input) {
    // debug('SemVer.compare', this.version, this.options, other)
    if (!(other instanceof SemVer)) {
      if (typeof other === 'string' && other === this.version) {
        return 0
      }
      other = new SemVer(other, this.options)
    }

    if (other.version === this.version) {
      return 0
    }

    return this.compareMain(other) || this.comparePre(other)
  }

  compareMain(input: Input) {
    let other: SemVer
    if (!(input instanceof SemVer)) {
      other = new SemVer(input, this.options)
    } else {
      other = input
    }

    if (this.major < other.major) {
      return -1
    }
    if (this.major > other.major) {
      return 1
    }
    if (this.minor < other.minor) {
      return -1
    }
    if (this.minor > other.minor) {
      return 1
    }
    if (this.patch < other.patch) {
      return -1
    }
    if (this.patch > other.patch) {
      return 1
    }
    return 0
  }

  comparePre(input: Input) {
    let other: SemVer
    if (!(input instanceof SemVer)) {
      other = new SemVer(input, this.options)
    } else {
      other = input
    }

    // NOT having a prerelease is > having one
    if (this.prerelease.length && !other.prerelease.length) {
      return -1
    } else if (!this.prerelease.length && other.prerelease.length) {
      return 1
    } else if (!this.prerelease.length && !other.prerelease.length) {
      return 0
    }

    let i = 0
    do {
      const a = this.prerelease[i]
      const b = other.prerelease[i]
      // debug('prerelease compare', i, a, b)
      if (a === undefined && b === undefined) {
        return 0
      } else if (b === undefined) {
        return 1
      } else if (a === undefined) {
        return -1
      } else if (a === b) {
      } else {
        return compareIdentifiers(a, b)
      }
    } while (++i)
  }

  compareBuild(input: Input) {
    let other: SemVer
    if (!(input instanceof SemVer)) {
      other = new SemVer(input, this.options)
    } else {
      other = input
    }

    let i = 0
    do {
      const a = this.build[i]
      const b = other.build[i]
      // debug('build compare', i, a, b)
      if (a === undefined && b === undefined) {
        return 0
      } else if (b === undefined) {
        return 1
      } else if (a === undefined) {
        return -1
      } else if (a === b) {
      } else {
        return compareIdentifiers(a, b)
      }
    } while (++i)
  }

  // preminor will bump the version up to the next minor release, and immediately
  // down to pre-release. premajor and prepatch work the same way.
  inc(
    release: ReleaseType | 'release',
    identifier?: ReleaseId,
    identifierBase?: boolean
  ) {
    validateIncIds(release, {
      identifier,
      identifierBase,
      matcher: this.options.loose
        ? re[t.PRERELEASELOOSE]
        : re[t.PRERELEASE],
    })

    switch (release) {
      case 'premajor':
        this.prerelease.length = 0
        this.patch = 0
        this.minor = 0
        this.major++
        this.prerelease = handlePre({
          identifier,
          identifierBase,
          prerelease: this.prerelease,
        })
        break
      case 'preminor':
        this.prerelease.length = 0
        this.patch = 0
        this.minor++
        this.prerelease = handlePre({
          identifier,
          identifierBase,
          prerelease: this.prerelease,
        })
        break
      case 'prepatch':
        // If this is already a prerelease, it will bump to the next version
        // drop any prereleases that might already exist, since they are not
        // relevant at this point.
        this.prerelease.length = 0
        this.inc('patch', identifier, identifierBase)
        this.prerelease = handlePre({
          identifier,
          identifierBase,
          prerelease: this.prerelease,
        })
        break
      // If the input is a non-prerelease version, this acts the same as
      // prepatch.
      case 'prerelease':
        if (this.prerelease.length === 0) {
          this.inc('patch', identifier, identifierBase)
        }
        this.prerelease = handlePre({
          identifier,
          identifierBase,
          prerelease: this.prerelease,
        })
        break
      case 'release':
        if (this.prerelease.length === 0) {
          throw new Error(`version ${this.raw} is not a prerelease`)
        }
        this.prerelease.length = 0
        break

      case 'major':
        // If this is a pre-major version, bump up to the same major version.
        // Otherwise increment major.
        // 1.0.0-5 bumps to 1.0.0
        // 1.1.0 bumps to 2.0.0
        if (
          this.minor !== 0 ||
          this.patch !== 0 ||
          this.prerelease.length === 0
        ) {
          this.major++
        }
        this.minor = 0
        this.patch = 0
        this.prerelease = []
        break
      case 'minor':
        // If this is a pre-minor version, bump up to the same minor version.
        // Otherwise increment minor.
        // 1.2.0-5 bumps to 1.2.0
        // 1.2.1 bumps to 1.3.0
        if (this.patch !== 0 || this.prerelease.length === 0) {
          this.minor++
        }
        this.patch = 0
        this.prerelease = []
        break
      case 'patch':
        // If this is not a pre-release version, it will increment the patch.
        // If it is a pre-release it will bump up to the same patch version.
        // 1.2.0-5 patches to 1.2.0
        // 1.2.0 patches to 1.2.1
        if (this.prerelease.length === 0) {
          this.patch++
        }
        this.prerelease = []
        break
      default:
        throw new Error(`invalid increment argument: ${release}`)
    }
    this.raw = this.format()
    if (this.build.length) {
      this.raw += `+${this.build.join('.')}`
    }
    return this
  }
}

function parse(
  version: SemVer | Input,
  options: Options,
  throwErrors: true
): SemVer

function parse(
  version: SemVer | Input,
  options: Options,
  throwErrors: boolean
): SemVer | null

function parse(
  version: SemVer | Input,
  options: Options = {},
  throwErrors: boolean = false
) {
  if (version instanceof SemVer) {
    return version
  }
  try {
    return new SemVer(version, options)
  } catch (er) {
    if (!throwErrors) {
      return null
    }
    throw er
  }
}

const valid = (
  version: any,
  options: Options = {},
  throwErrors = false
) => {
  const v = parse(version, options, throwErrors)
  return v ? v.version : null
}

const clean = (
  version: string,
  options: Options = {},
  throwErrors = false
) => {
  const s = parse(
    version.trim().replace(/^[=v]+/, ''),
    options,
    throwErrors
  )
  return s ? s.version : null
}

const coerce = (
  version: SemVer | string | number,
  options: Options & { rtl?: boolean } = {},
  throwErrors = false
) => {
  if (version instanceof SemVer) {
    return version
  }

  if (typeof version === 'number') {
    version = String(version)
  }

  if (typeof version !== 'string') {
    return null
  }

  let match = null
  if (!options.rtl) {
    match = version.match(
      options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]
    )
  } else {
    // Find the right-most coercible string that does not share
    // a terminus with a more left-ward coercible string.
    // Eg, '1.2.3.4' wants to coerce '2.3.4', not '3.4' or '4'
    // With includePrerelease option set, '1.2.3.4-rc' wants to coerce '2.3.4-rc', not '2.3.4'
    //
    // Walk through the string checking with a /g regexp
    // Manually set the index so as to pick up overlapping matches.
    // Stop when we get a match that ends at the string end, since no
    // coercible string can be more right-ward without the same terminus.
    const coerceRtlRegex = options.includePrerelease
      ? re[t.COERCERTLFULL]
      : re[t.COERCERTL]
    let next: any
    while (
      // biome-ignore lint/suspicious/noAssignInExpressions: vendor logic
      (next = coerceRtlRegex.exec(version)) &&
      (!match || match.index + match[0].length !== version.length)
    ) {
      if (
        !match ||
        next.index + next[0].length !== match.index + match[0].length
      ) {
        match = next
      }
      coerceRtlRegex.lastIndex =
        next.index + next[1].length + next[2].length
    }
    // leave it in a clean state
    coerceRtlRegex.lastIndex = -1
  }

  if (match === null) {
    return null
  }

  const major = match[2]
  const minor = match[3] || '0'
  const patch = match[4] || '0'
  const prerelease =
    options.includePrerelease && match[5] ? `-${match[5]}` : ''
  const build = options.includePrerelease && match[6] ? `+${match[6]}` : ''

  return parse(
    `${major}.${minor}.${patch}${prerelease}${build}`,
    options,
    throwErrors
  )
}

const inc = (
  version: any,
  release: ReleaseType | 'release',
  idOptions: IdOpts = {},
  options?: Options | string
) => {
  if (typeof options === 'string') {
    idOptions.identifierBase = idOptions.identifier
    idOptions.identifier = options
    options = undefined
  }

  try {
    return new SemVer(
      version instanceof SemVer ? version.version : version,
      options
    ).inc(release, idOptions.identifier, idOptions.identifierBase).version
  } catch (err: any) {
    if (err instanceof Error) {
      console.error(err.message)
    }
    return null
  }
}

export const semver = { clean, parse, valid, coerce, inc }
