import {
  DurableStream,
  DurableStreamError,
  StreamClosedError,
  stream as readDurableStream,
  type JsonBatch,
  type Offset,
} from '@durable-streams/client'
import type { UIMessageChunk } from 'ai'

const RUN_STREAM_CONTENT_TYPE = 'application/json'

export function runStreamUrl(runId: string, endpoint: string): string {
  return `${endpoint}/durable-streams/v1/stream/sensos/runs/${encodeURIComponent(runId)}`
}

function runStream(runId: string, endpoint: string): DurableStream {
  return new DurableStream({
    url: runStreamUrl(runId, endpoint),
    contentType: RUN_STREAM_CONTENT_TYPE,
  })
}

export async function ensureRunStream(
  runId: string,
  endpoint: string
): Promise<void> {
  const output = runStream(runId, endpoint)
  const metadata = await output.head()
  if (metadata.exists) return

  try {
    await output.create({ contentType: RUN_STREAM_CONTENT_TYPE })
  } catch (error) {
    if (
      !(
        error instanceof DurableStreamError &&
        error.code === 'CONFLICT_EXISTS'
      )
    ) {
      throw error
    }
  }
}

export async function appendRunStreamChunk(
  runId: string,
  sequence: number,
  chunk: UIMessageChunk,
  endpoint: string
): Promise<void> {
  await runStream(runId, endpoint).append(JSON.stringify(chunk), {
    seq: sequence.toString().padStart(16, '0'),
  })
}

export async function closeRunStream(
  runId: string,
  chunk: UIMessageChunk,
  endpoint: string
): Promise<void> {
  try {
    await runStream(runId, endpoint).close({ body: JSON.stringify(chunk) })
  } catch (error) {
    if (!(error instanceof StreamClosedError)) throw error
  }
}

export type RunStreamItem = {
  chunk: UIMessageChunk
  offset?: Offset
}

export type StreamTimingEvent = (
  event: string,
  fields?: Readonly<
    Record<string, boolean | number | string | null | undefined>
  >
) => void

export async function* readRunStream(options: {
  runId: string
  offset?: Offset
  signal?: AbortSignal
  endpoint: string
  recordTiming?: StreamTimingEvent
}): AsyncGenerator<RunStreamItem> {
  const startedAt = Date.now()
  options.recordTiming?.('client.stream.connect_start', {
    runId: options.runId,
  })
  const response = await readDurableStream<UIMessageChunk>({
    url: runStreamUrl(options.runId, options.endpoint),
    offset: options.offset ?? '-1',
    live: 'sse',
    signal: options.signal,
  })

  const batches: JsonBatch<UIMessageChunk>[] = []
  let wake: (() => void) | undefined
  let finished = false
  let failure: unknown
  let receivedChunk = false
  const notify = () => {
    wake?.()
    wake = undefined
  }
  const unsubscribe = response.subscribeJson(batch => {
    batches.push(batch)
    notify()
  })
  void response.closed.then(
    () => {
      finished = true
      notify()
    },
    error => {
      failure = error
      finished = true
      notify()
    }
  )

  try {
    for (;;) {
      const batch = batches.shift()
      if (!batch) {
        if (failure) throw failure
        if (finished) {
          options.recordTiming?.('client.stream.closed', {
            runId: options.runId,
            elapsedMs: Date.now() - startedAt,
          })
          return
        }
        await new Promise<void>(resolve => {
          wake = resolve
        })
        continue
      }

      for (const [index, chunk] of batch.items.entries()) {
        if (!receivedChunk) {
          receivedChunk = true
          options.recordTiming?.('client.stream.first_chunk', {
            runId: options.runId,
            elapsedMs: Date.now() - startedAt,
          })
        }
        yield {
          chunk,
          ...(index === batch.items.length - 1
            ? { offset: batch.offset }
            : {}),
        }
      }
    }
  } finally {
    unsubscribe()
  }
}

export function createRunStreamReader(
  endpoint: string,
  recordTiming?: StreamTimingEvent
) {
  return (options: {
    runId: string
    offset?: Offset
    signal?: AbortSignal
  }) => readRunStream({ ...options, endpoint, recordTiming })
}
