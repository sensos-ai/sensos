// packages/shared/dist/shared/shared-7ak4yh36.js
import { z } from "zod";
var SENSOS_PROTOCOL_VERSIONS2 = [1];
var LATEST_SENSOS_PROTOCOL_VERSION2 = SENSOS_PROTOCOL_VERSIONS2[0];
var protocolVersionSchema2 = z.number().int().positive();
var supportedProtocolVersionsSchema2 = z.array(protocolVersionSchema2).min(1);
var protocolDiscoverySchema2 = z.object({
  protocolVersion: protocolVersionSchema2,
  supportedProtocolVersions: supportedProtocolVersionsSchema2
});
var sessionActorKeySchema2 = z.tuple([
  z.string().min(1),
  z.string().min(1),
  z.string().min(1)
]);
function sessionActorKey2(input) {
  return sessionActorKeySchema2.parse([
    input.tenantId,
    input.userId,
    input.sessionId
  ]);
}
var protocolErrorCodeSchema2 = z.enum([
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "invalid_request",
  "protocol_mismatch",
  "credentials_required",
  "unavailable",
  "internal"
]);
var protocolErrorSchema2 = z.object({
  code: protocolErrorCodeSchema2,
  message: z.string(),
  retryable: z.boolean().default(false),
  details: z.record(z.string(), z.unknown()).optional()
});

// packages/shared/dist/shared/shared-298pabq2.js
import { z as z2 } from "zod";
var modelProviderSchema2 = z2.enum(["gateway", "codex"]);
var modelRefSchema2 = z2.object({
  provider: modelProviderSchema2,
  modelId: z2.string().min(1)
});
var harnessFeaturesSchema2 = z2.object({
  useMockModel: z2.boolean()
});

// packages/shared/dist/shared/shared-dxx9mz51.js
import { z as z3 } from "zod";
var runStatusSchema2 = z3.enum([
  "queued",
  "running",
  "cancel_requested",
  "completed",
  "failed",
  "cancelled",
  "interrupted"
]);
var sessionInputSchema2 = z3.object({
  supportedProtocolVersions: supportedProtocolVersionsSchema2,
  sessionId: z3.string().min(1),
  catalogRevision: z3.number().int().nonnegative().optional(),
  cwd: z3.string().min(1),
  model: modelRefSchema2.optional(),
  instructions: z3.string().optional(),
  initialMessages: z3.array(z3.custom()).optional(),
  features: harnessFeaturesSchema2.partial().optional()
});

// packages/shared/dist/shared/shared-5zzdgy4y.js
import { z as z4 } from "zod";
var runStreamCursorSchema2 = z4.string().min(1);

// packages/client/src/client.ts
import { createClient } from "rivetkit/client";
import { configureDefaultLogger } from "rivetkit/log";

// packages/client/src/streams.ts
import {
  DurableStream,
  DurableStreamError,
  StreamClosedError,
  stream as readDurableStream
} from "@durable-streams/client";
var RUN_STREAM_CONTENT_TYPE = "application/json";
function runStreamUrl(runId, endpoint) {
  return `${endpoint}/durable-streams/v1/stream/sensos/runs/${encodeURIComponent(runId)}`;
}
function runStream(runId, endpoint) {
  return new DurableStream({
    url: runStreamUrl(runId, endpoint),
    contentType: RUN_STREAM_CONTENT_TYPE
  });
}
async function ensureRunStream(runId, endpoint) {
  const output = runStream(runId, endpoint);
  const metadata = await output.head();
  if (metadata.exists)
    return;
  try {
    await output.create({ contentType: RUN_STREAM_CONTENT_TYPE });
  } catch (error) {
    if (!(error instanceof DurableStreamError && error.code === "CONFLICT_EXISTS")) {
      throw error;
    }
  }
}
async function appendRunStreamChunk(runId, sequence, chunk, endpoint) {
  await runStream(runId, endpoint).append(JSON.stringify(chunk), {
    seq: sequence.toString().padStart(16, "0")
  });
}
async function closeRunStream(runId, chunk, endpoint) {
  try {
    await runStream(runId, endpoint).close({ body: JSON.stringify(chunk) });
  } catch (error) {
    if (!(error instanceof StreamClosedError))
      throw error;
  }
}
async function* readRunStream(options) {
  const startedAt = Date.now();
  options.recordTiming?.("client.stream.connect_start", {
    runId: options.runId
  });
  const response = await readDurableStream({
    url: runStreamUrl(options.runId, options.endpoint),
    offset: options.offset ?? "-1",
    live: "sse",
    signal: options.signal
  });
  const batches = [];
  let wake;
  let finished = false;
  let failure;
  let receivedChunk = false;
  const notify = () => {
    wake?.();
    wake = undefined;
  };
  const unsubscribe = response.subscribeJson((batch) => {
    batches.push(batch);
    notify();
  });
  response.closed.then(() => {
    finished = true;
    notify();
  }, (error) => {
    failure = error;
    finished = true;
    notify();
  });
  try {
    for (;; ) {
      const batch = batches.shift();
      if (!batch) {
        if (failure)
          throw failure;
        if (finished) {
          options.recordTiming?.("client.stream.closed", {
            runId: options.runId,
            elapsedMs: Date.now() - startedAt
          });
          return;
        }
        await new Promise((resolve) => {
          wake = resolve;
        });
        continue;
      }
      for (const [index, chunk] of batch.items.entries()) {
        if (!receivedChunk) {
          receivedChunk = true;
          options.recordTiming?.("client.stream.first_chunk", {
            runId: options.runId,
            elapsedMs: Date.now() - startedAt
          });
        }
        yield {
          chunk,
          ...index === batch.items.length - 1 ? { offset: batch.offset } : {}
        };
      }
    }
  } finally {
    unsubscribe();
  }
}
function createRunStreamReader(endpoint, recordTiming) {
  return (options) => readRunStream({ ...options, endpoint, recordTiming });
}

// packages/client/src/client.ts
var REGISTRY_ENDPOINT_ENV = "SENSOS_REGISTRY_ENDPOINT";
var STREAMS_URL_ENV = "SENSOS_STREAMS_URL";
function configureSensosClientLogger(level = "silent") {
  configureDefaultLogger(level);
}
function normalizeHttpEndpoint(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute HTTP(S) URL`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must use HTTP or HTTPS`);
  }
  return parsed.toString().replace(/\/$/, "");
}
function resolveSensosRemoteTarget(options = {}, env = process.env) {
  const endpoint = options.endpoint ?? env[REGISTRY_ENDPOINT_ENV]?.trim();
  const streamsEndpoint = options.streamsEndpoint ?? env[STREAMS_URL_ENV]?.trim();
  if (!endpoint && !streamsEndpoint) {
    throw new Error(`Remote engine is not configured. Set ${REGISTRY_ENDPOINT_ENV} and ${STREAMS_URL_ENV}, or use a local engine.`);
  }
  if (!endpoint || !streamsEndpoint) {
    throw new Error(`Remote engine mode requires both ${REGISTRY_ENDPOINT_ENV} and ${STREAMS_URL_ENV}`);
  }
  return {
    endpoint: normalizeHttpEndpoint(endpoint, "Remote engine endpoint"),
    streamsEndpoint: normalizeHttpEndpoint(streamsEndpoint, "Remote streams endpoint"),
    ...options.token ? { token: options.token } : {},
    ...options.namespace ? { namespace: options.namespace } : {}
  };
}
function createSensosClient(options) {
  const endpoint = normalizeHttpEndpoint(options.endpoint, "Sensos engine endpoint");
  const streamsEndpoint = normalizeHttpEndpoint(options.streamsEndpoint, "Sensos streams endpoint");
  const fetcher = options.fetch ?? globalThis.fetch;
  const rivet = createClient({
    endpoint,
    ...options.token ? { token: options.token } : {},
    ...options.namespace ? { namespace: options.namespace } : {}
  });
  return {
    endpoint,
    streamsEndpoint,
    supportedProtocolVersions: SENSOS_PROTOCOL_VERSIONS2,
    rivet,
    session: rivet.session,
    readRunStream: createRunStreamReader(streamsEndpoint),
    async negotiateProtocol() {
      const discoveryUrl = new URL(endpoint);
      discoveryUrl.pathname = discoveryUrl.pathname.endsWith("/api/rivet") ? `${discoveryUrl.pathname.slice(0, -"/api/rivet".length)}/api/protocol` : "/api/protocol";
      discoveryUrl.search = "";
      discoveryUrl.hash = "";
      const response = await fetcher(discoveryUrl, {
        headers: options.token ? { authorization: `Bearer ${options.token}` } : undefined
      });
      if (!response.ok) {
        throw new Error(`Sensos protocol discovery failed with HTTP ${response.status}`);
      }
      const discovery = protocolDiscoverySchema2.parse(await response.json());
      const selected = SENSOS_PROTOCOL_VERSIONS2.find((version) => discovery.supportedProtocolVersions.includes(version));
      if (selected === undefined) {
        throw new Error(`Sensos protocol mismatch: client supports ${SENSOS_PROTOCOL_VERSIONS2.join(", ")}; engine supports ${discovery.supportedProtocolVersions.join(", ")}`);
      }
      return selected;
    },
    assertProtocolVersion(version) {
      if (!SENSOS_PROTOCOL_VERSIONS2.includes(version)) {
        throw new Error(`Sensos protocol mismatch: engine selected ${version}; client supports ${SENSOS_PROTOCOL_VERSIONS2.join(", ")}`);
      }
      return version;
    },
    dispose: () => rivet.dispose()
  };
}
// packages/client/src/actors.ts
async function listActorRecords(endpoint, fetcher) {
  const url = new URL("/actors", endpoint);
  url.searchParams.set("name", "session");
  url.searchParams.set("namespace", "default");
  const response = await fetcher(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to list local sessions (${response.status})`);
  }
  return (await response.json()).actors;
}
function deserializeSingleKey(value) {
  if (!value || value === "/")
    return;
  let result = "";
  let escaping = false;
  for (const character of value) {
    if (escaping) {
      if (character === "0")
        return;
      result += character;
      escaping = false;
    } else if (character === "\\") {
      escaping = true;
    } else if (character === "/") {
      return;
    } else {
      result += character;
    }
  }
  return escaping ? `${result}\\` : result;
}
async function waitForSessionDeletion(endpoint, sessionId, options = {}) {
  const fetcher = options.fetcher ?? fetch;
  const deadline = Date.now() + (options.timeoutMs ?? 5000);
  while (true) {
    const active = (await listActorRecords(endpoint, fetcher)).some((actor) => !actor.destroy_ts && deserializeSingleKey(actor.key) === sessionId);
    if (!active)
      return;
    if (Date.now() >= deadline) {
      throw new Error(`Timed out deleting session ${sessionId}`);
    }
    await Bun.sleep(options.pollIntervalMs ?? 50);
  }
}
async function deleteSessionActor(endpoint, sessionId, fetcher = fetch) {
  const actor = (await listActorRecords(endpoint, fetcher)).find((candidate) => !candidate.destroy_ts && deserializeSingleKey(candidate.key) === sessionId);
  if (!actor)
    return;
  const url = new URL(`/actors/${encodeURIComponent(actor.actor_id)}`, endpoint);
  url.searchParams.set("namespace", "default");
  const response = await fetcher(url.toString(), { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`Failed to delete local session (${response.status})`);
  }
}
// packages/client/src/session-chat-transport.ts
var createIdempotencyId = () => `request-${crypto.randomUUID()}`;
var noopTiming = () => {};
function requestBody(body) {
  return body ?? {};
}
function getFinalUserMessage(messages) {
  const message = messages.findLast((candidate) => candidate.role === "user");
  if (!message)
    throw new Error("Cannot submit chat without a user message");
  return message;
}
function createStreamBridge(readStream, onOffset) {
  let controller;
  let settled = false;
  const readController = new AbortController;
  const extraCleanups = [];
  const cleanup = () => {
    readController.abort("stream reader detached");
    for (const cleanup of extraCleanups)
      cleanup();
  };
  const close = () => {
    if (settled)
      return;
    settled = true;
    cleanup();
    controller.close();
  };
  const fail = (error) => {
    if (settled)
      return;
    settled = true;
    cleanup();
    controller.error(error);
  };
  const stream = new ReadableStream({
    start(value) {
      controller = value;
    },
    cancel() {
      if (!settled) {
        settled = true;
        cleanup();
      }
    }
  });
  return {
    stream,
    read(runId, offset) {
      (async () => {
        try {
          for await (const item of readStream({
            runId,
            offset,
            signal: readController.signal
          })) {
            if (settled)
              return;
            controller.enqueue(item.chunk);
            if (item.offset !== undefined)
              onOffset(runId, item.offset);
          }
          close();
        } catch (error) {
          if (!settled && !readController.signal.aborted)
            fail(error);
        }
      })();
    },
    fail,
    close,
    addCleanup(cleanup) {
      extraCleanups.push(cleanup);
    }
  };
}
function getSessionSnapshot(connection) {
  return connection.getSession();
}

class SessionChatTransport {
  #connection;
  #clientId;
  #readStream;
  #recordTiming;
  #activeBridges = new Set;
  #lastSeenOffset = new Map;
  constructor(connection, options = {}) {
    this.#connection = connection;
    this.#clientId = options.clientId ?? "chat-client";
    this.#readStream = options.readStream ?? (() => {
      throw new Error("A durable run stream reader is required");
    });
    this.#recordTiming = options.recordTiming ?? noopTiming;
  }
  async deliverMessage(message, priority = "adaptive", options = {}) {
    const id = options.id ?? createIdempotencyId();
    const startedAt = Date.now();
    this.#recordTiming("client.delivery.start", { requestId: id });
    let cleanup = () => {};
    const receipt = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (result) => {
        if (settled || options.waitForStart && result.status === "queued") {
          return;
        }
        settled = true;
        cleanup();
        resolve(result);
      };
      const fail = (error) => {
        if (settled)
          return;
        settled = true;
        cleanup();
        reject(error);
      };
      const unsubscribe = this.#connection.on("deliveryRouted", (result) => {
        if (result.id === id)
          finish(result);
      });
      const timer = setTimeout(() => fail(new Error("Timed out waiting for inbox routing")), 1e4);
      const onAbort = () => fail(new Error("Inbox delivery aborted"));
      cleanup = () => {
        clearTimeout(timer);
        unsubscribe();
        options.signal?.removeEventListener("abort", onAbort);
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });
      if (options.signal?.aborted)
        onAbort();
    });
    try {
      const routed = await this.#connection.deliver({
        id,
        priority,
        message,
        createdAt: Date.now(),
        origin: { type: "client", clientId: this.#clientId }
      });
      if (!options.waitForStart || routed.status !== "queued") {
        cleanup();
        this.#recordTiming("client.delivery.routed", {
          requestId: id,
          runId: routed.runId,
          status: routed.status,
          elapsedMs: Date.now() - startedAt
        });
        return routed;
      }
    } catch (error) {
      cleanup();
      throw error;
    }
    const routed = await receipt;
    this.#recordTiming("client.delivery.routed", {
      requestId: id,
      runId: routed.runId,
      status: routed.status,
      elapsedMs: Date.now() - startedAt
    });
    return routed;
  }
  async sendMessages({
    trigger,
    messages,
    abortSignal,
    body
  }) {
    if (trigger === "regenerate-message") {
      throw new Error("SessionChatTransport does not support regeneration");
    }
    const bridge = this.#createBridge();
    let runId;
    let aborted = abortSignal?.aborted ?? false;
    const onAbort = () => {
      aborted = true;
      if (runId)
        this.#connection.cancel(runId).catch(bridge.fail);
    };
    abortSignal?.addEventListener("abort", onAbort, { once: true });
    bridge.addCleanup(() => abortSignal?.removeEventListener("abort", onAbort));
    try {
      const request = requestBody(body);
      const result = await this.deliverMessage(getFinalUserMessage(messages), request.priority ?? "adaptive", {
        id: request.idempotencyId,
        waitForStart: true
      });
      if (result.status === "refused" || !result.runId) {
        throw new Error(result.reason === "waiting_for_input" ? "Immediate steering is unavailable while the session is waiting for input" : result.reason === "session_busy" ? "The session is still processing another turn" : result.reason === "not_active" ? "The active run ended before the message could be delivered" : "The session could not start this message");
      }
      runId = result.runId;
      if (aborted)
        await this.#connection.cancel(runId);
      bridge.read(runId, "-1");
    } catch (error) {
      bridge.fail(error);
    }
    return bridge.stream;
  }
  async reconnectToStream({
    abortSignal
  }) {
    const bridge = this.#createBridge();
    const onAbort = () => bridge.close();
    abortSignal?.addEventListener("abort", onAbort, { once: true });
    bridge.addCleanup(() => abortSignal?.removeEventListener("abort", onAbort));
    try {
      if (abortSignal?.aborted) {
        bridge.close();
        return bridge.stream;
      }
      const session = await this.#connection.getSession();
      if (!session.activeRunId) {
        bridge.close();
        return null;
      }
      bridge.read(session.activeRunId, this.#lastSeenOffset.get(session.activeRunId) ?? "-1");
      return bridge.stream;
    } catch (error) {
      bridge.fail(error);
      return bridge.stream;
    }
  }
  detachActiveStreams() {
    for (const bridge of this.#activeBridges)
      bridge.close();
  }
  async stopActiveRun() {
    const session = await this.#connection.getSession();
    if (!session.activeRunId)
      return { cancelled: false };
    return this.#connection.cancel(session.activeRunId);
  }
  #createBridge() {
    const bridge = createStreamBridge(this.#readStream, (runId, offset) => {
      this.#lastSeenOffset.set(runId, offset);
    });
    this.#activeBridges.add(bridge);
    bridge.addCleanup(() => this.#activeBridges.delete(bridge));
    return bridge;
  }
}

class DeferredSessionChatTransport {
  #transport;
  constructor(connection, options = {}) {
    this.#transport = connection.then((value) => new SessionChatTransport(value, options));
  }
  async sendMessages(options) {
    return (await this.#transport).sendMessages(options);
  }
  async deliverMessage(message, priority = "adaptive", options) {
    return (await this.#transport).deliverMessage(message, priority, options);
  }
  async reconnectToStream(options) {
    return (await this.#transport).reconnectToStream(options);
  }
  async stopActiveRun() {
    return (await this.#transport).stopActiveRun();
  }
  detachActiveStreams() {
    this.#transport.then((value) => value.detachActiveStreams());
  }
}

// packages/client/src/index.ts
var SENSOS_CLIENT_PACKAGE_VERSION = "0.1.0";
export {
  DeferredSessionChatTransport,
  REGISTRY_ENDPOINT_ENV,
  SENSOS_CLIENT_PACKAGE_VERSION,
  STREAMS_URL_ENV,
  SessionChatTransport,
  appendRunStreamChunk,
  closeRunStream,
  configureSensosClientLogger,
  createRunStreamReader,
  createSensosClient,
  deleteSessionActor,
  ensureRunStream,
  getSessionSnapshot,
  readRunStream,
  resolveSensosRemoteTarget,
  runStreamUrl,
  sessionActorKey2 as sessionActorKey,
  waitForSessionDeletion
};
