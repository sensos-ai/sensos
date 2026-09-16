import {
  SENSOS_PROTOCOL_VERSION,
  type SensosRegistry,
} from '@sensos-ai/shared'
import { createClient, type Client } from 'rivetkit/client'
import { configureDefaultLogger } from 'rivetkit/log'
import { createRunStreamReader } from './streams'

export const REGISTRY_ENDPOINT_ENV = 'SENSOS_REGISTRY_ENDPOINT'
export const STREAMS_URL_ENV = 'SENSOS_STREAMS_URL'

export type SensosRivetClient = Client<SensosRegistry>
export type SensosSessionHandle = ReturnType<
  SensosRivetClient['session']['getOrCreate']
>
export type SensosSessionConnection = ReturnType<
  SensosSessionHandle['connect']
>

export type SensosClientOptions = {
  endpoint: string
  streamsEndpoint: string
  token?: string
  namespace?: string
  protocolVersion?: number
}

export type SensosRemoteTarget = {
  endpoint: string
  streamsEndpoint: string
  token?: string
  namespace?: string
}

export function configureSensosClientLogger(
  level: 'silent' | 'warn' = 'silent'
): void {
  configureDefaultLogger(level)
}

function normalizeHttpEndpoint(value: string, label: string): string {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${label} must be an absolute HTTP(S) URL`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} must use HTTP or HTTPS`)
  }
  return parsed.toString().replace(/\/$/, '')
}

export function resolveSensosRemoteTarget(
  options: {
    endpoint?: string
    streamsEndpoint?: string
    token?: string
    namespace?: string
  } = {},
  env: Readonly<Record<string, string | undefined>> = process.env
): SensosRemoteTarget {
  const endpoint = options.endpoint ?? env[REGISTRY_ENDPOINT_ENV]?.trim()
  const streamsEndpoint =
    options.streamsEndpoint ?? env[STREAMS_URL_ENV]?.trim()

  if (!endpoint && !streamsEndpoint) {
    throw new Error(
      `Remote engine is not configured. Set ${REGISTRY_ENDPOINT_ENV} and ${STREAMS_URL_ENV}, or use a local engine.`
    )
  }
  if (!endpoint || !streamsEndpoint) {
    throw new Error(
      `Remote engine mode requires both ${REGISTRY_ENDPOINT_ENV} and ${STREAMS_URL_ENV}`
    )
  }

  return {
    endpoint: normalizeHttpEndpoint(endpoint, 'Remote engine endpoint'),
    streamsEndpoint: normalizeHttpEndpoint(
      streamsEndpoint,
      'Remote streams endpoint'
    ),
    ...(options.token ? { token: options.token } : {}),
    ...(options.namespace ? { namespace: options.namespace } : {}),
  }
}

export type SensosClient = {
  readonly endpoint: string
  readonly streamsEndpoint: string
  readonly protocolVersion: typeof SENSOS_PROTOCOL_VERSION
  readonly rivet: SensosRivetClient
  readonly session: SensosRivetClient['session']
  readonly readRunStream: ReturnType<typeof createRunStreamReader>
  dispose(): Promise<void>
}

export function createSensosClient(
  options: SensosClientOptions
): SensosClient {
  const endpoint = normalizeHttpEndpoint(
    options.endpoint,
    'Sensos engine endpoint'
  )
  const streamsEndpoint = normalizeHttpEndpoint(
    options.streamsEndpoint,
    'Sensos streams endpoint'
  )
  if (
    options.protocolVersion !== undefined &&
    options.protocolVersion !== SENSOS_PROTOCOL_VERSION
  ) {
    throw new Error(
      `Sensos protocol mismatch: client ${SENSOS_PROTOCOL_VERSION}, engine ${options.protocolVersion}`
    )
  }

  const rivet = createClient<SensosRegistry>({
    endpoint,
    ...(options.token ? { token: options.token } : {}),
    ...(options.namespace ? { namespace: options.namespace } : {}),
  })

  return {
    endpoint,
    streamsEndpoint,
    protocolVersion: SENSOS_PROTOCOL_VERSION,
    rivet,
    session: rivet.session,
    readRunStream: createRunStreamReader(streamsEndpoint),
    dispose: () => rivet.dispose(),
  }
}
