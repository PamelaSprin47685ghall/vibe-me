// ---------------------------------------------------------------------------
// Pure nudge decision functions.
// No I/O, no node:*, no mutation — every function is pure.
// Import types from ../types/nudge.js only.
// ---------------------------------------------------------------------------

import {
  type NudgeAction,
  type NudgeContext,
  type NudgeCoordinatorState,
  type SessionNudgeState,
  nudgeNone,
  nudgeTodo,
  nudgeLoop,
  nudgeRunner,
  freshSessionNudgeState,
  timestampKeyForAction,
} from '../types/nudge.js';

// =========================================================================
// 1. CONSTANTS
// =========================================================================

export const SKIP_TODO_RE = /<skip-todo-check\s*\/?>/i;
export const SKIP_LOOP_RE = /<skip-loop-check\s*\/?>/i;
export const QUESTION_RE = /\?\s*$/;

export const REVERIE_NUDGE =
  '// Think thrice before acting — NOW consider calling reverie tool to improve reasoning';

export const TODO_NUDGE_PROMPT =
  'There are still incomplete todos. Continue working through the remaining items. ' +
  'If stuck or blocked, explain the situation and ask for guidance. ' +
  'If you want to skip this check, respond with <skip-todo-check />';

export const LOOP_NUDGE_PROMPT =
  'You are in loop mode. You must call the submit_review tool to\n' +
  'submit your detailed report and list of modified files for review\n' +
  'before finishing. Do not end the conversation without calling submit_review.';

// =========================================================================
// 2. PURE DECISION FUNCTIONS
// =========================================================================

/**
 * Pure function that decides which nudge action to take based solely on the
 * current context.  Priority:
 *   1. Open todos → nudgeTodo (unless skip/question patterns present)
 *   2. Active runner → nudgeRunner
 *   3. Active loop  → nudgeLoop (unless skip/question patterns present)
 *   4. Otherwise    → nudgeNone
 */
export function decideNudge(context: NudgeContext): NudgeAction {
  const text = context.lastAssistantMessage.trim();

  if (context.todos.length > 0) {
    if (SKIP_TODO_RE.test(text) || QUESTION_RE.test(text)) return nudgeNone;
    return nudgeTodo;
  }

  if (context.hasActiveRunner) return nudgeRunner;

  if (context.isLoopActive) {
    if (SKIP_LOOP_RE.test(text) || QUESTION_RE.test(text)) return nudgeNone;
    return nudgeLoop;
  }

  return nudgeNone;
}

/**
 * Check whether nudges should be suppressed for a session.
 * Returns `true` when the last assistant message is a question, contains
 * a skip tag, or when the previous action would be the same as the freshly
 * decided one (avoid repeating identical nudges).
 */
export function shouldSuppressNudge(
  _sessionId: string,
  context: NudgeContext,
  previousAction: NudgeAction | null,
): boolean {
  // Blanket suppression: don't interrupt questions or explicit skip tags.
  const text = context.lastAssistantMessage.trim();
  if (QUESTION_RE.test(text)) return true;
  if (SKIP_TODO_RE.test(text) || SKIP_LOOP_RE.test(text)) return true;

  // Avoid repeating the same nudge if the context hasn't changed.
  if (previousAction !== null && previousAction._tag !== 'NudgeNone') {
    const nextAction = decideNudge(context);
    if (nextAction._tag === previousAction._tag) return true;
  }

  return false;
}

// =========================================================================
// 3. IMMUTABLE STATE MANAGEMENT
// =========================================================================

/** Factory: create an empty `NudgeCoordinatorState`. */
export function createNudgeCoordinatorState(): NudgeCoordinatorState {
  return { sessions: new Map() };
}

/**
 * Pure state transition.
 * Decides the appropriate nudge action for the given context, records the
 * timestamp (via `now`) in the session state, and returns the updated
 * coordinator state together with the action taken.
 *
 * When the decided action is `NudgeNone` the state is returned unchanged.
 */
export function updateNudgeState(
  state: NudgeCoordinatorState,
  sessionId: string,
  context: NudgeContext,
  now: number,
): [NudgeCoordinatorState, NudgeAction] {
  const action = decideNudge(context);
  if (action._tag === 'NudgeNone') return [state, nudgeNone];

  const prev: SessionNudgeState =
    state.sessions.get(sessionId) ?? freshSessionNudgeState;
  const key = timestampKeyForAction(action);

  const updated: SessionNudgeState = {
    ...prev,
    [key]: now,
    lastIndex: prev.lastIndex + 1,
  };

  const nextMap = new Map(state.sessions);
  nextMap.set(sessionId, updated);

  return [{ sessions: nextMap }, action];
}
