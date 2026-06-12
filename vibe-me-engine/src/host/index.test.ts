import { describe, expect, it } from 'bun:test';
import { AGENT_ROLES } from '../types/agent-policy.js';
import { getEffectivePolicy } from '../agent-policy/index.js';
import { subagentToolPolicy } from './index.js';

describe('subagentToolPolicy', () => {
  for (const role of AGENT_ROLES) {
    it(`matches getEffectivePolicy deniedTools for ${role._tag}`, () => {
      expect(subagentToolPolicy(role).disabledTools).toEqual(
        getEffectivePolicy(role).deniedTools,
      );
    });
  }
});
