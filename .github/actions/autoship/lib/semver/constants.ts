export const MAX_LENGTH = 256
export const MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6
export const MAX_SAFE_COMPONENT_LENGTH = 16
export const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991

export const STABLE_RELEASE_TYPES = ['patch', 'minor', 'major'] as const

export const RELEASE_TYPES = [
  ...STABLE_RELEASE_TYPES,
  'premajor',
  'preminor',
  'prepatch',
  'prerelease',
] as const

export type ReleaseType = (typeof RELEASE_TYPES)[number]
export type StableReleaseType = (typeof STABLE_RELEASE_TYPES)[number]
