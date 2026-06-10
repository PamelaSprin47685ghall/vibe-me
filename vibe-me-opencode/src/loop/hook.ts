import type { PluginInput } from '@opencode-ai/plugin';
import {
  deactivateReview,
  isReviewActive,
  LOOP_NUDGE_PROMPT,
} from 'engine/review';
import {
  createPromptBody,
  getEventAgent,
  isAbortEventError,
} from 'engine/util';
import { lookupChildAgent } from '../utils/child-agent';
import { asMessageArray, asTodoArray } from '../utils/session';

export function createLoopNudgeHook(ctx: PluginInput) {
  const stoppedSessions = new Set<string>();
  const sessionAgents = new Map<string, string>();

  function rememberAgent(sessionID: string, agent: unknown): void {
    if (typeof agent === 'string' && agent) sessionAgents.set(sessionID, agent);
  }

  return {
    handleEvent: async (input: {
      event: { type: string; properties?: Record<string, unknown> };
    }): Promise<void> => {
      const { event } = input;
      const props = event.properties ?? {};
      const sessionID = props.sessionID as string | undefined;
      if (!sessionID) return;
      rememberAgent(sessionID, getEventAgent(props));

      if (event.type === 'session.next.prompted') {
        const text = (props.prompt as { text?: unknown } | undefined)?.text;
        if (text !== LOOP_NUDGE_PROMPT) stoppedSessions.delete(sessionID);
        return;
      }

      if (event.type === 'session.next.step.failed') {
        if (isAbortEventError(props.error)) stoppedSessions.add(sessionID);
        return;
      }

      if (event.type === 'session.next.tool.failed') {
        if (isAbortEventError(props.error)) stoppedSessions.add(sessionID);
        return;
      }

      if (event.type === 'session.idle') {
        if (stoppedSessions.has(sessionID)) return;
        if (!isReviewActive(sessionID)) return;

        let todos: Array<{
          id: string;
          content: string;
          status: string;
          priority: string;
        }>;
        try {
          const result = await ctx.client.session.todo({
            path: { id: sessionID },
          });
          todos = asTodoArray(result.data);
        } catch {
          return;
        }

        const open = todos.filter(
          (t) => !['completed', 'cancelled'].includes(t.status),
        );
        if (open.length > 0) return;

        // If the last assistant message contains <skip-loop-check />, suppress the nudge
        try {
          const msgResult = await ctx.client.session.messages({
            path: { id: sessionID },
          });
          const messages = asMessageArray(msgResult.data);
          const lastAssistant = [...messages]
            .reverse()
            .find((m) => m.info?.role === 'assistant');
          if (lastAssistant) {
            rememberAgent(
              sessionID,
              (lastAssistant.info as { agent?: unknown }).agent,
            );
            const fullText = (lastAssistant.parts ?? [])
              .filter((p) => p.type === 'text' && p.text)
              .map((p) => p.text ?? '')
              .join('\n');
            if (fullText.includes('<skip-loop-check />')) return;
          }
        } catch (error) {
          if (isAbortEventError(error)) stoppedSessions.add(sessionID);
        }

        try {
          const agent = sessionAgents.get(sessionID) ?? lookupChildAgent(sessionID);
          await ctx.client.session.prompt({
            path: { id: sessionID },
            body: createPromptBody(agent, LOOP_NUDGE_PROMPT),
          });
        } catch {
          // best-effort
        }
        return;
      }

      if (event.type === 'session.error') {
        if (isAbortEventError(props.error)) stoppedSessions.add(sessionID);
      }

      if (
        event.type === 'session.delete' ||
        event.type === 'session.close' ||
        event.type === 'session.remove'
      ) {
        stoppedSessions.delete(sessionID);
        sessionAgents.delete(sessionID);
        deactivateReview(sessionID);
      }
    },
  };
}
