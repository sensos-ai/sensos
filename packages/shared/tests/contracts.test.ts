import { describe, expect, test } from 'bun:test'
import {
  SENSOS_PROTOCOL_VERSION,
  harnessFeaturesSchema,
  modelRefSchema,
  protocolErrorSchema,
  runStatusSchema,
  runStreamCursorSchema,
  runStreamName,
  sessionActorKey,
  sessionInputSchema,
} from '../src'
import type {
  SensosRegistry,
  SessionActions,
  SessionEvents,
  SessionQueues,
} from '../src'

describe('public wire contract', () => {
  test('parses every runtime schema', () => {
    expect(SENSOS_PROTOCOL_VERSION).toBe(1)
    expect(
      sessionActorKey({ tenantId: 't', userId: 'u', sessionId: 's' })
    ).toEqual(['t', 'u', 's'])
    expect(
      modelRefSchema.parse({ provider: 'codex', modelId: 'gpt-5' })
    ).toEqual({ provider: 'codex', modelId: 'gpt-5' })
    expect(harnessFeaturesSchema.parse({ useMockModel: true })).toEqual({
      useMockModel: true,
    })
    expect(runStatusSchema.options).toContain('cancel_requested')
    expect(
      sessionInputSchema.parse({
        protocolVersion: 1,
        sessionId: 's',
        cwd: '/tmp',
        features: { useMockModel: true },
      }).sessionId
    ).toBe('s')
    expect(runStreamCursorSchema.parse('cursor')).toBe('cursor')
    expect(runStreamName('run/id')).toBe('sensos/runs/run%2Fid')
    expect(
      protocolErrorSchema.parse({ code: 'unavailable', message: 'later' })
        .retryable
    ).toBe(false)
  })

  test('exports complete action, event, queue, and registry types', () => {
    type ExpectedActions =
      | 'cancel'
      | 'deliver'
      | 'deleteSession'
      | 'getSession'
      | 'setModel'
      | 'setFeatures'
      | 'getRun'
      | 'streamSnapshot'
    type ExpectedEvents =
      | 'frame'
      | 'statusChanged'
      | 'messagesChanged'
      | 'titleChanged'
      | 'deliveryRouted'
    type ExpectedQueues = 'runs' | 'inbox'
    const actions: Record<ExpectedActions, true> = {} as Record<
      keyof SessionActions,
      true
    >
    const events: Record<ExpectedEvents, true> = {} as Record<
      keyof SessionEvents,
      true
    >
    const queues: Record<ExpectedQueues, true> = {} as Record<
      keyof SessionQueues,
      true
    >
    const registry: SensosRegistry | undefined = undefined
    expect([actions, events, queues, registry]).toHaveLength(4)
  })
})
