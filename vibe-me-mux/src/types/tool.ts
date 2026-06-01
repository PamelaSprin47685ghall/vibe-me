import type { Tool } from "ai";

export interface ToolConfiguration {
  cwd: string;
  runtime: unknown;
  workspaceId?: string;
  taskService?: unknown;
  [key: string]: unknown;
}

export type ToolFactory = (config: ToolConfiguration) => Tool;

export interface ToolFactoryRegistration {
  name: string;
  factory: ToolFactory;
  condition?: (config: ToolConfiguration) => boolean;
}

export interface ToolWrapperRegistration {
  targetTool: string;
  wrapper: (tool: Tool, config: ToolConfiguration) => Tool;
}

export interface ContextInjectorRegistration {
  inject: (projectPath: string) => Promise<string | null>;
}

export interface AddonEvent {
  type: "stream-end" | "stream-abort" | "error";
  workspaceId?: string;
  properties?: Record<string, unknown>;
}

export interface AddonEventHelpers {
  nudge: (workspaceId: string, message: string) => Promise<boolean>;
}

export type AddonEventHook = (event: AddonEvent, helpers?: AddonEventHelpers) => void | Promise<void>;

export interface AddonRegistration {
  name: string;
  tools?: ToolFactoryRegistration[];
  wrappers?: ToolWrapperRegistration[];
  contextInjector?: ContextInjectorRegistration;
  eventHook?: AddonEventHook;
}

export interface TaskCreateInput {
  parentWorkspaceId: string;
  kind: "agent";
  agentId: string;
  modelString: string;
  thinkingLevel: string;
  prompt: string;
  title: string;
  experiments?: { toolPolicy?: { disabledTools?: string[] } };
}

export type TaskCreateResult =
  | { success: true; data: { taskId: string; kind: string; status: string } }
  | { success: false; error: string };

export interface TaskWaitOptions {
  requestingWorkspaceId: string;
  abortSignal?: AbortSignal;
}

export interface TaskWaitResult {
  reportMarkdown: string;
}

export interface TaskServiceLike {
  create(input: TaskCreateInput): Promise<TaskCreateResult>;
  waitForAgentReport(taskId: string, opts: TaskWaitOptions): Promise<TaskWaitResult>;
}

export const FOREGROUND_WAIT_BACKGROUNDED_ERROR_NAME = "ForegroundWaitBackgroundedError";

export function isForegroundWaitBackgroundedError(error: unknown): boolean {
  return error instanceof Error && error.name === FOREGROUND_WAIT_BACKGROUNDED_ERROR_NAME;
}

export function requireWorkspaceId(config: ToolConfiguration, toolName: string): string {
  if (!config.workspaceId) {
    throw new Error(`${toolName} requires workspaceId`);
  }
  return config.workspaceId;
}

export function requireTaskService(config: ToolConfiguration, toolName: string): TaskServiceLike {
  if (!config.taskService) {
    throw new Error(`${toolName} requires taskService`);
  }
  return config.taskService as TaskServiceLike;
}
