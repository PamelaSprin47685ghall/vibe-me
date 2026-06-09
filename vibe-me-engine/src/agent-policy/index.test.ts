import { describe, expect, it } from 'bun:test';
import {
  type AgentRole,
  type ToolPermission,
  orchestrator,
  editorRole,
  reviewerRole,
  greperRole,
  browserRole,
  runnerRole,
  allow,
  deny,
} from '../kernel/types.js';
import {
  getAgentTools,
  computeDefaultPermissions,
} from '../kernel/agent-policy.js';

/**
 * Apply default permission deny rules to a pre-filled Map, using ToolPermission
 * values directly (not Record<string, string>). Only sets keys that are not
 * already present (no-overwrite rule).
 */
function applyUniversalPermissionDeny(
  role: AgentRole,
  permissions: Map<string, ToolPermission>,
): void {
  const defaults = computeDefaultPermissions(role);
  for (const [name, perm] of defaults) {
    if (!permissions.has(name)) {
      permissions.set(name, perm);
    }
  }
}

/** Compute default permissions for a role on a fresh Map. */
function defaultedPermissions(role: AgentRole): Map<string, ToolPermission> {
  const map = new Map<string, ToolPermission>();
  applyUniversalPermissionDeny(role, map);
  return map;
}

describe('agent runtime policies', () => {
  it('keeps orchestrator delegation enabled and direct mutation disabled', () => {
    const tools = getAgentTools(orchestrator);

    expect(tools.get('read')).toBe(allow);
    expect(tools.get('editor')).toBe(allow);
    expect(tools.get('greper')).toBe(allow);
    expect(tools.get('runner')).toBe(allow);
    expect(tools.get('write')).toBe(deny);
    expect(tools.get('edit')).toBe(deny);
    expect(tools.get('runner_wait')).toBe(deny);
  });

  it('keeps browser and runner runtime boundaries narrow', () => {
    const browserTools = getAgentTools(browserRole);
    expect(browserTools.get('read')).toBe(allow);
    expect(browserTools.get('stealth_browser_mcp_star')).toBe(allow);
    expect(browserTools.get('webfetch')).toBe(deny);

    const runnerTools = getAgentTools(runnerRole);
    expect(runnerTools.get('runner_wait')).toBe(allow);
    expect(runnerTools.get('runner_abort')).toBe(allow);
    expect(runnerTools.get('runner')).toBe(deny);
    expect(runnerTools.get('read')).toBe(deny);
  });
});

describe('applyUniversalPermissionDeny', () => {
  it('does not deny permissions owned by their roles', () => {
    const orchPerms = defaultedPermissions(orchestrator);
    expect(orchPerms.has('question')).toBe(false);

    const browserPerms = defaultedPermissions(browserRole);
    expect(browserPerms.has('stealth-browser-mcp_star')).toBe(false);

    const runnerPerms = defaultedPermissions(runnerRole);
    expect(runnerPerms.has('runner_wait')).toBe(false);
    expect(runnerPerms.has('runner_abort')).toBe(false);

    const reviewerPerms = defaultedPermissions(reviewerRole);
    expect(reviewerPerms.has('submit_review_result')).toBe(false);
  });

  it('allows fuzzy tools for editor and greper by default', () => {
    for (const role of [editorRole, greperRole]) {
      const perms = defaultedPermissions(role);
      expect(perms.get('fuzzy_find')).toBe(allow);
      expect(perms.get('fuzzy_grep')).toBe(allow);
    }
  });

  it('denies restricted permissions by default', () => {
    const perms = defaultedPermissions(editorRole);
    expect(perms.get('bash')).toBe(deny);
    expect(perms.get('grep')).toBe(deny);
  });

  it('does not overwrite existing permission values', () => {
    const prefill = new Map<string, ToolPermission>([
      ['bash', allow],
      ['grep', allow],
      ['fuzzy_find', deny],
      ['fuzzy_grep', deny],
      ['question', allow],
      ['runner_wait', allow],
      ['runner_abort', allow],
      ['submit_review_result', allow],
      ['stealth-browser-mcp_star', allow],
    ]);
    const expected = new Map(prefill);

    applyUniversalPermissionDeny(editorRole, prefill);

    expect(prefill).toEqual(expected);
  });
});
