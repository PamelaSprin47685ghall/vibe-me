import type { PluginInput } from '@opencode-ai/plugin';
import { REVERIE_NUDGE } from 'engine/todo';
import { emptyNudgeShellState, resumeSession, rememberAgent } from './state';
import type { NudgeShellState } from './state';
import { getPartsText, isNudgePrompt, getSessionID, getEventAgent } from 'engine/util';
import { createEventHandlers, matchCompositeHandler } from './event-handlers';

export function createNudgeCoordinatorHook(ctx: PluginInput) {
  let state: NudgeShellState = emptyNudgeShellState;
  const handlers = createEventHandlers(ctx);

  return {
    tool: {},

    handleToolExecuteAfter: async (
      input: { tool: string; sessionID?: string; callID: string },
      output: { output?: unknown; title?: string; metadata?: Record<string, unknown> },
    ): Promise<void> => {
      if (input.tool !== 'todowrite' || typeof output.output !== 'string') return;
      output.output += REVERIE_NUDGE;
    },

    handleMessagesTransform: async (
      _output: { messages: unknown[] },
    ): Promise<void> => {},

    handleChatMessage: (input: {
      sessionID: string;
      agent?: string;
      parts?: unknown[];
    }): void => {
      const text = getPartsText(input.parts);
      if (isNudgePrompt(text)) return;
      state = rememberAgent(state, input.sessionID, input.agent);
      state = resumeSession(state, input.sessionID);
    },

    handleCommandExecuteBefore: async (
      input: { command: string; sessionID: string; arguments: string },
      _output: { parts: Array<{ type: string; text?: string }> },
    ): Promise<void> => {
      state = resumeSession(state, input.sessionID);
    },

    handleEvent: async (input: {
      event: { type: string; properties?: Record<string, unknown> };
    }): Promise<void> => {
      const { event } = input;
      const props = event.properties ?? {};
      const sessionID = getSessionID(event.type, props);
      if (!sessionID) return;
      state = rememberAgent(state, sessionID, getEventAgent(props));
      const statusType = (props.status as { type?: string } | undefined)?.type;
      const handler = handlers[event.type] ?? matchCompositeHandler(event.type, statusType);
      if (handler) state = await handler(state, props, sessionID, ctx);
    },
  };
}