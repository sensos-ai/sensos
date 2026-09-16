import type { GatewayModelId } from 'ai'
import { modelRefSchema } from '@sensos-ai/shared/models'
import type { ModelIdOf } from './harness-provider'
import type { HarnessProviderRegistry, ModelProvider } from './registry'
import type { CodexModelId } from './openai'

export type ModelRef = {
  [ProviderId in ModelProvider]: {
    provider: ProviderId
    modelId: ModelIdOf<HarnessProviderRegistry[ProviderId]>
  }
}[ModelProvider]

export { modelRefSchema }

export function modelRefForProvider<ProviderId extends ModelProvider>(
  provider: ProviderId,
  modelId: ModelIdOf<HarnessProviderRegistry[ProviderId]>
): Extract<ModelRef, { provider: ProviderId }> {
  return modelRefSchema.parse({ provider, modelId }) as Extract<
    ModelRef,
    { provider: ProviderId }
  >
}

export function normalizeLegacyModelRef(
  value: ModelRef | string | undefined
): ModelRef | undefined {
  if (!value) return undefined
  if (typeof value !== 'string') return modelRefSchema.parse(value)
  return value.includes('/')
    ? modelRefForProvider('gateway', value as GatewayModelId)
    : modelRefForProvider('codex', value as CodexModelId)
}
