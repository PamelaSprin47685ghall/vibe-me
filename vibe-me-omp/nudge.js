import {
  LOOP_NUDGE_PROMPT,
  TODO_NUDGE_PROMPT,
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
import { TODO_NUDGE_CHECK_TAG, hasOpenTodos, NudgeCoordinator } from 'engine/todo';
import { buildRunnerNudgePrompt } from 'engine/runner';

const TERMINAL_TODO_STATUSES = new Set(['completed', 'cancelled', 'abandoned']);

const coordinator = new NudgeCoordinator();

function flattenTodoTasks(phases) {
  return phases.flatMap((phase) => phase.tasks || []);
}

function currentEntryCount(sessionManager) {
  return sessionManager.getEntries?.()?.length ?? 0;
}

export function createNudgeState() {
  return {
    lastTodoReminderAt: {
      set(key, val) { coordinator.lastTodoReminderAt.set(key, val); },
      get(key) { return coordinator.lastTodoReminderAt.get(key); },
      delete(key) { coordinator.lastTodoReminderAt.delete(key); },
    },
    lastLoopReminderAt: {
      set(key, val) { coordinator.lastLoopReminderAt.set(key, val); },
      get(key) { return coordinator.lastLoopReminderAt.get(key); },
      delete(key) { coordinator.lastLoopReminderAt.delete(key); },
    },
    lastRunnerReminderAt: {
      set(key, val) { coordinator.lastRunnerReminderAt.set(key, val); },
      get(key) { return coordinator.lastRunnerReminderAt.get(key); },
      delete(key) { coordinator.lastRunnerReminderAt.delete(key); },
    },
    lastNudgeEntryIndex: {
      set(key, val) { coordinator.lastNudgeEntryIndex.set(key, val); },
      get(key) { return coordinator.lastNudgeEntryIndex.get(key); },
      delete(key) { coordinator.lastNudgeEntryIndex.delete(key); },
    }
  };
}

function shouldThrottle(map, sessionId, now, ms = 5000) {
  const lastAt = map.get(sessionId) || 0;
  if (now - lastAt < ms) return true;
  map.set(sessionId, now);
  return false;
}

export function handleTodoNudge(pi, state, sessionId, sessionManager) {
  const entries = sessionManager.getEntries?.() ?? [];
  const tasks = flattenTodoTasks(getLatestTodoPhasesFromEntries(entries));
  const lastAssistantMessage = readAssistantText(entries) ?? undefined;

  const action = coordinator.shouldNudge(sessionId, {
    todos: tasks,
    lastAssistantMessage,
    hasActiveRunner: false,
    isLoopActive: false
  }, entries.length);

  if (action === 'nudge-todo') {
    pi.sendMessage({
      customType: 'kunwei-todo-reminder',
      content: TODO_NUDGE_PROMPT,
      display: false,
    }, { triggerTurn: true, deliverAs: 'nextTurn' });
  }
}

export function handleLoopNudge(pi, state, sessionId, sessionManager, isLoopActive) {
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

export function handleRunnerNudge(pi, state, sessionId, hasRunningJob) {
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

export { TODO_NUDGE_PROMPT as TODO_NUDGE, LOOP_NUDGE_PROMPT as LOOP_NUDGE, buildRunnerNudgePrompt as RUNNER_NUDGE };

export const _test = {
  createNudgeState,
  flattenTodoTasks,
  shouldThrottle,
  isReviewActive,
  tryLockReview,
  unlockReview,
};
