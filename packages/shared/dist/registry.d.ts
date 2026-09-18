import { AnyDatabaseProvider } from "rivetkit/db";
import { ActorDefinition, Registry } from "rivetkit";
import { ChatStatus, UIMessage, UIMessageChunk } from "ai";
import { z as z2 } from "zod";
import { z } from "zod";
declare const modelRefSchema: z.ZodObject<{
	provider: z.ZodEnum<{
		codex: "codex";
		gateway: "gateway";
	}>;
	modelId: z.ZodString;
}, z.core.$strip>;
type ModelRef = z.infer<typeof modelRefSchema>;
declare const harnessFeaturesSchema: z.ZodObject<{
	useMockModel: z.ZodBoolean;
}, z.core.$strip>;
type HarnessFeatures = z.output<typeof harnessFeaturesSchema>;
import { UIDataTypes as UIDataTypes_xvay7v } from "ai";
import { UITools as UITools_4y7ijr } from "ai";
declare const runStatusSchema: z2.ZodEnum<{
	cancel_requested: "cancel_requested";
	cancelled: "cancelled";
	completed: "completed";
	failed: "failed";
	interrupted: "interrupted";
	queued: "queued";
	running: "running";
}>;
type RunStatus = z2.infer<typeof runStatusSchema>;
type SessionStatus = "idle" | RunStatus;
declare const sessionInputSchema: z2.ZodObject<{
	supportedProtocolVersions: z2.ZodArray<z2.ZodNumber>;
	sessionId: z2.ZodString;
	catalogRevision: z2.ZodOptional<z2.ZodNumber>;
	cwd: z2.ZodString;
	model: z2.ZodOptional<z2.ZodObject<{
		provider: z2.ZodEnum<{
			codex: "codex";
			gateway: "gateway";
		}>;
		modelId: z2.ZodString;
	}, z2.core.$strip>>;
	instructions: z2.ZodOptional<z2.ZodString>;
	initialMessages: z2.ZodOptional<z2.ZodArray<z2.ZodCustom<UIMessage<unknown, UIDataTypes_xvay7v, UITools_4y7ijr>, UIMessage<unknown, UIDataTypes_xvay7v, UITools_4y7ijr>>>>;
	features: z2.ZodOptional<z2.ZodObject<{
		useMockModel: z2.ZodOptional<z2.ZodBoolean>;
	}, z2.core.$strip>>;
}, z2.core.$strip>;
type SessionInput = z2.input<typeof sessionInputSchema>;
type RunCommand = {
	idempotencyId: string;
	model?: ModelRef;
	message: UIMessage;
};
type SessionRun = {
	id: string;
	idempotencyId: string;
	status: RunStatus;
	model?: ModelRef;
	error?: string;
};
type InboxMessage = {
	id: string;
	priority: "now" | "next" | "adaptive";
	message: UIMessage;
	createdAt: number;
	origin: {
		type: "client";
		clientId: string;
	} | {
		type: "session";
		sessionId: string;
	} | {
		type: "system";
	};
};
type RunCompletion = {
	accepted: boolean;
	deduplicated: boolean;
	runId: string;
	status: RunStatus;
	reason?: "session_busy";
};
type SessionSnapshot = {
	protocolVersion: number;
	messages: UIMessage[];
	revision: number;
	runStatus: SessionStatus;
	status: ChatStatus;
	activeRunId?: string;
	model?: ModelRef;
	features: HarnessFeatures;
	title?: string;
	error?: string;
};
type FrameEvent = {
	runId: string;
	seq: number;
	chunk: UIMessageChunk;
};
type StatusChangedEvent = {
	runId?: string;
	runStatus: SessionStatus;
	status: ChatStatus;
	error?: string;
};
type DeliveryRoutedEvent = {
	id: string;
	status: "queued" | "started" | "steered" | "refused";
	runId?: string;
	reason?: "waiting_for_input" | "session_busy" | "not_active";
	origin: InboxMessage["origin"];
};
import { ChatStatus as ChatStatus2, UIMessage as UIMessage2 } from "ai";
type PublicAction<
	Args extends unknown[],
	Output
> = (context: any, ...args: Args) => Output | Promise<Output>;
type SensosSessionEvents = {
	frame: {
		readonly _eventType?: FrameEvent;
	};
	statusChanged: {
		readonly _eventType?: StatusChangedEvent;
	};
	messagesChanged: {
		readonly _eventType?: {
			messages: UIMessage2[];
			revision: number;
		};
	};
	titleChanged: {
		readonly _eventType?: {
			title: string;
		};
	};
	deliveryRouted: {
		readonly _eventType?: DeliveryRoutedEvent;
	};
};
type SensosSessionQueues = {
	runs: {
		readonly _queueMessage?: RunCommand;
		readonly _queueComplete?: RunCompletion;
	};
	inbox: {
		readonly _queueMessage?: InboxMessage;
	};
};
type SensosSessionActions = {
	cancel: PublicAction<[runId: string], {
		cancelled: boolean;
		runId: string;
	}>;
	deliver: PublicAction<[message: InboxMessage], DeliveryRoutedEvent>;
	deleteSession: PublicAction<[], void>;
	getSession: PublicAction<[], SessionSnapshot>;
	setModel: PublicAction<[model: ModelRef], {
		model: ModelRef;
	}>;
	setFeatures: PublicAction<[features: HarnessFeatures], {
		features: HarnessFeatures;
	}>;
	getRun: PublicAction<[runId: string], SessionRun | undefined>;
	streamSnapshot: PublicAction<[runId: string, afterSeq?: number], {
		run: SessionRun | undefined;
		frames: FrameEvent[];
	}>;
};
type SensosSessionActor = ActorDefinition<unknown, {
	clientId: string;
	authToken?: string;
}, {
	clientId: string;
	userId?: string;
}, unknown, SessionInput, AnyDatabaseProvider, SensosSessionEvents, SensosSessionQueues, SensosSessionActions>;
type SensosRegistryActors = {
	session: SensosSessionActor;
};
type SensosRegistry = Registry<SensosRegistryActors>;
type SessionConnectionStatus = ChatStatus2;
export { SensosRegistry, SensosRegistryActors, SensosSessionActions, SensosSessionActor, SensosSessionEvents, SensosSessionQueues, SessionConnectionStatus };
