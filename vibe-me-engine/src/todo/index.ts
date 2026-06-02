import { createAbortSuppressor } from '../util/abort.js';

export const TODO_NUDGE_CHECK_TAG = '<skip-todo-check />';
export const TERMINAL_TODO_STATUSES = new Set(['completed', 'cancelled', 'abandoned']);

export function hasOpenTodos(todos: Array<{ status: string }>): boolean {
  return todos.some((t) => !TERMINAL_TODO_STATUSES.has(t.status));
}

export function wasTagSkipped(text: string, tag: string): boolean {
  return text.includes(tag);
}

export const TODO_NUDGE_PROMPT =
  'There are still incomplete todos. Continue working through the remaining items. ' +
  'If stuck or blocked, explain the situation and ask for guidance. ' +
  'If you want to skip this check, respond with <skip-todo-check />';

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
  const skipTodo = context.lastAssistantMessage ? wasTagSkipped(context.lastAssistantMessage, TODO_NUDGE_CHECK_TAG) : false;

  if (openTodos) {
    if (!skipTodo) {
      return 'nudge-todo';
    }
  } else if (context.isLoopActive) {
    const skipLoop = context.lastAssistantMessage ? wasTagSkipped(context.lastAssistantMessage, '<skip-loop-check />') : false;
    if (!skipLoop) {
      return 'nudge-loop';
    }
  }

  return 'none';
}

export class NudgeCoordinator {
  private lastTodoReminderAt = new Map<string, number>();
  private lastLoopReminderAt = new Map<string, number>();
  private lastRunnerReminderAt = new Map<string, number>();
  private lastNudgeEntryIndex = new Map<string, number>();
  private suppressors = new Map<string, ReturnType<typeof createAbortSuppressor>>();

  constructor(private suppressAfterMs = 5000) {}

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
