import type { PluginToolConfiguration } from "./tool.js";

export type JsonSchema = {
  readonly type: "object";
  readonly properties: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
};

export type PluginToolArgs = Record<string, unknown>;

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

export function requireWorkspaceId(
  config: PluginToolConfiguration,
  toolName: string,
): string {
  if (!config.workspaceId) {
    throw new Error(`${toolName} requires workspaceId`);
  }
  return config.workspaceId;
}
