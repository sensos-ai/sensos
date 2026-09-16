import {
  createSensosClient,
  resolveSensosRemoteTarget,
  type SensosClient,
} from '@sensos-ai/client'
import { acquireRuntime, type RuntimeLease } from './client'
import { RUNTIME_ENDPOINT, RUNTIME_STREAMS_ENDPOINT } from './constants'

export const REGISTRY_ENDPOINT_ENV = 'SENSOS_REGISTRY_ENDPOINT'
export const STREAMS_URL_ENV = 'SENSOS_STREAMS_URL'

declare const __SENSOS_REGISTRY_ENDPOINT__: string
declare const __SENSOS_STREAMS_URL__: string

function builtEndpoint(value: string | undefined): string | undefined {
  return value?.trim() || undefined
}

const BUILT_ENGINE_ENDPOINT = builtEndpoint(
  typeof __SENSOS_REGISTRY_ENDPOINT__ === 'undefined'
    ? undefined
    : __SENSOS_REGISTRY_ENDPOINT__
)
const BUILT_STREAMS_ENDPOINT = builtEndpoint(
  typeof __SENSOS_STREAMS_URL__ === 'undefined'
    ? undefined
    : __SENSOS_STREAMS_URL__
)

export type RivetEngineTarget =
  | { kind: 'local' }
  | {
      kind: 'remote'
      endpoint: string
      streamsEndpoint: string
      token?: string
      namespace?: string
    }

export type RivetEngineConnection = {
  client: SensosClient
  endpoint: string
  streamsEndpoint: string
  release(): Promise<void>
}

export function resolveRivetEngineTarget(
  options: {
    token?: string
    namespace?: string
    localEngine?: boolean
  } = {},
  env: Readonly<Record<string, string | undefined>> = process.env
): RivetEngineTarget {
  if (options.localEngine) return { kind: 'local' }
  const remoteEndpoint =
    env[REGISTRY_ENDPOINT_ENV]?.trim() || BUILT_ENGINE_ENDPOINT
  const remoteStreamsEndpoint =
    env[STREAMS_URL_ENV]?.trim() || BUILT_STREAMS_ENDPOINT

  const remote = resolveSensosRemoteTarget(
    {
      endpoint: remoteEndpoint,
      streamsEndpoint: remoteStreamsEndpoint,
      token: options.token,
      namespace: options.namespace,
    },
    {}
  )
  return {
    kind: 'remote',
    ...remote,
  }
}

/**
 * Owns the connection below chat/session semantics. Remote mode is a pure
 * Rivet HTTP/WebSocket client and never initializes the local supervisor.
 */
export async function connectRivetEngine(
  target: RivetEngineTarget,
  productRoot: string
): Promise<RivetEngineConnection> {
  let lease: RuntimeLease | undefined
  if (target.kind === 'local') {
    lease = acquireRuntime(productRoot)
    await lease.ready
  }

  const endpointValue =
    target.kind === 'local' ? RUNTIME_ENDPOINT : target.endpoint
  const streamsEndpoint =
    target.kind === 'local'
      ? RUNTIME_STREAMS_ENDPOINT
      : target.streamsEndpoint
  const client = createSensosClient({
    endpoint: endpointValue,
    streamsEndpoint,
    ...(target.kind === 'remote' && target.token
      ? { token: target.token }
      : {}),
    ...(target.kind === 'remote' && target.namespace
      ? { namespace: target.namespace }
      : {}),
  })
  if (target.kind === 'remote') await client.negotiateProtocol()

  return {
    client,
    endpoint: endpointValue,
    streamsEndpoint,
    async release() {
      await client.dispose()
      await lease?.release()
    },
  }
}
