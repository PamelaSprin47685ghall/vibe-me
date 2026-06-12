import type { PluginInput } from '@opencode-ai/plugin';
import { TODO_NUDGE_PROMPT, LOOP_NUDGE_PROMPT, defaultCoordinator, TERMINAL_TODO_STATUSES, type NudgeInputContext } from 'engine/todo';
import { buildRunnerNudgePrompt, hasActiveJob } from 'engine/runner';
import type { ReviewStore } from 'engine/review';
import { asMessageArray } from '../utils/session-messages';
import { lookupChildAgent } from '../utils/child-agent';
import { managedRunnerSessions } from '../runner/index.js';
import { opencodeRunnerJobs } from '../runner/index.js';
import { isAbortEventError, isSessionBusyError, createPromptBody } from 'engine/util';
import type { NudgeShellState } from 'engine/nudge-shell';
import {
  hasStoppedSession,
  hasRetryPendingSession,
  hasNudgedSession,
  addNudgedSession,
  deleteNudgedSession,
  rememberAgent,
  getDeliveredCount,
  setDeliveredCount,
  getAgent,
  stopSession,
  addRetryPendingSession,
} from 'engine/nudge-shell';

export type SessionSnapshot = {
  todos: string[];
  lastAssistantMessage: string;
  messageCount: number | undefined;
  agentFromMessage: unknown;
};

export async function collectSessionSnapshot(
  ctx: PluginInput,
  sessionID: string,
): Promise<SessionSnapshot | null> {
  let todos: string[];
  try {
    const result = await ctx.client.session.todo({ path: { id: sessionID } });
    todos = (result.data ?? []).map((t: { status: string }) => t.status).filter(s => !TERMINAL_TODO_STATUSES.has(s));
  } catch {
    return null;
  }

  let lastAssistantMessage = '';
  let messageCount: number | undefined;
  let agentFromMessage: unknown;
  try {
    const msgResult = await ctx.client.session.messages({ path: { id: sessionID } });
    const messages = asMessageArray(msgResult.data);
    messageCount = messages.length;
    const lastAssistant = [...messages].reverse().find((m) => m.info?.role === 'assistant');
    if (lastAssistant) {
      agentFromMessage = (lastAssistant.info as { agent?: unknown }).agent;
      lastAssistantMessage = (lastAssistant.parts ?? [])
        .filter((p) => p.type === 'text' && p.text)
        .map((p) => p.text ?? '')
        .join('\n');
    }
  } catch { /* best-effort */ }

  return { todos, lastAssistantMessage, messageCount, agentFromMessage };
}

export function selectNudgePromptText(action: string, sessionID: string): string | null {
  if (action === 'nudge-todo') return TODO_NUDGE_PROMPT;
  if (action === 'nudge-loop') return LOOP_NUDGE_PROMPT;
  if (action === 'nudge-runner') {
    if (opencodeRunnerJobs.get(sessionID)?.record.status._tag !== 'Running') return null;
    if (managedRunnerSessions.has(sessionID)) return null;
    return buildRunnerNudgePrompt();
  }
  return null;
}

export async function nudgeIfNeeded(
  state: NudgeShellState,
  ctx: PluginInput,
  sessionID: string,
  reviewStore: ReviewStore,
): Promise<NudgeShellState> {
  if (hasStoppedSession(state, sessionID)) return state;
  if (hasRetryPendingSession(state, sessionID)) return state;
  if (hasNudgedSession(state, sessionID)) return state;

  state = addNudgedSession(state, sessionID);

  const snapshot = await collectSessionSnapshot(ctx, sessionID);
  if (!snapshot) return deleteNudgedSession(state, sessionID);
  state = rememberAgent(state, sessionID, snapshot.agentFromMessage);

  const { todos, lastAssistantMessage, messageCount } = snapshot;
  if (messageCount !== undefined && getDeliveredCount(state, sessionID) === messageCount) {
    return deleteNudgedSession(state, sessionID);
  }

  const context: NudgeInputContext = {
    todos,
    lastAssistantMessage,
    hasActiveRunner: hasActiveJob(opencodeRunnerJobs, sessionID),
    isLoopActive: reviewStore.isReviewActive(sessionID),
  };

  const action = defaultCoordinator.shouldNudge(sessionID, context, Date.now());
  if (action === 'none') return deleteNudgedSession(state, sessionID);

  const promptText = selectNudgePromptText(action, sessionID);
  if (!promptText) return deleteNudgedSession(state, sessionID);

  try {
    state = { ...state, lastNudgedSession: sessionID };
    const agent = getAgent(state, sessionID) ?? lookupChildAgent(sessionID);
    await ctx.client.session.prompt({
      path: { id: sessionID },
      body: createPromptBody(agent, promptText),
    });
    if (messageCount !== undefined) {
      state = setDeliveredCount(state, sessionID, messageCount);
    }
    return deleteNudgedSession(state, sessionID);
  } catch (error) {
    if (isAbortEventError(error)) {
      return stopSession(state, sessionID);
    } else if (isSessionBusyError(error)) {
      return deleteNudgedSession(state, sessionID);
    } else {
      state = addRetryPendingSession(state, sessionID);
      return deleteNudgedSession(state, sessionID);
    }
  }
}
