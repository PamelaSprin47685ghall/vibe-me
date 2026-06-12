import type { PluginInput } from '@opencode-ai/plugin';
import type { NudgeShellState } from 'engine/nudge-shell';
import {
  emptyNudgeShellState,
  rememberAgent,
  resumeSession,
} from 'engine/nudge-shell';
import type { ReviewStore } from 'engine/review';
import { REVERIE_NUDGE } from 'engine/todo';
import {
  getEventAgent,
  getPartsText,
  getSessionID,
  isNudgePrompt,
} from 'engine/util';
import { createEventHandlers, matchCompositeHandler } from './event-handlers';

type ToolExecuteAfterInput = {
  tool: string;
  sessionID?: string;
  callID: string;
};
type ToolExecuteAfterOutput = {
  output?: unknown;
  title?: string;
  metadata?: Record<string, unknown>;
};

type ChatMessageInput = {
  sessionID: string;
  agent?: string;
  parts?: unknown[];
};

type CommandExecuteBeforeInput = {
  command: string;
  sessionID: string;
  arguments: string;
};

type EventInput = {
  event: { type: string; properties?: Record<string, unknown> };
};

type Deps = {
  createEventHandlers: typeof createEventHandlers;
  getPartsText: typeof getPartsText;
  isNudgePrompt: typeof isNudgePrompt;
  getSessionID: typeof getSessionID;
  getEventAgent: typeof getEventAgent;
  rememberAgent: typeof rememberAgent;
  resumeSession: typeof resumeSession;
  REVERIE_NUDGE: string;
};

const defaultDeps: Deps = {
  createEventHandlers,
  getPartsText,
  isNudgePrompt,
  getSessionID,
  getEventAgent,
  rememberAgent,
  resumeSession,
  REVERIE_NUDGE,
};

function handleToolExecuteAfter(
  input: ToolExecuteAfterInput,
  output: ToolExecuteAfterOutput,
  deps: Pick<Deps, 'REVERIE_NUDGE'>,
): void {
  if (input.tool !== 'todowrite' || typeof output.output !== 'string') return;
  output.output += deps.REVERIE_NUDGE;
}

function handleMessagesTransform(_output: { messages: unknown[] }): void {}

function handleChatMessage(
  input: ChatMessageInput,
  state: NudgeShellState,
  deps: Pick<
    Deps,
    'getPartsText' | 'isNudgePrompt' | 'rememberAgent' | 'resumeSession'
  >,
): NudgeShellState {
  const text = deps.getPartsText(input.parts);
  if (deps.isNudgePrompt(text)) return state;
  state = deps.rememberAgent(state, input.sessionID, input.agent);
  return deps.resumeSession(state, input.sessionID);
}

function handleCommandExecuteBefore(
  input: CommandExecuteBeforeInput,
  state: NudgeShellState,
  deps: Pick<Deps, 'resumeSession'>,
): NudgeShellState {
  return deps.resumeSession(state, input.sessionID);
}

async function handleEvent(
  input: EventInput,
  state: NudgeShellState,
  deps: Pick<
    Deps,
    'getSessionID' | 'getEventAgent' | 'rememberAgent' | 'createEventHandlers'
  >,
  ctx: PluginInput,
  reviewStore: ReviewStore,
): Promise<NudgeShellState> {
  const { event } = input;
  const props = event.properties ?? {};
  const sessionID = deps.getSessionID(event.type, props);
  if (!sessionID) return state;
  state = deps.rememberAgent(state, sessionID, deps.getEventAgent(props));
  const handlers = deps.createEventHandlers(ctx, reviewStore);
  const statusType = (props.status as { type?: string } | undefined)?.type;
  const handler =
    handlers[event.type] ?? matchCompositeHandler(event.type, statusType);
  if (handler) state = await handler(state, props, sessionID, ctx, reviewStore);
  return state;
}

export function createNudgeCoordinatorHook(
  ctx: PluginInput,
  reviewStore: ReviewStore,
  partialDeps: Partial<Deps> = {},
) {
  const deps = { ...defaultDeps, ...partialDeps };
  let state: NudgeShellState = emptyNudgeShellState;
  let pending = Promise.resolve();

  return {
    tool: {},

    handleToolExecuteAfter: async (
      input: ToolExecuteAfterInput,
      output: ToolExecuteAfterOutput,
    ): Promise<void> => {
      handleToolExecuteAfter(input, output, deps);
    },

    handleMessagesTransform: async (_output: {
      messages: unknown[];
    }): Promise<void> => {
      handleMessagesTransform(_output);
    },

    handleChatMessage: (input: ChatMessageInput): void => {
      state = handleChatMessage(input, state, deps);
    },

    handleCommandExecuteBefore: async (
      input: CommandExecuteBeforeInput,
      _output: { parts: Array<{ type: string; text?: string }> },
    ): Promise<void> => {
      state = handleCommandExecuteBefore(input, state, deps);
    },

    handleEvent: async (input: EventInput): Promise<void> => {
      const run = async (): Promise<void> => {
        state = await handleEvent(input, state, deps, ctx, reviewStore);
      };
      pending = pending.then(run, run);
      await pending;
    },
  };
}
