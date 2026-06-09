// ---------------------------------------------------------------------------
// Re-export shim: agent-policy → kernel/agent-policy + kernel/types
//
// New callers should import directly from `../kernel/agent-policy.js` or
// `../kernel/types.js`.  This module exists only to avoid breaking existing
// imports from `agent-policy/index.js`.
// ---------------------------------------------------------------------------

// ── Pure kernel re-exports ────────────────────────────────────────────────
export {
  AGENT_ROLES,
  ORCHESTRATOR_TOOLS,
  EDITOR_TOOLS,
  REVIEWER_TOOLS,
  GREPER_TOOLS,
  BROWSER_TOOLS,
  RUNNER_TOOLS,
  REVERIE_TOOLS,
  getAgentTools,
  UNIVERSAL_PERMISSION_RULES,
  computeDefaultPermissions,
} from '../kernel/agent-policy.js';

// Keep backward-compatible string-based API for callers that pass strings
export type { AgentRole, CanonicalToolName } from '../kernel/types.js';
export { agentRoleFromString, agentRoleToString, matchAgentRole } from '../kernel/types.js';

// ── Local imports (aliased to avoid shadowing re-exports) ─────────────────
import {
  type AgentRole,
  type ToolPermission,
  agentRoleFromString,
  agentRoleToString,
} from '../kernel/types.js';

import {
  getAgentTools as resolveTools,
  computeDefaultPermissions as resolvePermissions,
  AGENT_ROLES as ALL_ROLES,
} from '../kernel/agent-policy.js';

// ── Backward-compatible shape (matches old AgentRuntimePolicy interface) ──
export interface AgentRuntimePolicy {
  readonly tools: Record<string, boolean>;
  readonly permissions: Record<string, 'allow' | 'deny'>;
  readonly disabledTools: readonly string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

function permToBool(p: ToolPermission): boolean {
  return p._tag === 'Allow';
}

function permToString(p: ToolPermission): 'allow' | 'deny' {
  return p._tag === 'Allow' ? 'allow' : 'deny';
}

function buildPolicy(role: AgentRole): AgentRuntimePolicy {
  const toolMap = resolveTools(role);
  const tools: Record<string, boolean> = {};
  for (const [n, p] of toolMap) tools[n] = permToBool(p);

  const permMap = resolvePermissions(role);
  const permissions: Record<string, 'allow' | 'deny'> = {};
  for (const [n, p] of permMap) permissions[n] = permToString(p);

  const disabledTools: string[] = [];
  for (const [n, p] of toolMap) {
    if (p._tag === 'Deny') disabledTools.push(n);
  }

  return { tools, permissions, disabledTools };
}

export function isAgentRole(name: string): boolean {
  return agentRoleFromString(name)._tag === 'Ok';
}

export function getAgentPolicy(role: string | AgentRole): AgentRuntimePolicy {
  if (typeof role === 'string') {
    const r = agentRoleFromString(role);
    if (r._tag === 'Err') throw new Error(r.error);
    role = r.value;
  }
  return buildPolicy(role);
}

type AgentRoleName = Lowercase<AgentRole['_tag']>;

/** Pre-computed policy map for callers that index by role name string. */
export const AGENT_POLICIES: { readonly [K in AgentRoleName]: AgentRuntimePolicy } = Object.fromEntries(
  ALL_ROLES.map((r) => [agentRoleToString(r), buildPolicy(r)]),
) as { readonly [K in AgentRoleName]: AgentRuntimePolicy };

/** String list of all agent role names — for tests and legacy callers. */
export const AGENT_ROLE_LIST: readonly string[] = ALL_ROLES.map(agentRoleToString);

export function applyUniversalPermissionDeny(
  agent: string | AgentRole,
  permissions: Record<string, string>,
): void {
  if (typeof agent === 'string') {
    const r = agentRoleFromString(agent);
    if (r._tag === 'Err') throw new Error(r.error);
    agent = r.value;
  }
  const defaults = resolvePermissions(agent);
  for (const [n, p] of defaults) {
    if (permissions[n] === undefined) {
      permissions[n] = permToString(p);
    }
  }
}
