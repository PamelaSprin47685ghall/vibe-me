import { describe, expect, it } from 'bun:test';
import {
  AGENT_POLICIES,
  applyUniversalPermissionDeny,
  getAgentPolicy,
  type AgentRole,
} from './index.js';

const defaultedPermission = (agent: AgentRole, permission: Record<string, string> = {}) => {
  applyUniversalPermissionDeny(agent, permission);
  return permission;
};

describe('agent runtime policies', () => {
  it('keeps orchestrator delegation enabled and direct mutation disabled', () => {
    const policy = getAgentPolicy('orchestrator');

    expect(policy.tools.read).toBe(true);
    expect(policy.tools.editor).toBe(true);
    expect(policy.tools.greper).toBe(true);
    expect(policy.tools.runner).toBe(true);
    expect(policy.tools.write).toBe(false);
    expect(policy.tools.edit).toBe(false);
    expect(policy.tools.runner_wait).toBe(false);
  });

  it('keeps browser and runner runtime boundaries narrow', () => {
    expect(AGENT_POLICIES.browser.tools.read).toBe(true);
    expect(AGENT_POLICIES.browser.tools.stealth_browser_mcp_star).toBe(true);
    expect(AGENT_POLICIES.browser.tools.webfetch).toBe(false);

    expect(getAgentPolicy('runner').tools.runner_wait).toBe(true);
    expect(getAgentPolicy('runner').tools.runner_abort).toBe(true);
    expect(getAgentPolicy('runner').tools.runner).toBe(false);
    expect(getAgentPolicy('runner').tools.read).toBe(false);
  });
});

describe('applyUniversalPermissionDeny', () => {
  it('does not deny permissions owned by their roles', () => {
    expect(defaultedPermission('orchestrator').question).toBeUndefined();
    expect(defaultedPermission('browser')['stealth-browser-mcp_star']).toBeUndefined();

    const runnerPermission = defaultedPermission('runner');
    expect(runnerPermission.runner_wait).toBeUndefined();
    expect(runnerPermission.runner_abort).toBeUndefined();

    expect(defaultedPermission('reviewer').submit_review_result).toBeUndefined();
  });

  it('allows fuzzy tools for editor and greper by default', () => {
    for (const agent of ['editor', 'greper'] as const) {
      const permission = defaultedPermission(agent);
      expect(permission.fuzzy_find).toBe('allow');
      expect(permission.fuzzy_grep).toBe('allow');
    }
  });

  it('denies restricted permissions by default', () => {
    const permission = defaultedPermission('editor');
    expect(permission.bash).toBe('deny');
    expect(permission.grep).toBe('deny');
  });

  it('does not overwrite existing permission values', () => {
    const permission: Record<string, string> = {
      bash: 'allow',
      grep: 'allow',
      fuzzy_find: 'deny',
      fuzzy_grep: 'deny',
      question: 'allow',
      runner_wait: 'allow',
      runner_abort: 'allow',
      submit_review_result: 'allow',
      'stealth-browser-mcp_star': 'allow',
    };
    const expectedPermission = { ...permission };

    applyUniversalPermissionDeny('editor', permission);

    expect(permission).toEqual(expectedPermission);
  });
});
