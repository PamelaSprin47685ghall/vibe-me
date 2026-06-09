// ---------------------------------------------------------------------------
// Backward-compatible barrel for todo/nudge module.
// Re-exports the pure kernel functions and types, plus a legacy class wrapper.
// ---------------------------------------------------------------------------

// Local-scope imports needed by NudgeCoordinator below; export {…} from does
// NOT make names available in this scope.
import {
  createNudgeCoordinatorState,
  updateNudgeState,
} from '../kernel/todo.js';
import {
  nudgeActionToString,
  type NudgeContext,
} from '../kernel/types.js';

export {
  SKIP_TODO_RE,
  SKIP_LOOP_RE,
  QUESTION_RE,
  REVERIE_NUDGE,
  TODO_NUDGE_PROMPT,
  LOOP_NUDGE_PROMPT,
  decideNudge,
  shouldSuppressNudge,
  createNudgeCoordinatorState,
  updateNudgeState,
} from '../kernel/todo.js';

// Re-export types used by callers
export type { NudgeAction, NudgeContext, NudgeCoordinatorState, SessionNudgeState } from '../kernel/types.js';
export { nudgeActionFromString, nudgeActionToString, matchNudgeAction } from '../kernel/types.js';

// Backward compat for callers still using the old NudgeCoordinator class API
export class NudgeCoordinator {
  private state = createNudgeCoordinatorState();
  private suppressed = new Set<string>();

  shouldNudge(sessionId: string, context: NudgeContext): string {
    if (this.suppressed.delete(sessionId)) return 'none';
    const [newState, action] = updateNudgeState(this.state, sessionId, context, Date.now());
    this.state = newState;
    return nudgeActionToString(action);
  }

  suppress(sessionId: string): void { this.suppressed.add(sessionId); }
  clearSession(sessionId: string): void {
    const next = new Map(this.state.sessions);
    next.delete(sessionId);
    this.state = { sessions: next };
    this.suppressed.delete(sessionId);
  }
  clear(): void { this.state = createNudgeCoordinatorState(); this.suppressed.clear(); }
}

export const defaultCoordinator = new NudgeCoordinator();
export function clearNudgeSession(sessionId: string): void { defaultCoordinator.clearSession(sessionId); }

// ---------------------------------------------------------------------------
// Backward-compat aliases and helpers that the engine barrel re-exports.
// ---------------------------------------------------------------------------

/** Backward-compat alias for NudgeContext (used by shell-level callers). */
export type { NudgeContext as NudgeInputContext } from '../kernel/types.js';

/** The magic comment tag that suppresses todo nudges. */
export const TODO_NUDGE_CHECK_TAG = '<skip-todo-check />';

/** Status values that mark a todo as no longer open. */
export const TERMINAL_TODO_STATUSES: ReadonlySet<string> = new Set(['completed', 'cancelled', 'abandoned']);

/** Check whether at least one item in a list of open-todo strings remains. */
export function hasOpenTodos(todos: readonly string[]): boolean {
  return todos.length > 0;
}
