import { describe, expect, test } from 'bun:test'
import { isCompatibleRuntime } from '../../../src/runtime/compatibility'
import { RUNTIME_BUILD_ID } from '../../../src/runtime/constants'

describe('local engine identity', () => {
  test('uses build identity as the sole compatibility check', () => {
    expect(isCompatibleRuntime({ buildId: RUNTIME_BUILD_ID })).toBe(true)
    expect(isCompatibleRuntime({ buildId: 'stale-build' })).toBe(false)
    expect(isCompatibleRuntime({})).toBe(false)
  })
})
