import type { TaskServiceLike } from "./deps.js";
import type { PluginToolConfiguration } from "./tool.js";

export type { PluginToolConfiguration };

export type JsonSchema = {
  readonly type: "object";
  readonly properties: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
};

// ── Tool argument types ──

export interface BrowserToolArgs {
  readonly intent: string;
}

export interface EditorToolArgs {
  readonly intents: readonly string[];
}

export interface GreperToolArgs {
  readonly intents: readonly string[];
}

export interface ReverieToolArgs {
  readonly intent: string;
  readonly files: readonly string[];
}

export interface RunnerToolArgs {
  readonly language: "shell" | "python" | "javascript";
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

export interface WriteToolArgs {
  readonly file_path: string;
  readonly content: string;
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

export interface ReadToolArgs {
  readonly path: string;
  readonly offset?: number;
  readonly limit?: number;
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
  | WriteToolArgs
  | FuzzyGrepToolArgs
  | FuzzyFindToolArgs
  | ReadToolArgs;

// ── Tool definition ──

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: JsonSchema;
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
  parameters?: JsonSchema;
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
