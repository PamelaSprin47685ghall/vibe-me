import { describe, expect, it } from 'vitest';
import {
  type AgentRole,
  type ToolPermission,
  orchestrator,
  editorRole,
  reviewerRole,
  greperRole,
  browserRole,
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
    expect(tools.get('executor')).toBe(allow);
    expect(tools.get('write')).toBe(deny);
    expect(tools.get('edit')).toBe(deny);
    expect(tools.get('patch')).toBe(deny);
  });

  it('lets editor use patch', () => {
    const tools = getAgentTools(editorRole);

    expect(tools.get('patch')).toBe(allow);
  });

  it('keeps browser runtime boundary narrow', () => {
    const browserTools = getAgentTools(browserRole);
    expect(browserTools.get('read')).toBe(allow);
    expect(browserTools.get('stealth_browser_mcp_star')).toBe(allow);
    expect(browserTools.get('webfetch')).toBe(deny);
    expect(browserTools.get('executor')).toBe(deny);
  });

  it('grants greper the executor for read-only exploration', () => {
    const greperTools = getAgentTools(greperRole);
    expect(greperTools.get('executor')).toBe(allow);
    expect(greperTools.get('write')).toBe(deny);
  });
});
