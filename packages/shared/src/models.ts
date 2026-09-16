import { z } from 'zod'

export const modelProviderSchema = z.enum(['gateway', 'codex'])

export const modelRefSchema = z.object({
  provider: modelProviderSchema,
  modelId: z.string().min(1),
})

export type ModelProvider = z.infer<typeof modelProviderSchema>
export type ModelRef = z.infer<typeof modelRefSchema>

export const harnessFeaturesSchema = z.object({
  useMockModel: z.boolean(),
})

export type HarnessFeatures = z.output<typeof harnessFeaturesSchema>
export type HarnessFeatureOverrides = Partial<HarnessFeatures>
