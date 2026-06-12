import {
  type AgentRole,
  type CanonicalToolName,
  CANONICAL_TOOL_NAMES,
  type ToolPermission,
  type UniversalPermissionRule,
  allow,
  deny,
  matchAgentRole,
  matchToolPermission,
  denyAllRule,
  denyAllExceptRule,
  allowForRolesRule,
  computePermissions,
  agentRoleFromString,
  agentRoleToString,
} from '../types/agent-policy.js';
import { type Result, ok, err, matchResult } from '../types/general.js';

export { CANONICAL_TOOL_NAMES };
export type { AgentRole, CanonicalToolName };

export type ToolMap = ReadonlyMap<CanonicalToolName, ToolPermission>;

function createToolMap(enabled: readonly CanonicalToolName[]): ToolMap {
  const enabledSet = new Set<CanonicalToolName>(enabled);
  const entries: [CanonicalToolName, ToolPermission][] = CANONICAL_TOOL_NAMES.map(
    (name: CanonicalToolName) => [name, enabledSet.has(name) ? allow : deny] as const,
  );
  return new Map(entries);
}

const ORCHESTRATOR_ENABLED = [
  'read', 'editor', 'greper', 'reverie', 'submit_review',
  'webfetch', 'websearch', 'executor', 'browser', 'glob',
  'todowrite',
] as const satisfies readonly CanonicalToolName[];

const EDITOR_ENABLED = [
  'read', 'write', 'edit', 'glob',
  'fuzzy_find', 'fuzzy_grep',
] as const satisfies readonly CanonicalToolName[];

const REVIEWER_ENABLED = [
  'read', 'submit_review_result',
] as const satisfies readonly CanonicalToolName[];

const GREPER_ENABLED = [
  'read', 'executor', 'glob', 'fuzzy_find', 'fuzzy_grep',
] as const satisfies readonly CanonicalToolName[];

const BROWSER_ENABLED = [
  'read', 'stealth_browser_mcp_star',
] as const satisfies readonly CanonicalToolName[];

const REVERIE_ENABLED: readonly CanonicalToolName[] = [];

export const ORCHESTRATOR_TOOLS: ToolMap = createToolMap(ORCHESTRATOR_ENABLED);
export const EDITOR_TOOLS: ToolMap = createToolMap(EDITOR_ENABLED);
export const REVIEWER_TOOLS: ToolMap = createToolMap(REVIEWER_ENABLED);
export const GREPER_TOOLS: ToolMap = createToolMap(GREPER_ENABLED);
export const BROWSER_TOOLS: ToolMap = createToolMap(BROWSER_ENABLED);
export const REVERIE_TOOLS: ToolMap = createToolMap(REVERIE_ENABLED);

export function getAgentTools(role: AgentRole): ToolMap {
  return matchAgentRole(role, {
    Orchestrator: () => ORCHESTRATOR_TOOLS,
    Editor: () => EDITOR_TOOLS,
    Reviewer: () => REVIEWER_TOOLS,
    Greper: () => GREPER_TOOLS,
    Browser: () => BROWSER_TOOLS,
    Reverie: () => REVERIE_TOOLS,
  });
}

const SEARCH_ROLES: readonly AgentRole[] = [
  { _tag: 'Editor' },
  { _tag: 'Greper' },
];

export const UNIVERSAL_PERMISSION_RULES: readonly UniversalPermissionRule[] = [
  denyAllRule('bash'),
  denyAllExceptRule('stealth-browser-mcp_star', [{ _tag: 'Browser' }]),
  denyAllExceptRule('submit_review_result', [{ _tag: 'Reviewer' }]),
  denyAllExceptRule('glob', SEARCH_ROLES),
  allowForRolesRule('fuzzy_find', SEARCH_ROLES),
  denyAllExceptRule('fuzzy_find', SEARCH_ROLES),
  allowForRolesRule('fuzzy_grep', SEARCH_ROLES),
  denyAllExceptRule('fuzzy_grep', SEARCH_ROLES),
  denyAllRule('grep'),
  denyAllExceptRule('question', [{ _tag: 'Orchestrator' }]),
  denyAllExceptRule('todowrite', [{ _tag: 'Orchestrator' }]),
];

export function computeDefaultPermissions(
  agent: AgentRole,
): ReadonlyMap<string, ToolPermission> {
  return computePermissions(agent, UNIVERSAL_PERMISSION_RULES);
}

export interface EffectivePolicy {
  readonly role: AgentRole;
  readonly tools: ToolMap;
  readonly permissions: ReadonlyMap<string, ToolPermission>;
  readonly allowedTools: readonly string[];
  readonly deniedTools: readonly string[];
  readonly deniedPermissions: readonly string[];
}

export function getEffectivePolicy(role: AgentRole): EffectivePolicy {
  const tools = getAgentTools(role);
  const permissions = computeDefaultPermissions(role);
  const allowedTools: string[] = [];
  const deniedTools: string[] = [];
  for (const name of CANONICAL_TOOL_NAMES) {
    const perm = tools.get(name);
    if (perm === undefined) continue;
    matchToolPermission(perm, {
      Allow: () => { allowedTools.push(name); },
      Deny: () => { deniedTools.push(name); },
    });
  }
  const deniedPermissions: string[] = [];
  for (const [name, perm] of permissions) {
    if (perm._tag === 'Deny') deniedPermissions.push(name);
  }
  return {
    role,
    tools,
    permissions,
    allowedTools,
    deniedTools,
    deniedPermissions,
  };
}

export function getEffectivePolicyFromString(value: string): Result<EffectivePolicy, string> {
  return matchResult<AgentRole, string, Result<EffectivePolicy, string>>(agentRoleFromString(value), {
    Ok: (role) => ok(getEffectivePolicy(role)),
    Err: (error) => err(error),
  });
}

export { agentRoleFromString, agentRoleToString, matchAgentRole };
