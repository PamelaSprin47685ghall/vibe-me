import { type Result, ok, err } from './general.js';

export type Brand<Tag> = { readonly __brand: Tag };

export type SessionID = string & Brand<'SessionID'>;
export type WorkspaceID = string & Brand<'WorkspaceID'>;
export type AgentID = string & Brand<'AgentID'>;
export type ToolID = string & Brand<'ToolID'>;
export type CallID = string & Brand<'CallID'>;
export type ChildID = string & Brand<'ChildID'>;

function makeParser<Id extends string>(label: string): (input: unknown) => Result<Id, string> {
  return (input) =>
    typeof input === 'string' && input.length > 0
      ? ok(input as Id)
      : err(`${label} must be a non-empty string`);
}

export const parseSessionID = makeParser<SessionID>('SessionID');
export const parseWorkspaceID = makeParser<WorkspaceID>('WorkspaceID');
export const parseAgentID = makeParser<AgentID>('AgentID');
export const parseToolID = makeParser<ToolID>('ToolID');
export const parseCallID = makeParser<CallID>('CallID');
export const parseChildID = makeParser<ChildID>('ChildID');

export type Parser<T> = (input: unknown) => Result<T, string>;

export function validateRecord<Parsers extends Record<string, Parser<unknown>>>(
  schema: Readonly<Parsers>,
  input: Record<string, unknown>,
): Result<
  { readonly [K in keyof Parsers]: Parsers[K] extends Parser<infer R> ? R : never },
  { readonly [K in keyof Parsers]?: string }
> {
  const parsed: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const key of Object.keys(schema)) {
    const result = schema[key]!(input[key]);
    if (result._tag === 'Ok') {
      parsed[key] = result.value;
    } else {
      errors[key] = result.error;
    }
  }

  return Object.keys(errors).length > 0
    ? err(errors as { readonly [K in keyof Parsers]?: string })
    : ok(parsed as { readonly [K in keyof Parsers]: Parsers[K] extends Parser<infer R> ? R : never });
}
