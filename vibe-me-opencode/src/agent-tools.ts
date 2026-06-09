import {
  AGENT_POLICIES,
  type AgentRole,
  agentRoleFromString,
  agentRoleToString,
  getAgentTools,
} from 'engine/agent-policy';

export type ToolDefaults = Record<string, boolean>;

export function mergeTools(
  current: Record<string, unknown> | undefined,
  defaults: ToolDefaults,
): Record<string, boolean> {
  const merged: Record<string, boolean> = { ...defaults };
  for (const [key, value] of Object.entries(current ?? {})) {
    if (typeof value === 'boolean') merged[key] = value;
  }
  return merged;
}

export function getAgentPermissionDefaults(agent: AgentRole | string): Record<string, string> {
  const key = typeof agent === 'string' ? agent : agentRoleToString(agent);
  return { ...AGENT_POLICIES[key as keyof typeof AGENT_POLICIES].permissions };
}

export function getAgentToolDefaults(agent: AgentRole | string): ToolDefaults {
  const role: AgentRole =
    typeof agent === 'string'
      ? (() => {
          const r = agentRoleFromString(agent);
          if (r._tag === 'Err') throw new Error(r.error);
          return r.value;
        })()
      : agent;
  const toolMap = getAgentTools(role);
  const result: Record<string, boolean> = {};
  for (const [name, perm] of toolMap) result[name] = perm._tag === 'Allow';
  return result;
}
