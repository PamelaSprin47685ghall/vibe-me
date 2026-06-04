import type { PluginInput } from '@opencode-ai/plugin';
import { isAbortErrorName } from 'engine/util';
import { TODO_NUDGE_PROMPT, LOOP_NUDGE_PROMPT, defaultCoordinator, type NudgeInputContext } from 'engine/todo';
import { buildRunnerNudgePrompt, hasActiveJob, cleanupJob, getActiveJobs } from 'engine/runner';
import { isReviewActive } from 'engine/review';
import { type TodoItem, asMessageArray } from '../utils/session';
import { managedRunnerSessions } from '../runner/index.js';

export function createNudgeCoordinatorHook(ctx: PluginInput) {
  const nudgedSessions = new Set<string>();
  let lastNudgedSession: string | null = null;
  const retryPendingSessions = new Set<string>();

  return {
    tool: {},

    handleToolExecuteAfter: async (
      _input: { tool: string; sessionID?: string; callID: string },
      _output: { output?: unknown; title?: string; metadata?: Record<string, unknown> },
    ): Promise<void> => {},

    handleMessagesTransform: async (
      _output: { messages: unknown[] },
    ): Promise<void> => {},

    handleChatMessage: (_input: { sessionID: string; agent?: string }): void => {},

    handleCommandExecuteBefore: async (
      _input: { command: string; sessionID: string; arguments: string },
      _output: { parts: Array<{ type: string; text?: string }> },
    ): Promise<void> => {},

    handleEvent: async (input: {
      event: { type: string; properties?: Record<string, unknown> };
    }): Promise<void> => {
      const { event } = input;
      const props = event.properties ?? {};
      const sessionID = props.sessionID as string | undefined;
      if (!sessionID) return;

      if (
        event.type === 'session.delete' ||
        event.type === 'session.close' ||
        event.type === 'session.remove' ||
        event.type === 'session.deleted'
      ) {
        cleanupJob(sessionID);
        defaultCoordinator.clearSession(sessionID);
        nudgedSessions.delete(sessionID);
        retryPendingSessions.delete(sessionID);
        return;
      }

      if (
        event.type === 'session.idle' ||
        (event.type === 'session.status' &&
          (props.status as { type?: string } | undefined)?.type === 'idle')
      ) {
        if (retryPendingSessions.has(sessionID)) return;
        if (nudgedSessions.has(sessionID)) return;
        nudgedSessions.add(sessionID);

        const suppressor = defaultCoordinator.getOrCreateSuppressor(sessionID);
        if (suppressor.isSuppressed()) return;

        let todos: TodoItem[];
        try {
          const result = await ctx.client.session.todo({ path: { id: sessionID } });
          todos = (result.data ?? []) as TodoItem[];
        } catch { return; }

        let lastAssistantMessage: string | undefined;
        try {
          const msgResult = await ctx.client.session.messages({ path: { id: sessionID } });
          const messages = asMessageArray(msgResult.data);
          const lastAssistant = [...messages].reverse().find((m) => m.info?.role === 'assistant');
          if (lastAssistant) {
            lastAssistantMessage = (lastAssistant.parts ?? [])
              .filter((p) => p.type === 'text' && p.text)
              .map((p) => p.text ?? '')
              .join('\n');
          }
        } catch { /* best-effort */ }

        const context: NudgeInputContext = {
          todos,
          lastAssistantMessage,
          hasActiveRunner: hasActiveJob(getActiveJobs, sessionID),
          isLoopActive: isReviewActive(sessionID),
        };

        const action = defaultCoordinator.shouldNudge(sessionID, context);
        if (action === 'none') {
          nudgedSessions.delete(sessionID);
          return;
        }

        let promptText: string;
        if (action === 'nudge-todo') {
          promptText = TODO_NUDGE_PROMPT;
        } else if (action === 'nudge-loop') {
          promptText = LOOP_NUDGE_PROMPT;
        } else if (action === 'nudge-runner') {
          // Only nudge the runner itself, not the orchestrator
          const jobs = getActiveJobs();
          const isSelfJob = jobs.get(sessionID)?.status === 'running';
          if (!isSelfJob) {
            nudgedSessions.delete(sessionID);
            return;
          }
          // Tool's internal loop already manages this session — skip
          if (managedRunnerSessions.has(sessionID)) {
            nudgedSessions.delete(sessionID);
            return;
          }
          promptText = buildRunnerNudgePrompt();
        } else { return; }

        try {
          lastNudgedSession = sessionID;
          await ctx.client.session.prompt({
            path: { id: sessionID },
            body: { parts: [{ type: 'text', text: promptText }] },
          });
          nudgedSessions.delete(sessionID);
        } catch {
          /* abort — stay in nudgedSessions, user pressed Esc */
        }
        return;
      }

      if (
        event.type === 'session.status' &&
        (props.status as { type?: string } | undefined)?.type === 'busy'
      ) {
        // Only clear if busy wasn't caused by our own nudge prompt
        if (sessionID !== lastNudgedSession) {
          nudgedSessions.delete(sessionID);
        }
        retryPendingSessions.delete(sessionID);
        lastNudgedSession = null;
        return;
      }

      if (event.type === 'session.error') {
        const error = props.error as { name?: string } | undefined;
        if (isAbortErrorName(error?.name)) {
          defaultCoordinator.suppress(sessionID);
          retryPendingSessions.delete(sessionID);
        } else {
          retryPendingSessions.add(sessionID);
        }
      }
    },
  };
}
