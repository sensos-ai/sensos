import {
  harnessFeaturesSchema,
  type HarnessFeatureOverrides,
  type HarnessFeatures,
} from '@sensos-ai/shared/models'
import { testModelEnabled } from './providers/test-model'

export {
  harnessFeaturesSchema,
  type HarnessFeatureOverrides,
  type HarnessFeatures,
}

/** Resolves every feature source once into a complete, transportable value. */
export function resolveHarnessFeatures(
  overrides: HarnessFeatureOverrides = {},
  env: Readonly<Record<string, string | undefined>> = process.env
): HarnessFeatures {
  return harnessFeaturesSchema.parse({
    useMockModel: overrides.useMockModel ?? testModelEnabled(env),
  })
}
