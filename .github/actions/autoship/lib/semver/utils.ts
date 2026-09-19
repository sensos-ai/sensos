import { STABLE_RELEASE_TYPES, type StableReleaseType } from './constants'

export const isStableReleaseType = (
  type: any
): type is StableReleaseType => type && STABLE_RELEASE_TYPES.includes(type)

const numeric = /^[0-9]+$/
export const compareIdentifiers = (
  a: string | number,
  b: string | number
) => {
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b ? 0 : a < b ? -1 : 1
  }

  const anum = numeric.test(String(a))
  const bnum = numeric.test(String(b))

  if (anum && bnum) {
    a = +a
    b = +b
  }

  return a === b
    ? 0
    : anum && !bnum
      ? -1
      : bnum && !anum
        ? 1
        : a < b
          ? -1
          : 1
}

export const rcompareIdentifiers = (a: string, b: string) =>
  compareIdentifiers(b, a)

export const isPrereleaseIdentifier = (
  prerelease: (string | number)[],
  identifier: string
) => {
  const identifiers = identifier.split('.')
  if (identifiers.length > prerelease.length) {
    return false
  }

  for (let i = 0; i < identifiers.length; i++) {
    if (compareIdentifiers(prerelease[i], identifiers[i]) !== 0) {
      return false
    }
  }

  return true
}
