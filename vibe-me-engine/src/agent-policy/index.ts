// ---------------------------------------------------------------------------
// Merged agent-policy: full kernel logic + backward-compatible shims.
//
// All type/value imports come from '../types/agent-policy.js'.
// ---------------------------------------------------------------------------

import {
  type AgentRole,
  type CanonicalToolName,
  CANONICAL_TOOL_NAMES,
  type ToolPermission,
  type UniversalPermissionRule,
  allow,
  deny,
  matchAgentRole,
  denyAllRule,
  denyAllExceptRule,
  allowForRolesRule,
  computePermissions,
  AGENT_ROLES,
  agentRoleFromString,
  agentRoleToString,
} from '../types/agent-policy.js';

// ── Pure tool access: Map<CanonicalToolName, ToolPermission> ─────────

type ToolMap = ReadonlyMap<CanonicalToolName, ToolPermission>;

function createToolMap(enabled: readonly CanonicalToolName[]): ToolMap {
  const enabledSet = new Set<CanonicalToolName>(enabled);
  const entries: [CanonicalToolName, ToolPermission][] = CANONICAL_TOOL_NAMES.map(
    (name: CanonicalToolName) => [name, enabledSet.has(name) ? allow : deny] as const,
  );
  return new Map(entries);
}

// ── Per-role tool constants (compile-time verified via satisfies) ─

const ORCHESTRATOR_ENABLED = [
  'read', 'editor', 'greper', 'reverie', 'submit_review',
  'webfetch', 'websearch', 'runner', 'browser', 'glob',
] as const satisfies readonly CanonicalToolName[];

const EDITOR_ENABLED = [
  'read', 'write', 'edit', 'runner', 'glob',
  'fuzzy_find', 'fuzzy_grep',
] as const satisfies readonly CanonicalToolName[];

const REVIEWER_ENABLED = [
  'read', 'submit_review_result',
] as const satisfies readonly CanonicalToolName[];

const GREPER_ENABLED = [
  'read', 'runner', 'glob', 'fuzzy_find', 'fuzzy_grep',
] as const satisfies readonly CanonicalToolName[];

const BROWSER_ENABLED = [
  'read', 'stealth_browser_mcp_star',
] as const satisfies readonly CanonicalToolName[];

const RUNNER_ENABLED = [
  'runner_wait', 'runner_abort',
] as const satisfies readonly CanonicalToolName[];

const REVERIE_ENABLED: readonly CanonicalToolName[] = [];

export const ORCHESTRATOR_TOOLS: ToolMap = createToolMap(ORCHESTRATOR_ENABLED);
export const EDITOR_TOOLS: ToolMap = createToolMap(EDITOR_ENABLED);
export const REVIEWER_TOOLS: ToolMap = createToolMap(REVIEWER_ENABLED);
export const GREPER_TOOLS: ToolMap = createToolMap(GREPER_ENABLED);
export const BROWSER_TOOLS: ToolMap = createToolMap(BROWSER_ENABLED);
export const RUNNER_TOOLS: ToolMap = createToolMap(RUNNER_ENABLED);
export const REVERIE_TOOLS: ToolMap = createToolMap(REVERIE_ENABLED);

// ── Per-role tool access (exhaustive via matchAgentRole) ────────────

export function getAgentTools(role: AgentRole): ToolMap {
  return matchAgentRole(role, {
    Orchestrator: () => ORCHESTRATOR_TOOLS,
    Editor: () => EDITOR_TOOLS,
    Reviewer: () => REVIEWER_TOOLS,
    Greper: () => GREPER_TOOLS,
    Browser: () => BROWSER_TOOLS,
    Runner: () => RUNNER_TOOLS,
    Reverie: () => REVERIE_TOOLS,
  });
}

// ── Universal permission rules ──────────────────────────────────────

const SEARCH_ROLES: readonly AgentRole[] = [
  { _tag: 'Editor' },
  { _tag: 'Greper' },
];

export const UNIVERSAL_PERMISSION_RULES: readonly UniversalPermissionRule[] = [
  denyAllRule('bash'),
  denyAllExceptRule('stealth-browser-mcp_star', [{ _tag: 'Browser' }]),
  denyAllExceptRule('runner_wait', [{ _tag: 'Runner' }]),
  denyAllExceptRule('runner_abort', [{ _tag: 'Runner' }]),
  denyAllExceptRule('submit_review_result', [{ _tag: 'Reviewer' }]),
  denyAllExceptRule('glob', SEARCH_ROLES),
  allowForRolesRule('fuzzy_find', SEARCH_ROLES),
  denyAllExceptRule('fuzzy_find', SEARCH_ROLES),
  allowForRolesRule('fuzzy_grep', SEARCH_ROLES),
  denyAllExceptRule('fuzzy_grep', SEARCH_ROLES),
  denyAllRule('grep'),
  denyAllExceptRule('question', [{ _tag: 'Orchestrator' }]),
];

export function computeDefaultPermissions(
  agent: AgentRole,
): ReadonlyMap<string, ToolPermission> {
  return computePermissions(agent, UNIVERSAL_PERMISSION_RULES);
}

// ── Re-export role helpers for callers that need string ↔ AgentRole ─

export { agentRoleFromString, agentRoleToString, matchAgentRole };

export type { AgentRole, CanonicalToolName };

// ── Backward-compatible shape ───────────────────────────────────────

export interface AgentRuntimePolicy {
  readonly tools: Record<string, boolean>;
  readonly permissions: Record<string, 'allow' | 'deny'>;
  readonly disabledTools: readonly string[];
}

// ── Helpers ─────────────────────────────────────────────────────────

function permToBool(p: ToolPermission): boolean {
  return p._tag === 'Allow';
}

function permToString(p: ToolPermission): 'allow' | 'deny' {
  return p._tag === 'Allow' ? 'allow' : 'deny';
}

function buildPolicy(role: AgentRole): AgentRuntimePolicy {
  const toolMap = getAgentTools(role);
  const tools: Record<string, boolean> = {};
  for (const [n, p] of toolMap) tools[n] = permToBool(p);

  const permMap = computeDefaultPermissions(role);
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
  AGENT_ROLES.map((r: AgentRole) => [agentRoleToString(r), buildPolicy(r)]),
) as { readonly [K in AgentRoleName]: AgentRuntimePolicy };

/** String list of all agent role names — for tests and legacy callers. */
export const AGENT_ROLE_LIST: readonly string[] = AGENT_ROLES.map(agentRoleToString);

export function applyUniversalPermissionDeny(
  agent: string | AgentRole,
  permissions: Record<string, string>,
): void {
  if (typeof agent === 'string') {
    const r = agentRoleFromString(agent);
    if (r._tag === 'Err') throw new Error(r.error);
    agent = r.value;
  }
  const defaults = computeDefaultPermissions(agent);
  for (const [n, p] of defaults) {
    if (permissions[n] === undefined) {
      permissions[n] = permToString(p);
    }
  }
}
