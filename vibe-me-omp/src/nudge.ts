import {
  LOOP_NUDGE_PROMPT,
  activateReview,
  addChild,
  clearReviewSessions as _clearReviewSessions,
  deactivateReview,
  getOrCreateAbortSuppressor as _getOrCreateSuppressor,
  isReviewActive,
  resolvePendingReview,
  setLastFeedback,
  setPendingReview,
  tryLockReview,
  unlockReview,
  getReviewTask,
} from 'engine/review';
import { getLatestTodoPhasesFromEntries, readAssistantText } from 'engine/session';
import { NudgeCoordinator } from 'engine/todo';
import { buildRunnerNudgePrompt } from 'engine/runner';

const TERMINAL_TODO_STATUSES = new Set(['completed', 'cancelled', 'abandoned']);

const coordinator = new NudgeCoordinator();

function flattenTodoTasks(phases) {
  return phases.flatMap((phase) => phase.tasks || []);
}

export function handleLoopNudge(pi, _state, sessionId, sessionManager, isLoopActive) {
  const entries = sessionManager.getEntries?.() ?? [];
  const tasks = flattenTodoTasks(getLatestTodoPhasesFromEntries(entries));
  const lastAssistantMessage = readAssistantText(entries) ?? undefined;

  const action = coordinator.shouldNudge(sessionId, {
    todos: tasks,
    lastAssistantMessage,
    hasActiveRunner: false,
    isLoopActive: isLoopActive(sessionId)
  }, entries.length);

  if (action === 'nudge-loop') {
    pi.sendMessage({
      customType: 'kunwei-loop-reminder',
      content: LOOP_NUDGE_PROMPT,
      display: false,
    }, { triggerTurn: true, deliverAs: 'nextTurn' });
  }
}

export function handleRunnerNudge(pi, _state, sessionId, hasRunningJob) {
  const action = coordinator.shouldNudge(sessionId, {
    todos: [],
    hasActiveRunner: hasRunningJob(sessionId),
    isLoopActive: false
  }, 0);

  if (action === 'nudge-runner') {
    pi.sendMessage({
      customType: 'kunwei-runner-reminder',
      content: buildRunnerNudgePrompt(),
      display: false,
    }, { triggerTurn: true, deliverAs: 'nextTurn' });
  }
}

export function clearNudgeSession(sessionId) {
  coordinator.clearSession(sessionId);
}

export { LOOP_NUDGE_PROMPT as LOOP_NUDGE, buildRunnerNudgePrompt as RUNNER_NUDGE };

export const _test = {
  flattenTodoTasks,
  isReviewActive,
  tryLockReview,
  unlockReview,
};
