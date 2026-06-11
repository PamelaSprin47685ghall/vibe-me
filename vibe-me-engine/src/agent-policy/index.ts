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
  agentRoleFromString,
  agentRoleToString,
} from '../types/agent-policy.js';

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

export { agentRoleFromString, agentRoleToString, matchAgentRole };

export type { AgentRole, CanonicalToolName };
