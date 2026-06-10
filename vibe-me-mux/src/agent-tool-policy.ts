import { AGENT_POLICIES, agentRoleFromString } from "engine/agent-policy";

export interface MuxPluginToolPolicy {
  add: string[];
  remove: string[];
}

export type MuxAgentName = "exec" | "explore";
export type SubAgentRole = "editor" | "greper" | "runner" | "browser" | "reverie" | "reviewer";

export function getPluginToolPolicy(
  _agentId: string,
  role?: string,
): MuxPluginToolPolicy | undefined {
  const policyRole = role || "orchestrator";
  const r = agentRoleFromString(policyRole);
  if (r._tag === "Err") return undefined;

  const policy = AGENT_POLICIES[policyRole.toLowerCase() as keyof typeof AGENT_POLICIES];
  if (!policy) return undefined;

  return {
    add: [],
    remove: [...policy.disabledTools],
  };
}
