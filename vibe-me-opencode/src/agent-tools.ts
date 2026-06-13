import { ok, type Result } from 'engine';
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

function resolvePolicy(
  agent: AgentRole | string,
): Result<EffectivePolicy, string> {
  if (typeof agent === 'string') return getEffectivePolicyFromString(agent);
  return ok(getEffectivePolicy(agent));
}

export function getAgentPermissionDefaults(
  agent: AgentRole | string,
): Result<Record<string, string>, string> {
  const policy = resolvePolicy(agent);
  if (policy._tag === 'Err') return policy;
  const result: Record<string, string> = {};
  for (const [name, perm] of policy.value.permissions)
    result[name] = perm._tag === 'Allow' ? 'allow' : 'deny';
  return ok(result);
}

export function getAgentToolDefaults(
  agent: AgentRole | string,
): Result<ToolDefaults, string> {
  const policy = resolvePolicy(agent);
  if (policy._tag === 'Err') return policy;
  const result: Record<string, boolean> = {};
  for (const [name, perm] of policy.value.tools)
    result[name] = perm._tag === 'Allow';
  return ok(result);
}
