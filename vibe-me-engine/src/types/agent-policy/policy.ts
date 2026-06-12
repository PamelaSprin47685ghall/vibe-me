import { type AgentRole } from './role.js';
import { type ToolPermission, deny, allow } from './permission.js';

export type ToolPolicy = {
  readonly tools: Readonly<Record<string, ToolPermission>>;
  readonly disabledTools: readonly string[];
};

export function createToolPolicy(params: {
  readonly tools: Readonly<Record<string, ToolPermission>>;
  readonly disabledTools?: readonly string[];
}): ToolPolicy {
  return {
    tools: params.tools,
    disabledTools: params.disabledTools ?? [],
  };
}

export const CANONICAL_TOOL_NAMES = [
  'read',
  'write',
  'edit',
  'runner',
  'glob',
  'fuzzy_find',
  'fuzzy_grep',
  'grep',
  'editor',
  'greper',
  'reverie',
  'submit_review',
  'submit_review_result',
  'todo_read',
  'todo_write',
  'webfetch',
  'websearch',
  'browser',
  'task',
  'runner_wait',
  'runner_abort',
  'stealth_browser_mcp_star',
] as const;

export type CanonicalToolName = (typeof CANONICAL_TOOL_NAMES)[number];

export type DenyAllRule = {
  readonly _tag: 'DenyAll';
  readonly permissionName: string;
};

export type DenyAllExceptRule = {
  readonly _tag: 'DenyAllExcept';
  readonly permissionName: string;
  readonly excludedRoles: readonly AgentRole[];
};

export type AllowForRolesRule = {
  readonly _tag: 'AllowForRoles';
  readonly permissionName: string;
  readonly includedRoles: readonly AgentRole[];
};

export type UniversalPermissionRule =
  | DenyAllRule
  | DenyAllExceptRule
  | AllowForRolesRule;

export function denyAllRule(permissionName: string): DenyAllRule {
  return { _tag: 'DenyAll', permissionName };
}

export function denyAllExceptRule(
  permissionName: string,
  excludedRoles: readonly AgentRole[],
): DenyAllExceptRule {
  return { _tag: 'DenyAllExcept', permissionName, excludedRoles };
}

export function allowForRolesRule(
  permissionName: string,
  includedRoles: readonly AgentRole[],
): AllowForRolesRule {
  return { _tag: 'AllowForRoles', permissionName, includedRoles };
}

/** Evaluate a single permission rule against an agent. Returns the permission
 *  value if the rule applies, or null if the rule does not match. */
export function evaluateUniversalRule(
  rule: UniversalPermissionRule,
  agent: AgentRole,
): { readonly permissionName: string; readonly value: ToolPermission } | null {
  switch (rule._tag) {
    case 'DenyAll':
      return { permissionName: rule.permissionName, value: deny };
    case 'DenyAllExcept': {
      const excluded = rule.excludedRoles.some((r) => r._tag === agent._tag);
      return excluded
        ? null
        : { permissionName: rule.permissionName, value: deny };
    }
    case 'AllowForRoles': {
      const included = rule.includedRoles.some((r) => r._tag === agent._tag);
      return included
        ? { permissionName: rule.permissionName, value: allow }
        : null;
    }
  }
}

/** Compute default permissions for an agent by applying all universal rules
 *  in order (first-write-wins). */
export function computePermissions(
  agent: AgentRole,
  rules: readonly UniversalPermissionRule[],
): ReadonlyMap<string, ToolPermission> {
  const result = new Map<string, ToolPermission>();
  for (const rule of rules) {
    const evaluated = evaluateUniversalRule(rule, agent);
    if (evaluated !== null && !result.has(evaluated.permissionName)) {
      result.set(evaluated.permissionName, evaluated.value);
    }
  }
  return result;
}
