import {
  LOOP_NUDGE_PROMPT,
  isReviewActive,
  tryLockReview,
  unlockReview,
} from 'engine/review';
import { getLatestTodoPhasesFromEntries, readAssistantText } from 'engine/session';
import { NudgeCoordinator } from 'engine/todo';
import { buildRunnerNudgePrompt } from 'engine/runner';
import type { PiLike, SessionManagerLike } from './shared.js';

type TodoTask = { status: string };
type TodoPhase = { tasks?: TodoTask[] };

const coordinator = new NudgeCoordinator();

function flattenTodoTasks(phases: TodoPhase[]): TodoTask[] {
  return phases.flatMap((phase) => phase.tasks || []).filter((task): task is TodoTask => typeof task.status === 'string');
}

export function handleLoopNudge(pi: PiLike, _state: unknown, sessionId: string, sessionManager: SessionManagerLike, isLoopActive: (sessionId: string) => boolean) {
  const entries = sessionManager.getEntries?.() ?? [];
  const tasks = flattenTodoTasks(getLatestTodoPhasesFromEntries(entries) as TodoPhase[]);
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

export function handleRunnerNudge(pi: PiLike, _state: unknown, sessionId: string, hasRunningJob: (sessionId: string) => boolean) {
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

export function clearNudgeSession(sessionId: string) {
  coordinator.clearSession(sessionId);
}

export { LOOP_NUDGE_PROMPT as LOOP_NUDGE, buildRunnerNudgePrompt as RUNNER_NUDGE };

export const _test = {
  flattenTodoTasks,
  isReviewActive,
  tryLockReview,
  unlockReview,
};
