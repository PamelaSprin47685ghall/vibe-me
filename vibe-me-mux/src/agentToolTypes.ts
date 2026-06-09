import type { MuxPluginToolPolicy } from "./types/tool.js";

export type { MuxPluginToolPolicy };

export type MuxAgentName = "exec" | "explore";

export type SubAgentRole = "editor" | "greper" | "runner" | "browser" | "reverie" | "reviewer";

export type MuxAgentToolPolicies = Record<MuxAgentName, {
  main: MuxPluginToolPolicy;
} & Partial<Record<SubAgentRole, MuxPluginToolPolicy>>>;
