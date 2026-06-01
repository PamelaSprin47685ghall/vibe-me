import type { Tool } from "ai";

import type { ToolFactory, ToolConfiguration } from "./tools";

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
