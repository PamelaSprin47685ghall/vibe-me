export { createRegistration, type PluginRegistration } from "./pluginRegistration.js";
export { getMcpServers } from "./mcpServers.js";

export type {
  ToolDefinition,
  ToolLike,
  ToolWrapper,
} from "./types/contract.js";
export type {
  ContextInjectorRegistration,
  PluginEvent,
  PluginEventHelpers,
  PluginEventHook,
  PluginSlashCommandDefinition,
  PluginToolConfiguration,
} from "./types/tool.js";
export type { HostDependencies, RuntimeHandle, TaskServiceLike, TaskCreateInput, TaskWaitOptions, TaskCreateResult } from "./types/deps.js";
export type { MuxAgentName, SubAgentRole, MuxPluginToolPolicy } from "./agent-tool-policy.js";
export { getPluginToolPolicy } from "./agent-tool-policy.js";
export { findCapsFiles, type CapsFileInfo } from "engine/caps";
export { buildCapsFileReadData, type CapsFileReadEntry } from "./context/capsFileReadMessages.js";
export { deduplicateReadOutputs } from "./dedup/index.js";
