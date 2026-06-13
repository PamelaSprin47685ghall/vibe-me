import { describe, expect, it } from 'vitest';
import {
  type AgentRole,
  AGENT_ROLES,
  CANONICAL_TOOL_NAMES,
} from '../types/agent-policy.js';
import {
  getEffectivePolicy,
  getEffectivePolicyFromString,
  getAgentTools,
  computeDefaultPermissions,
} from './index.js';

const ALL_ROLES: readonly AgentRole[] = AGENT_ROLES;

describe('getEffectivePolicy', () => {
  for (const role of ALL_ROLES) {
    it(`cross-validates ${role._tag} against getAgentTools and computeDefaultPermissions`, () => {
      const policy = getEffectivePolicy(role);
      const tools = getAgentTools(role);
      const permissions = computeDefaultPermissions(role);

      const expectedAllowed = CANONICAL_TOOL_NAMES.filter(
        (name) => tools.get(name)?._tag === 'Allow',
      );
      const expectedDenied = CANONICAL_TOOL_NAMES.filter(
        (name) => tools.get(name)?._tag === 'Deny',
      );
      const expectedDeniedPermissions = [...permissions.entries()]
        .filter(([, p]) => p._tag === 'Deny')
        .map(([name]) => name);

      expect(policy.role).toBe(role);
      expect(policy.tools).toBe(tools);
      expect(policy.permissions).toEqual(permissions);
      expect([...policy.allowedTools]).toEqual(expectedAllowed);
      expect([...policy.deniedTools]).toEqual(expectedDenied);
      expect([...policy.deniedPermissions]).toEqual(expectedDeniedPermissions);

      const toolSet = new Set([...policy.allowedTools, ...policy.deniedTools]);
      expect(toolSet.size).toBe([...policy.allowedTools].length + [...policy.deniedTools].length);
      expect(toolSet.size).toBe(CANONICAL_TOOL_NAMES.length);
    });
  }
});

describe('getEffectivePolicyFromString', () => {
  it('returns Ok for orchestrator', () => {
    const result = getEffectivePolicyFromString('orchestrator');
    expect(result._tag).toBe('Ok');
    if (result._tag === 'Ok') {
      expect(result.value.role._tag).toBe('Orchestrator');
    }
  });

  it('returns Err for bogus role', () => {
    const result = getEffectivePolicyFromString('bogus');
    expect(result._tag).toBe('Err');
  });
});