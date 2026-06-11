import {
  createNudgeCoordinatorState,
  updateNudgeState,
  SKIP_TODO_RE,
  SKIP_LOOP_RE,
  QUESTION_RE,
  REVERIE_NUDGE,
  TODO_NUDGE_PROMPT,
  LOOP_NUDGE_PROMPT,
  decideNudge,
  shouldSuppressNudge,
} from './nudge.js';
import {
  nudgeActionToString,
  type NudgeContext,
  type NudgeAction,
  type NudgeCoordinatorState,
  type SessionNudgeState,
  nudgeActionFromString,
  matchNudgeAction,
} from '../types/nudge.js';

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
  nudgeActionFromString,
  nudgeActionToString,
  matchNudgeAction,
};
export type { NudgeAction, NudgeContext, NudgeCoordinatorState, SessionNudgeState };

export const TERMINAL_TODO_STATUSES: ReadonlySet<string> = new Set(['completed', 'cancelled', 'abandoned']);

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

export type { NudgeContext as NudgeInputContext };