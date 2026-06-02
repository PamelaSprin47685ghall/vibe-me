import type { TaskServiceLike } from "./deps";
import type { PluginToolConfiguration } from "./tool";

export type { PluginToolConfiguration };

// ── Tool argument types ──

export interface BrowserToolArgs {
  readonly intent: string;
}

export interface EditorToolArgs {
  readonly intent: string;
}

export interface GreperToolArgs {
  readonly intent: string;
}

export interface ReverieToolArgs {
  readonly intent: string;
  readonly files: readonly string[];
}

export interface RunnerToolArgs {
  readonly language: "shell" | "python";
  readonly program: string;
  readonly dependencies?: string[];
  readonly what_to_summarize: string;
}

export interface RunnerWaitToolArgs {
  readonly jobId: string;
  readonly ms?: number;
}

export interface RunnerAbortToolArgs {
  readonly jobId: string;
}

export interface StartReviewLoopToolArgs {
  readonly task: string;
}

export interface SubmitReviewToolArgs {
  readonly report: string;
  readonly affectedFiles: readonly string[];
}

export interface WebsearchToolArgs {
  readonly query: string;
  readonly numResults?: number;
}

export interface WebfetchToolArgs {
  readonly url: string;
  readonly extract_main?: boolean;
  readonly prefer_llms_txt?: "auto" | "always" | "never";
  readonly prompt?: string;
  readonly timeout?: number;
}

export interface FuzzyGrepToolArgs {
  readonly pattern?: string;
  readonly path?: string;
  readonly exclude?: string;
  readonly caseSensitive?: boolean;
  readonly context?: number;
  readonly limit?: number;
  readonly iterator?: string;
}

export interface FuzzyFindToolArgs {
  readonly pattern?: string;
  readonly path?: string;
  readonly limit?: number;
  readonly iterator?: string;
}

export type PluginToolArgs =
  | BrowserToolArgs
  | EditorToolArgs
  | GreperToolArgs
  | ReverieToolArgs
  | RunnerToolArgs
  | RunnerWaitToolArgs
  | RunnerAbortToolArgs
  | StartReviewLoopToolArgs
  | SubmitReviewToolArgs
  | WebsearchToolArgs
  | WebfetchToolArgs
  | FuzzyGrepToolArgs
  | FuzzyFindToolArgs;

// ── Schema wrapper & factory ──

export interface SchemaWrapper<S, T> {
  readonly raw: S;
  readonly _type: T;
}

export type Infer<W extends SchemaWrapper<unknown, unknown>> =
  W extends SchemaWrapper<unknown, infer T> ? T : never;

export interface SchemaFactory<S> {
  string(description: string): SchemaWrapper<S, string>;
  number(description: string): SchemaWrapper<S, number>;
  boolean(description: string): SchemaWrapper<S, boolean>;
  enum<const V extends readonly string[]>(
    values: V,
    description: string,
  ): SchemaWrapper<S, V[number]>;
  array<T>(
    items: SchemaWrapper<S, T>,
    description: string,
  ): SchemaWrapper<S, T[]>;
  object<const P extends Record<string, SchemaWrapper<S, unknown>>>(
    properties: P,
    description?: string,
  ): SchemaWrapper<S, { [K in keyof P]: Infer<P[K]> }>;
}

// ── Tool definition ──

export interface ToolDefinition<S> {
  readonly name: string;
  readonly description: string;
  readonly schema: SchemaWrapper<S, unknown>;
  readonly execute: (
    config: PluginToolConfiguration,
    args: PluginToolArgs,
  ) => string | Promise<string>;
  readonly condition?: (config: PluginToolConfiguration) => boolean;
}

// ── Tool-like structural interface (for wrappers, no ai dependency) ──

export interface ToolLike {
  name?: string;
  description?: string;
  parameters?: object;
  execute?: (...args: readonly unknown[]) => unknown;
  [key: string]: unknown;
}

export interface ToolWrapper {
  readonly targetTool: string;
  readonly wrapper: (tool: ToolLike, config: PluginToolConfiguration) => ToolLike;
}

// ── Shared helpers ──

export function requireWorkspaceId(
  config: PluginToolConfiguration,
  toolName: string,
): string {
  if (!config.workspaceId) {
    throw new Error(`${toolName} requires workspaceId`);
  }
  return config.workspaceId;
}

export function requireTaskService(
  config: PluginToolConfiguration,
  toolName: string,
): TaskServiceLike {
  if (!config.taskService) {
    throw new Error(`${toolName} requires taskService`);
  }
  return config.taskService;
}

export const FOREGROUND_WAIT_BACKGROUNDED_ERROR_NAME =
  "ForegroundWaitBackgroundedError";

export function isForegroundWaitBackgroundedError(
  error: unknown,
): boolean {
  return (
    error instanceof Error &&
    error.name === FOREGROUND_WAIT_BACKGROUNDED_ERROR_NAME
  );
}
