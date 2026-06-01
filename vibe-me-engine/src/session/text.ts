export interface AssistantTextOptions {
  startIndex?: number;
  joiner?: string;
}

export interface Entry {
  type?: string;
  customType?: string;
  message?: {
    role?: string;
    content?: Array<{ type?: string; text?: string }>;
    toolName?: string;
    isError?: boolean;
    details?: { phases?: unknown[] };
  };
  data?: { phases?: unknown[] };
}

export function readAssistantText(entries: Entry[], options: AssistantTextOptions = {}): string | null {
  const { startIndex = 0, joiner = '\n\n' } = options;
  const chunks: string[] = [];
  for (let i = startIndex; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!entry || entry.type !== 'message') continue;
    if (entry.message?.role !== 'assistant') continue;
    for (const part of entry.message?.content ?? []) {
      if (part?.type === 'text' && part.text) chunks.push(part.text);
    }
  }
  return chunks.length > 0 ? chunks.join(joiner) : null;
}

function cloneTask(task: unknown): unknown {
  if (typeof task !== 'object' || task === null) return task;
  const t = task as Record<string, unknown>;
  if (Array.isArray(t.notes)) return { ...t, notes: [...t.notes] };
  return { ...t };
}

function clonePhases(phases: unknown[]): unknown[] {
  return phases.map((phase) => {
    if (typeof phase !== 'object' || phase === null) return phase;
    const p = phase as Record<string, unknown>;
    return { ...p, tasks: (p.tasks as unknown[] ?? []).map(cloneTask) };
  });
}

export function getLatestTodoPhasesFromEntries(entries: Entry[]): unknown {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (!entry) continue;
    if (entry.type === 'custom' && entry.customType === 'user_todo_edit' && Array.isArray(entry.data?.phases)) {
      return clonePhases(entry.data.phases);
    }
    if (entry.type !== 'message') continue;
    const msg = entry.message;
    if (msg?.role !== 'toolResult' || msg?.toolName !== 'todo_write' || msg?.isError) continue;
    if (!Array.isArray(msg?.details?.phases)) continue;
    return clonePhases(msg.details.phases);
  }
  return [];
}
