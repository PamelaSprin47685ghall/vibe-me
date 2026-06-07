import { isAbortError, isAbortErrorName, createAbortSuppressor } from 'engine/util';

export { isAbortError, isAbortErrorName, createAbortSuppressor };

export type JsonObject = Record<string, unknown>;

export type TextPart = {
  type?: string;
  text?: string;
};

export type SessionEntry = {
  message?: {
    role?: string;
    content?: TextPart[];
  };
  info?: {
    role?: string;
  };
  parts?: TextPart[];
};

export type SessionManagerLike = {
  getEntries?: () => SessionEntry[];
  getSessionId?: () => string | null | undefined;
  sessionId?: string | null;
};

export type AgentSessionLike = {
  prompt: (prompt: string) => Promise<unknown>;
  waitForIdle: () => Promise<unknown>;
  abort?: () => void;
  sessionManager: SessionManagerLike;
};

export type ChildSession = {
  session: AgentSessionLike;
  dispose?: () => void;
};

export type PluginContext = {
  cwd: string;
  sessionId?: string;
  workspaceId?: string;
  sessionManager?: SessionManagerLike;
  modelRegistry?: unknown;
  model?: unknown;
  agentsMdSearch?: unknown;
  workspaceTree?: unknown;
  getThinkingLevel?: () => unknown;
  getSystemPrompt?: () => string[];
  hasPendingMessages?: () => boolean;
  ui: {
    notify: (message: string, level?: string) => void;
  };
};

export type ToolTextResult = {
  type: 'text';
  text: string;
};

export type ToolResult = {
  content: ToolTextResult[];
  isError?: boolean;
  display?: boolean;
  details?: unknown;
};

export type SharedHelpers = {
  asErrorResult: (error: unknown) => ToolResult;
  createChildSession: (pi: PiLike, ctx: PluginContext, config: CreateChildSessionConfig) => Promise<ChildSession>;
  getSessionIdFromContext: (ctx: PluginContext) => string | null;
  readAssistantText: (sessionManager: SessionManagerLike, options?: ReadAssistantTextOptions) => string | null;
  runSubagent: (pi: PiLike, ctx: PluginContext, config: RunSubagentConfig) => Promise<string>;
  stringArraySchema: (pi: PiLike, description: string) => unknown;
};

export type ReadAssistantTextOptions = {
  startIndex?: number;
  joiner?: string;
};

export type CreateChildSessionConfig = {
  toolNames?: string[];
  prompt?: string;
  signal?: AbortSignal;
  waitForResult?: (session: AgentSessionLike, dispose?: () => void) => Promise<string>;
  systemPrompt?: string | string[];
  customTools?: unknown[];
};

export type RunSubagentConfig = Required<Pick<CreateChildSessionConfig, 'prompt'>> & Omit<CreateChildSessionConfig, 'prompt'>;

export type PiLike = {
  typebox: {
    Type: {
      Array: (...args: unknown[]) => unknown;
      String: (...args: unknown[]) => unknown;
      Object: (...args: unknown[]) => unknown;
      Optional: (...args: unknown[]) => unknown;
      Number: (...args: unknown[]) => unknown;
      Boolean: (...args: unknown[]) => unknown;
      Union: (...args: unknown[]) => unknown;
      Null: (...args: unknown[]) => unknown;
      Enum: (...args: unknown[]) => unknown;
    };
  };
  pi?: {
    createAgentSession?: (config: JsonObject) => Promise<ChildSession>;
  };
  on: <Args extends unknown[]>(eventName: string, handler: (...args: Args) => unknown) => void;
  sendMessage: (message: JsonObject, options?: JsonObject) => void;
  registerCommand: (name: string, config: JsonObject) => void;
  registerTool: (tool: JsonObject) => void;
  getActiveTools: () => string[];
  setActiveTools: (toolNames: string[]) => Promise<void>;
  getAllTools?: () => string[];
};

export type PromiseWithResolversLike<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

export function createAbortError(): Error & { name: 'AbortError' } {
  return Object.assign(new Error('Aborted'), { name: 'AbortError' as const });
}

export function hasErrorName(error: unknown, name: string): error is { name: string } {
  return typeof error === 'object' && error !== null && 'name' in error && (error as { name?: unknown }).name === name;
}

export function getSessionIdFromContext(ctx: PluginContext) {
  return ctx?.sessionManager?.getSessionId?.() || ctx?.sessionManager?.sessionId || null;
}

export function asErrorResult(error: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
    isError: true,
  };
}

export function stringArraySchema(pi: PiLike, description: string) {
  return pi.typebox.Type.Array(pi.typebox.Type.String({ description }));
}

export function raceWithSignal<T>(promise: Promise<T>, signal?: AbortSignal | null): Promise<T> {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(createAbortError());
    const { promise: abortPromise, reject } = Promise.withResolvers<T>();
    const onAbort = () => reject(createAbortError());
    signal.addEventListener('abort', onAbort, { once: true });
    const result = Promise.race([promise, abortPromise]);
    result.finally(() => signal.removeEventListener('abort', onAbort));
    return result;
}
