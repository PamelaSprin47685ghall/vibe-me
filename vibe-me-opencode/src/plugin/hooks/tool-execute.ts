import {
  err,
  ok,
  parseCallID,
  parseSessionID,
  type Result,
  validateRecord,
} from 'engine';
import type { ToolExecuteBeforeInput } from './types.js';

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function joinEditorIntents(intents: unknown): Result<string, string> {
  if (!Array.isArray(intents)) {
    return err('Invalid LLM input for editor: intents must be an array');
  }
  const firstItems = intents.map((intent) =>
    Array.isArray(intent) ? intent[0] : intent,
  );
  if (!firstItems.every((item): item is string => typeof item === 'string')) {
    return err(
      'Invalid LLM input for editor: each intent must start with a string',
    );
  }
  return ok(firstItems.join('; '));
}

function joinGreperIntents(intents: unknown): Result<string, string> {
  if (!isStringArray(intents)) {
    return err(
      'Invalid LLM input for greper: intents must be an array of strings',
    );
  }
  return ok(intents.join('; '));
}

function formatFieldErrors(errors: Record<string, string>): string {
  return Object.entries(errors)
    .map(([key, message]) => `${key}: ${message}`)
    .join('; ');
}

export function transformToolExecuteBefore(
  input: ToolExecuteBeforeInput,
  args: { intents?: unknown; _ui?: unknown },
): Result<{ _ui?: string }, string> {
  const ids = validateRecord(
    { sessionID: parseSessionID, callID: parseCallID },
    input,
  );
  if (ids._tag === 'Err') {
    return err(`Invalid tool execute context: ${formatFieldErrors(ids.error)}`);
  }

  if (args._ui !== undefined && typeof args._ui !== 'string') {
    return err(
      `Invalid LLM input for ${input.tool}: _ui must be a string, received ${typeof args._ui}`,
    );
  }

  if (input.tool === 'editor') {
    const joined = joinEditorIntents(args.intents);
    if (joined._tag === 'Err') return joined;
    return ok({ _ui: joined.value });
  }

  if (input.tool === 'greper') {
    const joined = joinGreperIntents(args.intents);
    if (joined._tag === 'Err') return joined;
    return ok({ _ui: joined.value });
  }

  return ok({});
}
