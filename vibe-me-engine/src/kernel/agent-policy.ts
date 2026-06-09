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
} from './types.js';

// ── 5. AGENT_ROLES (re-export) ──────────────────────────────────────
export { AGENT_ROLES } from './types.js';

// ── 2. Pure tool access: Map<CanonicalToolName, ToolPermission> ─────

type ToolMap = ReadonlyMap<CanonicalToolName, ToolPermission>;

function createToolMap(enabled: readonly CanonicalToolName[]): ToolMap {
  const enabledSet = new Set<CanonicalToolName>(enabled);
  const entries: [CanonicalToolName, ToolPermission][] = CANONICAL_TOOL_NAMES.map(
    (name) => [name, enabledSet.has(name) ? allow : deny] as const,
  );
  return new Map(entries);
}

// ── 6. Per-role tool constants (compile-time verified via satisfies) ─

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

// ── 2 (cont). Pure tool access function (exhaustive via matchAgentRole) ─

export function getAgentTools(role: AgentRole): ToolMap {
  // matchAgentRole's parameter type enforces all 7 variants at compile time.
  // If AgentRole gains a new variant, the call below fails to type-check
  // because the handlers object is missing a key — no runtime fallback needed.
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

// ── 3 & 7. Universal permission rules — instances, not imperative loops ─
// Each rule is a typed value.  evaluateUniversalRule (defined in types.ts)
// exhaustively switches on rule._tag — no if/for chains.

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

// ── Convenience: compute default permissions from UNIVERSAL rules ───

export function computeDefaultPermissions(
  agent: AgentRole,
): ReadonlyMap<string, ToolPermission> {
  return computePermissions(agent, UNIVERSAL_PERMISSION_RULES);
}
