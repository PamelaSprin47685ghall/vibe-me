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
