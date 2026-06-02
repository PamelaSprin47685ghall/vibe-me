import { createAbortSuppressor } from '../util/abort.js';

export const TODO_NUDGE_CHECK_TAG = '<skip-todo-check />';
export const TERMINAL_TODO_STATUSES = new Set(['completed', 'cancelled', 'abandoned']);

export function hasOpenTodos(todos: Array<{ status: string }>): boolean {
  return todos.some((t) => !TERMINAL_TODO_STATUSES.has(t.status));
}

const SKIP_TODO_RE = /<skip-todo-check\s*\/?>/i;
const SKIP_LOOP_RE = /<skip-loop-check\s*\/?>/i;
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
  if (context.hasActiveRunner) {
    return 'nudge-runner';
  }

  const openTodos = hasOpenTodos(context.todos);
  const text = context.lastAssistantMessage ?? '';

  if (openTodos) {
    if (!SKIP_TODO_RE.test(text)) {
      return 'nudge-todo';
    }
  } else if (context.isLoopActive) {
    if (!SKIP_LOOP_RE.test(text)) {
      return 'nudge-loop';
    }
  }

  return 'none';
}

export class NudgeCoordinator {
  public lastTodoReminderAt = new Map<string, number>();
  public lastLoopReminderAt = new Map<string, number>();
  public lastRunnerReminderAt = new Map<string, number>();
  public lastNudgeEntryIndex = new Map<string, number>();
  public suppressors = new Map<string, ReturnType<typeof createAbortSuppressor>>();

  constructor(public suppressAfterMs = 5000) {}

  public getOrCreateSuppressor(sessionId: string) {
    let sup = this.suppressors.get(sessionId);
    if (!sup) {
      sup = createAbortSuppressor(this.suppressAfterMs);
      this.suppressors.set(sessionId, sup);
    }
    return sup;
  }

  public shouldNudge(
    sessionId: string,
    context: NudgeInputContext,
    entryCount: number,
    now = Date.now(),
    throttleMs = 5000
  ): NudgeAction {
    const suppressor = this.getOrCreateSuppressor(sessionId);
    if (suppressor.isSuppressed()) return 'none';

    const action = decideNudge(context);
    if (action === 'none') return 'none';

    const lastIndex = this.lastNudgeEntryIndex.get(sessionId) ?? -1;
    if (entryCount <= lastIndex && action !== 'nudge-runner') {
      return 'none';
    }

    if (action === 'nudge-todo') {
      const lastAt = this.lastTodoReminderAt.get(sessionId) || 0;
      if (now - lastAt < throttleMs) return 'none';
      this.lastTodoReminderAt.set(sessionId, now);
      this.lastNudgeEntryIndex.set(sessionId, entryCount);
    } else if (action === 'nudge-loop') {
      const lastAt = this.lastLoopReminderAt.get(sessionId) || 0;
      if (now - lastAt < throttleMs) return 'none';
      this.lastLoopReminderAt.set(sessionId, now);
      this.lastNudgeEntryIndex.set(sessionId, entryCount);
    } else if (action === 'nudge-runner') {
      const lastAt = this.lastRunnerReminderAt.get(sessionId) || 0;
      if (now - lastAt < throttleMs) return 'none';
      this.lastRunnerReminderAt.set(sessionId, now);
    }

    return action;
  }

  public suppress(sessionId: string): void {
    this.getOrCreateSuppressor(sessionId).suppress();
  }

  public clearSession(sessionId: string): void {
    this.lastTodoReminderAt.delete(sessionId);
    this.lastLoopReminderAt.delete(sessionId);
    this.lastRunnerReminderAt.delete(sessionId);
    this.lastNudgeEntryIndex.delete(sessionId);
    this.suppressors.delete(sessionId);
  }

  public clear(): void {
    this.lastTodoReminderAt.clear();
    this.lastLoopReminderAt.clear();
    this.lastRunnerReminderAt.clear();
    this.lastNudgeEntryIndex.clear();
    this.suppressors.clear();
  }
}

export const defaultCoordinator = new NudgeCoordinator();

export function clearNudgeSession(sessionId: string): void {
  defaultCoordinator.clearSession(sessionId);
}
