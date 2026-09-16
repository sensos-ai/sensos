import type { AnyDatabaseProvider } from 'rivetkit/db'
import type { ActorDefinition, Registry } from 'rivetkit'
import type {
  DeliveryRoutedEvent,
  FrameEvent,
  InboxMessage,
  RunCommand,
  RunCompletion,
  SessionInput,
  SessionRun,
  SessionSnapshot,
  StatusChangedEvent,
} from './session'
import type { HarnessFeatures, ModelRef } from './models'
import type { ChatStatus, UIMessage } from 'ai'

type PublicAction<Args extends unknown[], Output> = (
  context: any,
  ...args: Args
) => Output | Promise<Output>

export type SensosSessionEvents = {
  frame: { readonly __type?: FrameEvent }
  statusChanged: { readonly __type?: StatusChangedEvent }
  messagesChanged: {
    readonly __type?: { messages: UIMessage[]; revision: number }
  }
  titleChanged: { readonly __type?: { title: string } }
  deliveryRouted: { readonly __type?: DeliveryRoutedEvent }
}

export type SensosSessionQueues = {
  runs: {
    readonly __message?: RunCommand
    readonly __complete?: RunCompletion
  }
  inbox: { readonly __message?: InboxMessage }
}

export type SensosSessionActions = {
  cancel: PublicAction<
    [runId: string],
    { cancelled: boolean; runId: string }
  >
  deliver: PublicAction<[message: InboxMessage], DeliveryRoutedEvent>
  deleteSession: PublicAction<[], void>
  getSession: PublicAction<[], SessionSnapshot>
  setModel: PublicAction<[model: ModelRef], { model: ModelRef }>
  setFeatures: PublicAction<
    [features: HarnessFeatures],
    { features: HarnessFeatures }
  >
  getRun: PublicAction<[runId: string], SessionRun | undefined>
  streamSnapshot: PublicAction<
    [runId: string, afterSeq?: number],
    { run: SessionRun | undefined; frames: FrameEvent[] }
  >
}

export type SensosSessionActor = ActorDefinition<
  unknown,
  { clientId: string; authToken?: string },
  { clientId: string; userId?: string },
  unknown,
  SessionInput,
  AnyDatabaseProvider,
  any,
  any,
  SensosSessionActions
>

export type SensosRegistryActors = { session: SensosSessionActor }
export type SensosRegistry = Registry<SensosRegistryActors>

export type SessionConnectionStatus = ChatStatus
