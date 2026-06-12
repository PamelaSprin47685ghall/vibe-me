import type { PluginInput } from '@opencode-ai/plugin';
import { TODO_NUDGE_PROMPT, LOOP_NUDGE_PROMPT, defaultCoordinator, TERMINAL_TODO_STATUSES, type NudgeInputContext } from 'engine/todo';
import { buildRunnerNudgePrompt, hasActiveJob, globalJobRegistry } from 'engine/runner';
import { isReviewActive } from 'engine/review';
import { asMessageArray } from '../utils/session-messages';
import { lookupChildAgent } from '../utils/child-agent';
import { managedRunnerSessions } from '../runner/index.js';
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

export async function nudgeIfNeeded(
  state: NudgeShellState,
  ctx: PluginInput,
  sessionID: string,
): Promise<NudgeShellState> {
  if (hasStoppedSession(state, sessionID)) return state;
  if (hasRetryPendingSession(state, sessionID)) return state;
  if (hasNudgedSession(state, sessionID)) return state;

  state = addNudgedSession(state, sessionID);

  let todos: string[];
  try {
    const result = await ctx.client.session.todo({ path: { id: sessionID } });
    todos = (result.data ?? []).map((t: { status: string }) => t.status).filter(s => !TERMINAL_TODO_STATUSES.has(s));
  } catch {
    return deleteNudgedSession(state, sessionID);
  }

  let lastAssistantMessage: string | undefined;
  let messageCount: number | undefined;
  try {
    const msgResult = await ctx.client.session.messages({ path: { id: sessionID } });
    const messages = asMessageArray(msgResult.data);
    messageCount = messages.length;
    const lastAssistant = [...messages].reverse().find((m) => m.info?.role === 'assistant');
    if (lastAssistant) {
      state = rememberAgent(state, sessionID, (lastAssistant.info as { agent?: unknown }).agent);
      lastAssistantMessage = (lastAssistant.parts ?? [])
        .filter((p) => p.type === 'text' && p.text)
        .map((p) => p.text ?? '')
        .join('\n');
    }
  } catch { /* best-effort */ }

  if (
    messageCount !== undefined &&
    getDeliveredCount(state, sessionID) === messageCount
  ) {
    return deleteNudgedSession(state, sessionID);
  }

  const context: NudgeInputContext = {
    todos,
    lastAssistantMessage: lastAssistantMessage ?? '',
    hasActiveRunner: hasActiveJob(sessionID),
    isLoopActive: isReviewActive(sessionID),
  };

  const action = defaultCoordinator.shouldNudge(sessionID, context);
  if (action === 'none') {
    return deleteNudgedSession(state, sessionID);
  }

  let promptText: string;
  if (action === 'nudge-todo') {
    promptText = TODO_NUDGE_PROMPT;
  } else if (action === 'nudge-loop') {
    promptText = LOOP_NUDGE_PROMPT;
  } else if (action === 'nudge-runner') {
    const jobs = globalJobRegistry;
    const isSelfJob = jobs.get(sessionID)?.record.status._tag === 'Running';
    if (!isSelfJob) {
      return deleteNudgedSession(state, sessionID);
    }
    if (managedRunnerSessions.has(sessionID)) {
      return deleteNudgedSession(state, sessionID);
    }
    promptText = buildRunnerNudgePrompt();
  } else { return state; }

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
