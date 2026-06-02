export type UnifiedSchemaType = 'string' | 'number' | 'boolean' | 'array' | 'enum' | 'object';

export interface UnifiedSchemaField {
  type: UnifiedSchemaType;
  description: string;
  optional?: boolean;
  enumValues?: string[];
  items?: UnifiedSchemaField;
  properties?: Record<string, UnifiedSchemaField>;
  default?: unknown;
}

export interface ExecutionContext {
  sessionID: string;
  directory: string;
  abortSignal?: AbortSignal;
  parentSessionID?: string;
  [key: string]: unknown;
}

export interface UnifiedToolDescriptor<TArgs = Record<string, unknown>> {
  name: string;
  description: string;
  parameters: Record<string, UnifiedSchemaField>;
  execute: (args: TArgs, context: ExecutionContext) => Promise<string | Record<string, unknown>>;
}

export function resolveExecutionContext(context: unknown): ExecutionContext {
  if (!context || typeof context !== 'object') {
    throw new Error('Invalid execution context');
  }

  const ctx = context as Record<string, unknown>;
  
  const sessionID = (ctx.sessionID || ctx.sessionId || ctx.session_id) as string;
  const directory = (ctx.directory || ctx.cwd || ctx.workspaceDir) as string;
  const abortSignal = ctx.abortSignal as AbortSignal | undefined;
  const parentSessionID = (ctx.parentSessionID || ctx.parentSessionId) as string | undefined;

  if (!sessionID || !directory) {
    throw new Error('Missing required context: sessionID or directory');
  }

  return {
    sessionID,
    directory,
    abortSignal,
    parentSessionID,
    ...ctx,
  };
}

export function createToolDescriptor<TArgs = Record<string, unknown>>(
  descriptor: UnifiedToolDescriptor<TArgs>
): UnifiedToolDescriptor<TArgs> {
  return descriptor;
}
