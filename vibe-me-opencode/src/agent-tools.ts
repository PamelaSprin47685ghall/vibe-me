import {
  type AgentRole,
  type EffectivePolicy,
  getEffectivePolicy,
  getEffectivePolicyFromString,
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

function resolvePolicy(agent: AgentRole | string): EffectivePolicy {
  if (typeof agent === 'string') {
    const result = getEffectivePolicyFromString(agent);
    if (result._tag === 'Err') throw new Error(result.error);
    return result.value;
  }
  return getEffectivePolicy(agent);
}

export function getAgentPermissionDefaults(
  agent: AgentRole | string,
): Record<string, string> {
  const { permissions } = resolvePolicy(agent);
  const result: Record<string, string> = {};
  for (const [name, perm] of permissions)
    result[name] = perm._tag === 'Allow' ? 'allow' : 'deny';
  return result;
}

export function getAgentToolDefaults(agent: AgentRole | string): ToolDefaults {
  const { tools } = resolvePolicy(agent);
  const result: Record<string, boolean> = {};
  for (const [name, perm] of tools) result[name] = perm._tag === 'Allow';
  return result;
}
