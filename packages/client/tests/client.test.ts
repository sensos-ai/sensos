import { describe, expect, test } from 'bun:test'
import {
  createSensosClient,
  REGISTRY_ENDPOINT_ENV,
  resolveSensosRemoteTarget,
  sessionActorKey,
  STREAMS_URL_ENV,
} from '../src'

describe('Sensos client', () => {
  test('normalizes endpoints and preserves connection authentication', () => {
    expect(
      resolveSensosRemoteTarget({
        endpoint: 'https://engine.example.test/',
        streamsEndpoint: 'https://streams.example.test/',
        token: 'connection-token',
        namespace: 'tenant-one',
      })
    ).toEqual({
      endpoint: 'https://engine.example.test',
      streamsEndpoint: 'https://streams.example.test',
      token: 'connection-token',
      namespace: 'tenant-one',
    })
  })

  test('resolves endpoints from the supported environment contract', () => {
    expect(
      resolveSensosRemoteTarget(
        {},
        {
          [REGISTRY_ENDPOINT_ENV]: 'https://engine.example.test/',
          [STREAMS_URL_ENV]: 'https://streams.example.test/',
        }
      )
    ).toMatchObject({
      endpoint: 'https://engine.example.test',
      streamsEndpoint: 'https://streams.example.test',
    })
  })

  test('rejects invalid and incomplete endpoint configuration', () => {
    expect(() =>
      resolveSensosRemoteTarget(
        { endpoint: 'file:///tmp/engine' },
        { [STREAMS_URL_ENV]: 'https://streams.example.test' }
      )
    ).toThrow('must use HTTP or HTTPS')
    expect(() =>
      resolveSensosRemoteTarget(
        {},
        { [REGISTRY_ENDPOINT_ENV]: 'https://engine.example.test' }
      )
    ).toThrow('requires both')
  })

  test('rejects an incompatible engine protocol before connecting', () => {
    expect(() =>
      createSensosClient({
        endpoint: 'https://engine.example.test',
        streamsEndpoint: 'https://streams.example.test',
        protocolVersion: 999,
      })
    ).toThrow('protocol mismatch')
  })

  test('exports the canonical actor key helper', () => {
    expect(
      sessionActorKey({
        tenantId: 'tenant-one',
        userId: 'user-one',
        sessionId: 'session-one',
      })
    ).toEqual(['tenant-one', 'user-one', 'session-one'])
  })
})
