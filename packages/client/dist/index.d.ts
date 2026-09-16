import { SENSOS_PROTOCOL_VERSIONS, SensosProtocolVersion, SensosRegistry } from "@sensos-ai/shared";
import { Client } from "rivetkit/client";
import { Offset } from "@durable-streams/client";
import { UIMessageChunk } from "ai";
declare function runStreamUrl(runId: string, endpoint: string): string;
declare function ensureRunStream(runId: string, endpoint: string): Promise<void>;
declare function appendRunStreamChunk(runId: string, sequence: number, chunk: UIMessageChunk, endpoint: string): Promise<void>;
declare function closeRunStream(runId: string, chunk: UIMessageChunk, endpoint: string): Promise<void>;
type RunStreamItem = {
	chunk: UIMessageChunk;
	offset?: Offset;
};
type StreamTimingEvent = (event: string, fields?: Readonly<Record<string, boolean | number | string | null | undefined>>) => void;
declare function readRunStream2(options: {
	runId: string;
	offset?: Offset;
	signal?: AbortSignal;
	endpoint: string;
	recordTiming?: StreamTimingEvent;
}): AsyncGenerator<RunStreamItem>;
declare function createRunStreamReader(endpoint: string, recordTiming?: StreamTimingEvent): (options: {
	runId: string;
	offset?: Offset;
	signal?: AbortSignal;
}) => AsyncGenerator<RunStreamItem, any, any>;
declare const REGISTRY_ENDPOINT_ENV = "SENSOS_REGISTRY_ENDPOINT";
declare const STREAMS_URL_ENV = "SENSOS_STREAMS_URL";
type SensosRivetClient = Client<SensosRegistry>;
type SensosSessionHandle = ReturnType<SensosRivetClient["session"]["getOrCreate"]>;
type SensosSessionConnection = ReturnType<SensosSessionHandle["connect"]>;
type SensosFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type SensosClientOptions = {
	endpoint: string;
	streamsEndpoint: string;
	token?: string;
	namespace?: string;
	fetch?: SensosFetch;
};
type SensosRemoteTarget = {
	endpoint: string;
	streamsEndpoint: string;
	token?: string;
	namespace?: string;
};
declare function configureSensosClientLogger(level?: "silent" | "warn"): void;
declare function resolveSensosRemoteTarget(options?: {
	endpoint?: string;
	streamsEndpoint?: string;
	token?: string;
	namespace?: string;
}, env?: Readonly<Record<string, string | undefined>>): SensosRemoteTarget;
type SensosClient = {
	readonly endpoint: string;
	readonly streamsEndpoint: string;
	readonly supportedProtocolVersions: typeof SENSOS_PROTOCOL_VERSIONS;
	readonly rivet: SensosRivetClient;
	readonly session: SensosRivetClient["session"];
	readonly readRunStream: ReturnType<typeof createRunStreamReader>;
	negotiateProtocol(): Promise<SensosProtocolVersion>;
	assertProtocolVersion(version: number): SensosProtocolVersion;
	dispose(): Promise<void>;
};
declare function createSensosClient(options: SensosClientOptions): SensosClient;
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
declare function waitForSessionDeletion(endpoint: string, sessionId: string, options?: {
	fetcher?: Fetcher;
	timeoutMs?: number;
	pollIntervalMs?: number;
}): Promise<void>;
declare function deleteSessionActor(endpoint: string, sessionId: string, fetcher?: Fetcher): Promise<void>;
import { ChatTransport, UIMessage, UIMessageChunk as UIMessageChunk2 } from "ai";
import { Offset as Offset2 } from "@durable-streams/client";
import { DeliveryRoutedEvent, HarnessFeatures, InboxMessage, SessionSnapshot as ProtocolSessionSnapshot } from "@sensos-ai/shared";
type SessionConnection = SensosSessionConnection;
type SessionSnapshot = ProtocolSessionSnapshot & {
	features: HarnessFeatures;
};
type TimingValue = boolean | number | string | null | undefined;
type RecordTiming = (event: string, fields?: Readonly<Record<string, TimingValue>>) => void;
type RunStreamReader = (options: {
	runId: string;
	offset?: Offset2;
	signal?: AbortSignal;
}) => AsyncIterable<RunStreamItem>;
/** Loads the durable transcript and current session state for initial hydration. */
declare function getSessionSnapshot(connection: SessionConnection): Promise<SessionSnapshot>;
/** AI SDK v7 chat transport backed by one connected Rivet session actor. */
declare class SessionChatTransport<UI_MESSAGE extends UIMessage = UIMessage> implements ChatTransport<UI_MESSAGE> {
	private;
	constructor(connection: SessionConnection, options?: {
		clientId?: string;
		readStream?: RunStreamReader;
		recordTiming?: RecordTiming;
	});
	deliverMessage(message: UIMessage, priority?: InboxMessage["priority"], options?: {
		id?: string;
		signal?: AbortSignal;
		waitForStart?: boolean;
	}): Promise<DeliveryRoutedEvent>;
	sendMessages({ trigger, messages, abortSignal, body }: Parameters<ChatTransport<UI_MESSAGE>["sendMessages"]>[0]): Promise<ReadableStream<UIMessageChunk2>>;
	reconnectToStream({ abortSignal }: Parameters<ChatTransport<UI_MESSAGE>["reconnectToStream"]>[0]): Promise<ReadableStream<UIMessageChunk2> | null>;
	detachActiveStreams(): void;
	stopActiveRun(): Promise<{
		cancelled: boolean;
		runId?: string;
	}>;
}
/** Defers actor access so the terminal can accept input during runtime startup. */
declare class DeferredSessionChatTransport<UI_MESSAGE extends UIMessage = UIMessage> implements ChatTransport<UI_MESSAGE> {
	private;
	constructor(connection: Promise<SessionConnection>, options?: ConstructorParameters<typeof SessionChatTransport>[1]);
	sendMessages(options: Parameters<ChatTransport<UI_MESSAGE>["sendMessages"]>[0]): Promise<ReadableStream<UIMessageChunk2>>;
	deliverMessage(message: UIMessage, priority?: InboxMessage["priority"], options?: Parameters<SessionChatTransport["deliverMessage"]>[2]): Promise<DeliveryRoutedEvent>;
	reconnectToStream(options: Parameters<ChatTransport<UI_MESSAGE>["reconnectToStream"]>[0]): Promise<ReadableStream<UIMessageChunk2> | null>;
	stopActiveRun(): Promise<{
		cancelled: boolean;
		runId?: string;
	}>;
	detachActiveStreams(): void;
}
import { sessionActorKey, SessionActorKey } from "@sensos-ai/shared";
declare const SENSOS_CLIENT_PACKAGE_VERSION: "0.1.0";
export { DeferredSessionChatTransport, REGISTRY_ENDPOINT_ENV, RunStreamItem, RunStreamReader, SENSOS_CLIENT_PACKAGE_VERSION, STREAMS_URL_ENV, SensosClient, SensosClientOptions, SensosFetch, SensosRemoteTarget, SensosRivetClient, SensosSessionConnection, SensosSessionHandle, SessionActorKey, SessionChatTransport, SessionConnection, SessionSnapshot, StreamTimingEvent, appendRunStreamChunk, closeRunStream, configureSensosClientLogger, createRunStreamReader, createSensosClient, deleteSessionActor, ensureRunStream, getSessionSnapshot, readRunStream2 as readRunStream, resolveSensosRemoteTarget, runStreamUrl, sessionActorKey, waitForSessionDeletion };
