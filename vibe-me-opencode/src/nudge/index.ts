import type { PluginInput } from '@opencode-ai/plugin';
import { isAbortErrorName } from 'engine/util';
import { TODO_NUDGE_PROMPT, LOOP_NUDGE_PROMPT, REVERIE_NUDGE, defaultCoordinator, type NudgeInputContext } from 'engine/todo';
import { buildRunnerNudgePrompt, hasActiveJob, cleanupRegistry, globalJobRegistry } from 'engine/runner';
import { isReviewActive } from 'engine/review';
import { asMessageArray } from '../utils/session';
import { lookupChildAgent } from '../utils/child-agent';
import { managedRunnerSessions } from '../runner/index.js';

const RETRY_PROGRESS_EVENTS = new Set([
  'session.next.step.started',
  'session.next.step.ended',
  'session.next.text.started',
  'session.next.text.delta',
  'session.next.text.ended',
  'session.next.reasoning.started',
  'session.next.reasoning.delta',
  'session.next.reasoning.ended',
  'session.next.tool.input.started',
  'session.next.tool.input.delta',
  'session.next.tool.input.ended',
  'session.next.tool.called',
  'session.next.tool.progress',
  'session.next.tool.success',
]);

const RETRY_PROGRESS_PARTS = new Set([
  'step-start',
  'step-finish',
  'text',
  'reasoning',
  'tool',
  'agent',
  'subtask',
  'file',
  'snapshot',
  'patch',
]);

export function createNudgeCoordinatorHook(ctx: PluginInput) {
  const nudgedSessions = new Set<string>();
  let lastNudgedSession: string | null = null;
  const retryPendingSessions = new Set<string>();
  const stoppedSessions = new Set<string>();
  const sessionAgents = new Map<string, string>();
  const deliveredNudgeMessageCounts = new Map<string, number>();

  function resumeSession(sessionID: string): void {
    nudgedSessions.delete(sessionID);
    retryPendingSessions.delete(sessionID);
    stoppedSessions.delete(sessionID);
    deliveredNudgeMessageCounts.delete(sessionID);
    if (lastNudgedSession === sessionID) lastNudgedSession = null;
  }

  function rememberAgent(sessionID: string, agent: unknown): void {
    if (typeof agent === 'string' && agent) sessionAgents.set(sessionID, agent);
  }

  function getEventAgent(props: Record<string, unknown>): string | undefined {
    if (typeof props.agent === 'string') return props.agent;

    const info = props.info as { agent?: unknown } | undefined;
    if (typeof info?.agent === 'string') return info.agent;
  }

  function createPromptBody(sessionID: string, text: string) {
    const agent = sessionAgents.get(sessionID) ?? lookupChildAgent(sessionID);
    const parts = [{ type: 'text' as const, text }];
    return agent ? { agent, parts } : { parts };
  }

  function stopSession(sessionID: string): void {
    nudgedSessions.add(sessionID);
    retryPendingSessions.delete(sessionID);
    stoppedSessions.add(sessionID);
    if (lastNudgedSession === sessionID) lastNudgedSession = null;
  }

  function isAbortEventError(error: unknown): boolean {
    if (typeof error === 'string') return /\babort(?:ed)?\b/i.test(error);
    if (!error || typeof error !== 'object') return false;

    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string' && isAbortErrorName(name)) return true;

    const nestedError = (error as { error?: unknown }).error;
    if (nestedError && nestedError !== error && isAbortEventError(nestedError)) return true;

    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object') {
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string' && /\babort(?:ed)?\b/i.test(message)) return true;
    }

    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' && /\babort(?:ed)?\b/i.test(message);
  }

  function isSessionBusyError(error: unknown): boolean {
    return (
      !!error &&
      typeof error === 'object' &&
      (error as { _tag?: unknown })._tag === 'SessionBusyError'
    );
  }

  function isNudgePrompt(text: unknown): boolean {
    return (
      text === TODO_NUDGE_PROMPT ||
      text === LOOP_NUDGE_PROMPT ||
      text === buildRunnerNudgePrompt()
    );
  }

  function getSessionID(type: string, props: Record<string, unknown>): string | undefined {
    if (typeof props.sessionID === 'string') return props.sessionID;

    const part = props.part as { sessionID?: unknown } | undefined;
    if (typeof part?.sessionID === 'string') return part.sessionID;

    const info = props.info as { id?: unknown; sessionID?: unknown } | undefined;
    if (typeof info?.sessionID === 'string') return info.sessionID;
    if (
      ['session.created', 'session.updated', 'session.deleted'].includes(type) &&
      typeof info?.id === 'string'
    ) return info.id;
  }

  function getPartsText(parts: unknown): string | undefined {
    if (!Array.isArray(parts)) return;

    const text = parts
      .filter((part): part is { type: string; text: string } => {
        return (
          typeof part === 'object' &&
          part !== null &&
          (part as { type?: unknown }).type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string'
        );
      })
      .map((part) => part.text)
      .join('\n');

    return text || undefined;
  }

  function isRetryProgressEvent(type: string): boolean {
    return RETRY_PROGRESS_EVENTS.has(type);
  }

  function isRetryProgressPart(type: unknown): boolean {
    return RETRY_PROGRESS_PARTS.has(String(type));
  }

  function isTerminalAssistantFinish(finish: unknown): boolean {
    if (typeof finish !== 'string') return false;
    const normalized = finish.toLowerCase().replace(/[-_\s]/g, '');
    return !normalized.includes('tool') && !normalized.includes('abort');
  }

  function isCompletedAssistantMessage(info: unknown): boolean {
    if (!info || typeof info !== 'object') return false;
    const message = info as {
      type?: unknown;
      role?: unknown;
      time?: { completed?: unknown };
      finish?: unknown;
      error?: unknown;
    };
    if (message.type !== 'assistant' && message.role !== 'assistant') return false;
    if (message.error) return false;
    if (typeof message.finish === 'string') return isTerminalAssistantFinish(message.finish);
    return typeof message.time?.completed === 'number';
  }

  async function nudgeIfNeeded(sessionID: string): Promise<void> {
    if (stoppedSessions.has(sessionID)) return;
    if (retryPendingSessions.has(sessionID)) return;
    if (nudgedSessions.has(sessionID)) return;

    nudgedSessions.add(sessionID);

    let todos: string[];
    try {
      const result = await ctx.client.session.todo({ path: { id: sessionID } });
      todos = (result.data ?? []).map((t: { status: string }) => t.status);
    } catch {
      nudgedSessions.delete(sessionID);
      return;
    }

    let lastAssistantMessage: string | undefined;
    let messageCount: number | undefined;
    try {
      const msgResult = await ctx.client.session.messages({ path: { id: sessionID } });
      const messages = asMessageArray(msgResult.data);
      messageCount = messages.length;
      const lastAssistant = [...messages].reverse().find((m) => m.info?.role === 'assistant');
      if (lastAssistant) {
        rememberAgent(sessionID, (lastAssistant.info as { agent?: unknown }).agent);
        lastAssistantMessage = (lastAssistant.parts ?? [])
          .filter((p) => p.type === 'text' && p.text)
          .map((p) => p.text ?? '')
          .join('\n');
      }
    } catch { /* best-effort */ }

    if (
      messageCount !== undefined &&
      deliveredNudgeMessageCounts.get(sessionID) === messageCount
    ) {
      nudgedSessions.delete(sessionID);
      return;
    }

    const context: NudgeInputContext = {
      todos,
      lastAssistantMessage: lastAssistantMessage ?? '',
      hasActiveRunner: hasActiveJob(sessionID),
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
      const jobs = globalJobRegistry;
      const isSelfJob = jobs.get(sessionID)?.status === 'running';
      if (!isSelfJob) {
        nudgedSessions.delete(sessionID);
        return;
      }
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
        body: createPromptBody(sessionID, promptText),
      });
      if (messageCount !== undefined) {
        deliveredNudgeMessageCounts.set(sessionID, messageCount);
      }
      nudgedSessions.delete(sessionID);
    } catch (error) {
      if (isAbortEventError(error)) {
        stopSession(sessionID);
      } else if (isSessionBusyError(error)) {
        nudgedSessions.delete(sessionID);
      } else {
        retryPendingSessions.add(sessionID);
        nudgedSessions.delete(sessionID);
      }
    }
  }

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
      rememberAgent(input.sessionID, input.agent);
      resumeSession(input.sessionID);
    },

    handleCommandExecuteBefore: async (
      input: { command: string; sessionID: string; arguments: string },
      _output: { parts: Array<{ type: string; text?: string }> },
    ): Promise<void> => {
      resumeSession(input.sessionID);
    },

    handleEvent: async (input: {
      event: { type: string; properties?: Record<string, unknown> };
    }): Promise<void> => {
      const { event } = input;
      const props = event.properties ?? {};
      const sessionID = getSessionID(event.type, props);
      if (!sessionID) return;
      rememberAgent(sessionID, getEventAgent(props));
      const statusType = (props.status as { type?: string } | undefined)?.type;

      if (
        event.type === 'session.delete' ||
        event.type === 'session.close' ||
        event.type === 'session.remove' ||
        event.type === 'session.deleted'
      ) {
        cleanupRegistry(globalJobRegistry, sessionID);
        defaultCoordinator.clearSession(sessionID);
        resumeSession(sessionID);
        sessionAgents.delete(sessionID);
        deliveredNudgeMessageCounts.delete(sessionID);
        return;
      }

      if (event.type === 'session.next.prompted') {
        const text = (props.prompt as { text?: unknown } | undefined)?.text;
        if (!isNudgePrompt(text)) resumeSession(sessionID);
        return;
      }

      if (
        event.type === 'session.next.retried' ||
        (event.type === 'session.status' && statusType === 'retry')
      ) {
        retryPendingSessions.add(sessionID);
        return;
      }

      if (event.type === 'message.updated') {
        const info = props.info as { error?: unknown } | undefined;
        if (isAbortEventError(info?.error)) {
          stopSession(sessionID);
        } else if (isCompletedAssistantMessage(info)) {
          await nudgeIfNeeded(sessionID);
        }
        return;
      }

      if (event.type === 'message.part.updated') {
        const part = props.part as { type?: unknown; state?: unknown; error?: unknown } | undefined;
        if (part?.type === 'retry') {
          retryPendingSessions.add(sessionID);
          return;
        }

        if (isAbortEventError(part?.error) || isAbortEventError(part?.state)) {
          stopSession(sessionID);
          return;
        }

        if (isRetryProgressPart(part?.type)) retryPendingSessions.delete(sessionID);
        return;
      }

      if (event.type === 'session.next.step.failed') {
        if (isAbortEventError(props.error)) stopSession(sessionID);
        return;
      }

      if (event.type === 'session.next.tool.failed') {
        if (isAbortEventError(props.error)) {
          stopSession(sessionID);
        } else {
          retryPendingSessions.delete(sessionID);
        }
        return;
      }

      if (event.type === 'session.next.step.ended') {
        retryPendingSessions.delete(sessionID);
        if (isTerminalAssistantFinish(props.finish)) await nudgeIfNeeded(sessionID);
        return;
      }

      if (isRetryProgressEvent(event.type)) {
        retryPendingSessions.delete(sessionID);
        return;
      }

      if (
        event.type === 'session.idle' ||
        (event.type === 'session.status' && statusType === 'idle')
      ) {
        await nudgeIfNeeded(sessionID);
        return;
      }

      if (
        event.type === 'session.status' &&
        statusType === 'busy'
      ) {
        if (sessionID !== lastNudgedSession) {
          nudgedSessions.delete(sessionID);
        }
        lastNudgedSession = null;
        return;
      }

      if (event.type === 'session.error') {
        const error = props.error as { name?: string } | undefined;
        if (isAbortEventError(error)) {
          stopSession(sessionID);
        } else {
          retryPendingSessions.add(sessionID);
        }
      }
    },
  };
}
