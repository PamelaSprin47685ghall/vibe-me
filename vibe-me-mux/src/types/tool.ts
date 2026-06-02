import type { Tool } from "ai";

import type { TaskServiceLike } from "./deps";

/**
 * Slim context passed to every plugin tool. The host's full
 * `ToolConfiguration` is structurally a superset of this, so it can
 * be passed through without casts or duplication.
 */
export interface PluginToolConfiguration {
  cwd: string;
  workspaceId?: string;
  /** Opaque host runtime handle. Plugin only forwards it to host helpers. */
  runtime?: unknown;
  /** Host task service — the plugin only calls the contract methods on it. */
  taskService?: TaskServiceLike;
  /** Allow extra host fields without breaking the structural match. */
  [key: string]: unknown;
}

export type ToolFactory = (config: PluginToolConfiguration) => Tool;

export interface ToolFactoryRegistration {
  name: string;
  factory: ToolFactory;
  condition?: (config: PluginToolConfiguration) => boolean;
}

export interface ToolWrapperRegistration {
  targetTool: string;
  wrapper: (tool: Tool, config: PluginToolConfiguration) => Tool;
}

export interface ContextInjectorRegistration {
  inject: (projectPath: string) => Promise<string | null>;
}

export interface PluginEvent {
  type: "stream-end" | "stream-abort" | "error";
  workspaceId?: string;
  properties?: Record<string, unknown>;
}

export interface PluginEventHelpers {
  nudge: (workspaceId: string, message: string) => Promise<boolean>;
}

export type PluginEventHook = (event: PluginEvent, helpers?: PluginEventHelpers) => void | Promise<void>;

export const FOREGROUND_WAIT_BACKGROUNDED_ERROR_NAME = "ForegroundWaitBackgroundedError";

export function isForegroundWaitBackgroundedError(error: unknown): boolean {
  return error instanceof Error && error.name === FOREGROUND_WAIT_BACKGROUNDED_ERROR_NAME;
}

export function requireWorkspaceId(config: PluginToolConfiguration, toolName: string): string {
  if (!config.workspaceId) {
    throw new Error(`${toolName} requires workspaceId`);
  }
  return config.workspaceId;
}

export function requireTaskService(config: PluginToolConfiguration, toolName: string): TaskServiceLike {
  if (!config.taskService) {
    throw new Error(`${toolName} requires taskService`);
  }
  return config.taskService;
}
