import type { PluginInput } from '@opencode-ai/plugin';
import { isAbortErrorName } from 'engine/util';
import { TODO_NUDGE_PROMPT, LOOP_NUDGE_PROMPT } from 'engine/todo';
import { buildRunnerNudgePrompt, hasActiveJob } from 'engine/runner';
import { type TodoItem, type SessionMessage, asMessageArray, asTodoArray } from '../utils/session';
import { cleanupJob, getActiveJobs } from 'engine/runner';
import { defaultCoordinator, type NudgeInputContext } from 'engine/todo';

export function createNudgeCoordinatorHook(ctx: PluginInput) {
  return {
    handleEvent: async (input: {
      event: { type: string; properties?: Record<string, unknown> };
    }): Promise<void> => {
      const { event } = input;
      const props = event.properties ?? {};
      const sessionID = props.sessionID as string | undefined;
      if (!sessionID) return;

      if (event.type === 'session.delete' || event.type === 'session.close' || event.type === 'session.remove') {
        cleanupJob(sessionID);
        defaultCoordinator.clearSession(sessionID);
        return;
      }

      if (event.type === 'session.idle') {
        const suppressor = defaultCoordinator.getOrCreateSuppressor(sessionID);
        if (suppressor.isSuppressed()) return;

        let todos: TodoItem[];
        try {
          const result = await ctx.client.session.todo({ path: { id: sessionID } });
          todos = asTodoArray(result.data);
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

        const entries = (props.entries as number) ?? 0;
        const context: NudgeInputContext = {
          todos,
          lastAssistantMessage,
          hasActiveRunner: hasActiveJob(getActiveJobs, sessionID),
          isLoopActive: props.isLoopActive === true,
        };

        const action = defaultCoordinator.shouldNudge(sessionID, context, entries);
        if (action === 'none') return;

        let promptText: string;
        if (action === 'nudge-todo') {
          promptText = 'There are still incomplete todos. Continue working through the remaining items. If stuck or blocked, explain the situation and ask for guidance. If you want to skip this check, respond with <skip-todo-check />';
        } else if (action === 'nudge-loop') {
          promptText = LOOP_NUDGE_PROMPT;
        } else if (action === 'nudge-runner') {
          promptText = buildRunnerNudgePrompt();
        } else { return; }

        try {
          await ctx.client.session.prompt({
            path: { id: sessionID },
            body: { parts: [{ type: 'text', text: promptText }] },
          });
        } catch { /* best-effort */ }
        return;
      }

      if (event.type === 'session.error') {
        const error = props.error as { name?: string } | undefined;
        if (isAbortErrorName(error?.name)) {
          defaultCoordinator.suppress(sessionID);
        }
      }
    },
  };
}
