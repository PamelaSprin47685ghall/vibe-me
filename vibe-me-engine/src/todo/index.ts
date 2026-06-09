export const REVERIE_NUDGE = '// 三思而后行——建议立刻调用 reverie 工具提升思维';
export const TODO_NUDGE_CHECK_TAG = '<skip-todo-check />';
export const TERMINAL_TODO_STATUSES = new Set(['completed', 'cancelled', 'abandoned']);

export function hasOpenTodos(todos: Array<{ status: string }>): boolean {
  return todos.some((t) => !TERMINAL_TODO_STATUSES.has(t.status));
}

const SKIP_TODO_RE = /<skip-todo-check\s*\/?>/i;
const SKIP_LOOP_RE = /<skip-loop-check\s*\/?>/i;
const QUESTION_RE = /\?\s*$/;
export const TODO_NUDGE_PROMPT =
  'There are still incomplete todos. Continue working through the remaining items. ' +
  'If stuck or blocked, explain the situation and ask for guidance. ' +
  'If you want to skip this check, respond with <skip-todo-check />';
export const LOOP_NUDGE_PROMPT =
  'You are in loop mode. You must call the submit_review tool to\n' +
  'submit your detailed report and list of modified files for review\n' +
  'before finishing. Do not end the conversation without calling submit_review.';

export interface NudgeInputContext {
  todos: Array<{ status: string }>;
  lastAssistantMessage?: string;
  hasActiveRunner: boolean;
  isLoopActive: boolean;
}
export type NudgeAction = 'nudge-todo' | 'nudge-loop' | 'nudge-runner' | 'none';

export function decideNudge(context: NudgeInputContext): NudgeAction {
  const text = (context.lastAssistantMessage ?? '').trim();
  if (hasOpenTodos(context.todos)) {
    if (SKIP_TODO_RE.test(text) || QUESTION_RE.test(text)) return 'none';
    return 'nudge-todo';
  }
  if (context.hasActiveRunner) return 'nudge-runner';
  if (context.isLoopActive) {
    if (SKIP_LOOP_RE.test(text) || QUESTION_RE.test(text)) return 'none';
    return 'nudge-loop';
  }
  return 'none';
}

interface NudgeState {
  todoAt: number;
  loopAt: number;
  runnerAt: number;
  lastIndex: number;
}

const FRESH_STATE: NudgeState = { todoAt: 0, loopAt: 0, runnerAt: 0, lastIndex: -1 };
const TIMESTAMP_KEY: Record<NudgeAction, 'todoAt' | 'loopAt' | 'runnerAt'> = {
  'nudge-todo': 'todoAt',
  'nudge-loop': 'loopAt',
  'nudge-runner': 'runnerAt',
  none: 'todoAt',
};

export class NudgeCoordinator {
  private sessions = new Map<string, NudgeState>();
  private suppressed = new Set<string>();

  private get(sessionId: string): NudgeState {
    let s = this.sessions.get(sessionId);
    if (!s) { s = { ...FRESH_STATE }; this.sessions.set(sessionId, s); }
    return s;
  }

  shouldNudge(
    sessionId: string, context: NudgeInputContext, entryCount?: number, now = Date.now(), throttleMs = 0,
  ): NudgeAction {
    if (this.suppressed.delete(sessionId)) return 'none';
    const action = decideNudge(context);
    if (action === 'none') return 'none';
    if (entryCount !== undefined && action !== 'nudge-runner' && entryCount <= this.get(sessionId).lastIndex) return 'none';
    const state = this.get(sessionId);
    const key = TIMESTAMP_KEY[action];
    if (now - state[key] < throttleMs) return 'none';
    state[key] = now;
    if (entryCount !== undefined && action !== 'nudge-runner') state.lastIndex = entryCount;
    return action;
  }

  suppress(sessionId: string): void { this.suppressed.add(sessionId); }
  clearSession(sessionId: string): void { this.sessions.delete(sessionId); this.suppressed.delete(sessionId); }
  clear(): void { this.sessions.clear(); this.suppressed.clear(); }
}

export const defaultCoordinator = new NudgeCoordinator();
export function clearNudgeSession(sessionId: string): void { defaultCoordinator.clearSession(sessionId); }
