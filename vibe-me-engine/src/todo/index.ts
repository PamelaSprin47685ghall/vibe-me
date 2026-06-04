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
  const openTodos = hasOpenTodos(context.todos);
  const text = context.lastAssistantMessage ?? '';

  if (openTodos) {
    if (SKIP_TODO_RE.test(text)) return 'none';
    if (QUESTION_RE.test(text.trim())) return 'none';
    return 'nudge-todo';
  }

  if (context.hasActiveRunner) {
    return 'nudge-runner';
  }

  if (context.isLoopActive) {
    if (SKIP_LOOP_RE.test(text)) return 'none';
    if (QUESTION_RE.test(text.trim())) return 'none';
    return 'nudge-loop';
  }

  return 'none';
}

export class NudgeCoordinator {
  public lastTodoReminderAt = new Map<string, number>();
  public lastLoopReminderAt = new Map<string, number>();
  public lastRunnerReminderAt = new Map<string, number>();
  public lastNudgeEntryIndex = new Map<string, number>();
  private suppressedSessions = new Set<string>();

  public getOrCreateSuppressor(sessionId: string): { signal: AbortSignal; suppress: () => void; restore: () => void; isSuppressed: () => boolean } {
    const coordinator = this;
    return {
      signal: new AbortController().signal,
      suppress() { coordinator.suppressedSessions.add(sessionId); },
      restore() { coordinator.suppressedSessions.delete(sessionId); },
      isSuppressed() { return coordinator.consumeSuppression(sessionId); },
    };
  }

  public consumeSuppression(sessionId: string): boolean {
    if (!this.suppressedSessions.has(sessionId)) return false;
    this.suppressedSessions.delete(sessionId);
    return true;
  }

  public shouldNudge(
    sessionId: string,
    context: NudgeInputContext,
    entryCount?: number,
    now = Date.now(),
    throttleMs = 0
  ): NudgeAction {
    if (this.consumeSuppression(sessionId)) return 'none';

    const action = decideNudge(context);
    if (action === 'none') return 'none';

    if (entryCount !== undefined && action !== 'nudge-runner') {
      const lastIndex = this.lastNudgeEntryIndex.get(sessionId) ?? -1;
      if (entryCount <= lastIndex) return 'none';
    }

    if (action === 'nudge-todo') {
      const lastAt = this.lastTodoReminderAt.get(sessionId) || 0;
      if (now - lastAt < throttleMs) return 'none';
      this.lastTodoReminderAt.set(sessionId, now);
      if (entryCount !== undefined) this.lastNudgeEntryIndex.set(sessionId, entryCount);
    } else if (action === 'nudge-loop') {
      const lastAt = this.lastLoopReminderAt.get(sessionId) || 0;
      if (now - lastAt < throttleMs) return 'none';
      this.lastLoopReminderAt.set(sessionId, now);
      if (entryCount !== undefined) this.lastNudgeEntryIndex.set(sessionId, entryCount);
    } else if (action === 'nudge-runner') {
      const lastAt = this.lastRunnerReminderAt.get(sessionId) || 0;
      if (now - lastAt < throttleMs) return 'none';
      this.lastRunnerReminderAt.set(sessionId, now);
    }

    return action;
  }

  public suppress(sessionId: string): void {
    this.suppressedSessions.add(sessionId);
  }

  public clearSession(sessionId: string): void {
    this.lastTodoReminderAt.delete(sessionId);
    this.lastLoopReminderAt.delete(sessionId);
    this.lastRunnerReminderAt.delete(sessionId);
    this.lastNudgeEntryIndex.delete(sessionId);
    this.suppressedSessions.delete(sessionId);
  }

  public clear(): void {
    this.lastTodoReminderAt.clear();
    this.lastLoopReminderAt.clear();
    this.lastRunnerReminderAt.clear();
    this.lastNudgeEntryIndex.clear();
    this.suppressedSessions.clear();
  }
}

export const defaultCoordinator = new NudgeCoordinator();

export function clearNudgeSession(sessionId: string): void {
  defaultCoordinator.clearSession(sessionId);
}
