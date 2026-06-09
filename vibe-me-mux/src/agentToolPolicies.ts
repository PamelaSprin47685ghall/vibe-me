import { AGENT_POLICIES } from "engine/agent-policy";
import { TOOL_NAME } from "./agentToolConstants.js";
import {
  FUZZY_TOOLS,
  DELEGATION_TOOLS,
  WEB_TOOLS,
  ORCHESTRATION_TOOLS,
  BASH_FAMILY_TOOLS,
  DESKTOP_INTERACTION_TOOLS,
  MUX_ADMIN_TOOLS,
  RUNNER_DISABLED_FILE_TOOLS,
} from "./agentToolGroups.js";
import { selectTools } from "./agentToolUtils.js";
import { buildAgentToolPolicies } from "./agentToolPolicy/builder.js";
import type { MuxAgentName, SubAgentRole, MuxPluginToolPolicy } from "./agentToolTypes.js";

export * from "./agentToolTypes.js";

export const EDITOR_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.editor.disabledTools;

export const GREPER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.greper.disabledTools;

export const RUNNER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = selectTools(
  TOOL_NAME.runner,
  RUNNER_DISABLED_FILE_TOOLS,
  TOOL_NAME.glob,
  FUZZY_TOOLS,
  DELEGATION_TOOLS,
  WEB_TOOLS,
  ORCHESTRATION_TOOLS,
  BASH_FAMILY_TOOLS,
  DESKTOP_INTERACTION_TOOLS,
  MUX_ADMIN_TOOLS,
);

export const BROWSER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.browser.disabledTools;

export const REVERIE_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.reverie.disabledTools;

export const REVIEWER_SUB_AGENT_DISABLED_TOOLS: readonly string[] = AGENT_POLICIES.reviewer.disabledTools;

export { buildAgentToolPolicies };

export function getPluginToolPolicy(
  agentId: string,
  role?: string,
): MuxPluginToolPolicy | undefined {
  const policies = buildAgentToolPolicies()[agentId as MuxAgentName];
  if (!policies) return undefined;
  if (role && role in policies) return policies[role as SubAgentRole];
  return policies.main;
}
