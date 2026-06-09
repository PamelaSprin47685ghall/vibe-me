import { isAbortErrorName } from './abort.js';
import { TODO_NUDGE_PROMPT, LOOP_NUDGE_PROMPT } from 'engine/todo';
import { buildRunnerNudgePrompt } from 'engine/runner';

// ── Retry progress sets ─────────────────────────────────────────────────────
// Events and part types that signal ongoing (non-terminal) progress during
// a retry cycle.  Used to suppress premature nudges.

export const RETRY_PROGRESS_EVENTS = new Set([
  'session.next.step.started',
  'session.next.step.ended',
  'session.next.text.started',
  'session.next.text.delta',
  'session.next.text.ended',
  'session.next.reasoning.started',
  'session.next.reasoning.delta',
  'session.next.reasoning.ended',
  'session.next.tool.input.started',
  'session.next.tool.input.delta',
  'session.next.tool.input.ended',
  'session.next.tool.called',
  'session.next.tool.progress',
  'session.next.tool.success',
]);

export const RETRY_PROGRESS_PARTS = new Set([
  'step-start',
  'step-finish',
  'text',
  'reasoning',
  'tool',
  'agent',
  'subtask',
  'file',
  'snapshot',
  'patch',
]);

// ── Public pure functions ───────────────────────────────────────────────────

export function getEventAgent(props: Record<string, unknown>): string | undefined {
  if (typeof props.agent === 'string') return props.agent;
  const info = props.info as { agent?: unknown } | undefined;
  if (typeof info?.agent === 'string') return info.agent;
}

export function isAbortEventError(error: unknown): boolean {
  if (typeof error === 'string') return /\babort(?:ed)?\b/i.test(error);
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: unknown }).name;
  if (typeof name === 'string' && isAbortErrorName(name)) return true;
  const nestedError = (error as { error?: unknown }).error;
  if (nestedError && nestedError !== error && isAbortEventError(nestedError)) return true;
  const data = (error as { data?: unknown }).data;
  if (data && typeof data === 'object') {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && /\babort(?:ed)?\b/i.test(message)) return true;
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && /\babort(?:ed)?\b/i.test(message);
}

export function isSessionBusyError(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { _tag?: unknown })._tag === 'SessionBusyError';
}

export function isNudgePrompt(text: unknown): boolean {
  return text === TODO_NUDGE_PROMPT || text === LOOP_NUDGE_PROMPT || text === buildRunnerNudgePrompt();
}

export function getSessionID(type: string, props: Record<string, unknown>): string | undefined {
  if (typeof props.sessionID === 'string') return props.sessionID;
  const part = props.part as { sessionID?: unknown } | undefined;
  if (typeof part?.sessionID === 'string') return part.sessionID;
  const info = props.info as { id?: unknown; sessionID?: unknown } | undefined;
  if (typeof info?.sessionID === 'string') return info.sessionID;
  if (['session.created', 'session.updated', 'session.deleted'].includes(type) && typeof info?.id === 'string') return info.id;
}

export function getPartsText(parts: unknown): string | undefined {
  if (!Array.isArray(parts)) return;
  const text = parts
    .filter((part): part is { type: string; text: string } => typeof part === 'object' && part !== null && (part as { type?: unknown }).type === 'text' && typeof (part as { text?: unknown }).text === 'string')
    .map(part => part.text)
    .join('\n');
  return text || undefined;
}

export function isRetryProgressEvent(type: string): boolean {
  return RETRY_PROGRESS_EVENTS.has(type);
}

export function isRetryProgressPart(type: unknown): boolean {
  return RETRY_PROGRESS_PARTS.has(String(type));
}

export function isTerminalAssistantFinish(finish: unknown): boolean {
  if (typeof finish !== 'string') return false;
  const normalized = finish.toLowerCase().replace(/[-_\s]/g, '');
  return !normalized.includes('tool') && !normalized.includes('abort');
}

export function isCompletedAssistantMessage(info: unknown): boolean {
  if (!info || typeof info !== 'object') return false;
  const message = info as { type?: unknown; role?: unknown; time?: { completed?: unknown }; finish?: unknown; error?: unknown };
  if (message.type !== 'assistant' && message.role !== 'assistant') return false;
  if (message.error) return false;
  if (typeof message.finish === 'string') return isTerminalAssistantFinish(message.finish);
  return typeof message.time?.completed === 'number';
}

export function createPromptBody(agent: string | undefined, text: string) {
  const parts = [{ type: 'text' as const, text }];
  return agent ? { agent, parts } : { parts };
}