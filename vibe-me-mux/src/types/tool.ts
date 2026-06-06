import type { RuntimeHandle, TaskServiceLike } from "./deps.js";

export interface PluginToolConfiguration {
  readonly cwd: string;
  readonly workspaceId?: string;
  readonly runtime?: RuntimeHandle | null;
  readonly taskService?: TaskServiceLike;
  readonly abortSignal?: AbortSignal;
}

export interface ContextInjectorRegistration {
  inject: (projectPath: string) => Promise<string | null>;
}

export interface PluginEvent {
  readonly type: "stream-end" | "stream-abort" | "error";
  readonly workspaceId?: string;
  readonly properties?: object;
}

export interface PluginEventHelpers {
  nudge: (workspaceId: string, message: string) => Promise<boolean>;
  getTodos: (workspaceId: string) => Promise<Array<{ status: string }>>;
}

export type PluginEventHook = (
  event: PluginEvent,
  helpers?: PluginEventHelpers,
) => void | Promise<void>;
