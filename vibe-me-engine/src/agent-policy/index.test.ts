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
} from '../types/agent-policy.js';
import {
  getAgentTools,
} from './index.js';

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
