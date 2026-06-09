import type { PluginInput } from '@opencode-ai/plugin';
import { REVERIE_NUDGE, defaultCoordinator } from 'engine/todo';
import { cleanupRegistry, globalJobRegistry } from 'engine/runner';
import { createNudgeState } from './state';
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
} from './pure';

export function createNudgeCoordinatorHook(ctx: PluginInput) {
  const state = createNudgeState();

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
      state.rememberAgent(input.sessionID, input.agent);
      state.resumeSession(input.sessionID);
    },

    handleCommandExecuteBefore: async (
      input: { command: string; sessionID: string; arguments: string },
      _output: { parts: Array<{ type: string; text?: string }> },
    ): Promise<void> => {
      state.resumeSession(input.sessionID);
    },

    handleEvent: async (input: {
      event: { type: string; properties?: Record<string, unknown> };
    }): Promise<void> => {
      const { event } = input;
      const props = event.properties ?? {};
      const sessionID = getSessionID(event.type, props);
      if (!sessionID) return;
      state.rememberAgent(sessionID, getEventAgent(props));
      const statusType = (props.status as { type?: string } | undefined)?.type;

      if (
        event.type === 'session.delete' ||
        event.type === 'session.close' ||
        event.type === 'session.remove' ||
        event.type === 'session.deleted'
      ) {
        cleanupRegistry(globalJobRegistry, sessionID);
        defaultCoordinator.clearSession(sessionID);
        state.clearSession(sessionID);
        return;
      }

      if (event.type === 'session.next.prompted') {
        const text = (props.prompt as { text?: unknown } | undefined)?.text;
        if (!isNudgePrompt(text)) state.resumeSession(sessionID);
        return;
      }

      if (
        event.type === 'session.next.retried' ||
        (event.type === 'session.status' && statusType === 'retry')
      ) {
        state.addRetryPendingSession(sessionID);
        return;
      }

      if (event.type === 'message.updated') {
        const info = props.info as { error?: unknown } | undefined;
        if (isAbortEventError(info?.error)) {
          state.stopSession(sessionID);
        } else if (isCompletedAssistantMessage(info)) {
          await nudgeIfNeeded(state, ctx, sessionID);
        }
        return;
      }

      if (event.type === 'message.part.updated') {
        const part = props.part as { type?: unknown; state?: unknown; error?: unknown } | undefined;
        if (part?.type === 'retry') {
          state.addRetryPendingSession(sessionID);
          return;
        }

        if (isAbortEventError(part?.error) || isAbortEventError(part?.state)) {
          state.stopSession(sessionID);
          return;
        }

        if (isRetryProgressPart(part?.type)) state.deleteRetryPendingSession(sessionID);
        return;
      }

      if (event.type === 'session.next.step.failed') {
        if (isAbortEventError(props.error)) state.stopSession(sessionID);
        return;
      }

      if (event.type === 'session.next.tool.failed') {
        if (isAbortEventError(props.error)) {
          state.stopSession(sessionID);
        } else {
          state.deleteRetryPendingSession(sessionID);
        }
        return;
      }

      if (event.type === 'session.next.step.ended') {
        state.deleteRetryPendingSession(sessionID);
        if (isTerminalAssistantFinish(props.finish)) await nudgeIfNeeded(state, ctx, sessionID);
        return;
      }

      if (isRetryProgressEvent(event.type)) {
        state.deleteRetryPendingSession(sessionID);
        return;
      }

      if (
        event.type === 'session.idle' ||
        (event.type === 'session.status' && statusType === 'idle')
      ) {
        await nudgeIfNeeded(state, ctx, sessionID);
        return;
      }

      if (
        event.type === 'session.status' &&
        statusType === 'busy'
      ) {
        if (sessionID !== state.lastNudgedSession) {
          state.deleteNudgedSession(sessionID);
        }
        state.lastNudgedSession = null;
        return;
      }

      if (event.type === 'session.error') {
        const error = props.error as { name?: string } | undefined;
        if (isAbortEventError(error)) {
          state.stopSession(sessionID);
        } else {
          state.addRetryPendingSession(sessionID);
        }
      }
    },
  };
}
