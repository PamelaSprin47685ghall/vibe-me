import type { PluginInput } from '@opencode-ai/plugin';
import { REVERIE_NUDGE, defaultCoordinator } from 'engine/todo';
import { cleanupRegistry, globalJobRegistry } from 'engine/runner';
import { emptyNudgeShellState, resumeSession, rememberAgent, stopSession, clearSession, addRetryPendingSession, deleteRetryPendingSession, deleteNudgedSession } from './state';
import type { NudgeShellState } from './state';
import { nudgeIfNeeded } from './timing';
import {
  getEventAgent,
  isAbortEventError,
  isNudgePrompt,
  getSessionID,
  getPartsText,
  isRetryProgressEvent,
  isRetryProgressPart,
  isCompletedAssistantMessage,
  isTerminalAssistantFinish,
} from 'engine/util';

export function createNudgeCoordinatorHook(ctx: PluginInput) {
  let state: NudgeShellState = emptyNudgeShellState;

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

      if (
        event.type === 'session.delete' ||
        event.type === 'session.close' ||
        event.type === 'session.remove' ||
        event.type === 'session.deleted'
      ) {
        cleanupRegistry(globalJobRegistry, sessionID);
        defaultCoordinator.clearSession(sessionID);
        state = clearSession(state, sessionID);
        return;
      }

      if (event.type === 'session.next.prompted') {
        const text = (props.prompt as { text?: unknown } | undefined)?.text;
        if (!isNudgePrompt(text)) state = resumeSession(state, sessionID);
        return;
      }

      if (
        event.type === 'session.next.retried' ||
        (event.type === 'session.status' && statusType === 'retry')
      ) {
        state = addRetryPendingSession(state, sessionID);
        return;
      }

      if (event.type === 'message.updated') {
        const info = props.info as { error?: unknown } | undefined;
        if (isAbortEventError(info?.error)) {
          state = stopSession(state, sessionID);
        } else if (isCompletedAssistantMessage(info)) {
          state = await nudgeIfNeeded(state, ctx, sessionID);
        }
        return;
      }

      if (event.type === 'message.part.updated') {
        const part = props.part as { type?: unknown; state?: unknown; error?: unknown } | undefined;
        if (part?.type === 'retry') {
          state = addRetryPendingSession(state, sessionID);
          return;
        }

        if (isAbortEventError(part?.error) || isAbortEventError(part?.state)) {
          state = stopSession(state, sessionID);
          return;
        }

        if (isRetryProgressPart(part?.type)) state = deleteRetryPendingSession(state, sessionID);
        return;
      }

      if (event.type === 'session.next.step.failed') {
        if (isAbortEventError(props.error)) state = stopSession(state, sessionID);
        return;
      }

      if (event.type === 'session.next.tool.failed') {
        if (isAbortEventError(props.error)) {
          state = stopSession(state, sessionID);
        } else {
          state = deleteRetryPendingSession(state, sessionID);
        }
        return;
      }

      if (event.type === 'session.next.step.ended') {
        state = deleteRetryPendingSession(state, sessionID);
        if (isTerminalAssistantFinish(props.finish)) state = await nudgeIfNeeded(state, ctx, sessionID);
        return;
      }

      if (isRetryProgressEvent(event.type)) {
        state = deleteRetryPendingSession(state, sessionID);
        return;
      }

      if (
        event.type === 'session.idle' ||
        (event.type === 'session.status' && statusType === 'idle')
      ) {
        state = await nudgeIfNeeded(state, ctx, sessionID);
        return;
      }

      if (
        event.type === 'session.status' &&
        statusType === 'busy'
      ) {
        if (sessionID !== state.lastNudgedSession) {
          state = deleteNudgedSession(state, sessionID);
        }
        state = { ...state, lastNudgedSession: null };
        return;
      }

      if (event.type === 'session.error') {
        const error = props.error as { name?: string } | undefined;
        if (isAbortEventError(error)) {
          state = stopSession(state, sessionID);
        } else {
          state = addRetryPendingSession(state, sessionID);
        }
      }
    },
  };
}
