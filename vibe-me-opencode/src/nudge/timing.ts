import type { PluginInput } from '@opencode-ai/plugin';
import { TODO_NUDGE_PROMPT, LOOP_NUDGE_PROMPT, defaultCoordinator, TERMINAL_TODO_STATUSES, type NudgeInputContext } from 'engine/todo';
import { buildRunnerNudgePrompt, hasActiveJob, globalJobRegistry } from 'engine/runner';
import { isReviewActive } from 'engine/review';
import { asMessageArray } from '../utils/session-messages';
import { lookupChildAgent } from '../utils/child-agent';
import { managedRunnerSessions } from '../runner/index.js';
import { isAbortEventError, isSessionBusyError, createPromptBody } from './pure';
import type { NudgeState } from './state';

export async function nudgeIfNeeded(
  state: NudgeState,
  ctx: PluginInput,
  sessionID: string,
): Promise<void> {
  if (state.hasStoppedSession(sessionID)) return;
  if (state.hasRetryPendingSession(sessionID)) return;
  if (state.hasNudgedSession(sessionID)) return;

  state.addNudgedSession(sessionID);

  let todos: string[];
  try {
    const result = await ctx.client.session.todo({ path: { id: sessionID } });
    todos = (result.data ?? []).map((t: { status: string }) => t.status).filter(s => !TERMINAL_TODO_STATUSES.has(s));
  } catch {
    state.deleteNudgedSession(sessionID);
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
      state.rememberAgent(sessionID, (lastAssistant.info as { agent?: unknown }).agent);
      lastAssistantMessage = (lastAssistant.parts ?? [])
        .filter((p) => p.type === 'text' && p.text)
        .map((p) => p.text ?? '')
        .join('\n');
    }
  } catch { /* best-effort */ }

  if (
    messageCount !== undefined &&
    state.getDeliveredCount(sessionID) === messageCount
  ) {
    state.deleteNudgedSession(sessionID);
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
    state.deleteNudgedSession(sessionID);
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
      state.deleteNudgedSession(sessionID);
      return;
    }
    if (managedRunnerSessions.has(sessionID)) {
      state.deleteNudgedSession(sessionID);
      return;
    }
    promptText = buildRunnerNudgePrompt();
  } else { return; }

  try {
    state.lastNudgedSession = sessionID;
    const agent = state.getAgent(sessionID) ?? lookupChildAgent(sessionID);
    await ctx.client.session.prompt({
      path: { id: sessionID },
      body: createPromptBody(agent, promptText),
    });
    if (messageCount !== undefined) {
      state.setDeliveredCount(sessionID, messageCount);
    }
    state.deleteNudgedSession(sessionID);
  } catch (error) {
    if (isAbortEventError(error)) {
      state.stopSession(sessionID);
    } else if (isSessionBusyError(error)) {
      state.deleteNudgedSession(sessionID);
    } else {
      state.addRetryPendingSession(sessionID);
      state.deleteNudgedSession(sessionID);
    }
  }
}
