import { describe, expect, it } from 'bun:test';
import { applyAgentConfig } from './agent-config.js';

describe('applyAgentConfig', () => {
  it('merges built-in agents and adds an orchestrator entry', () => {
    const opencodeConfig: Record<string, unknown> = {};
    applyAgentConfig(opencodeConfig, { 'test-mcp': { type: 'local' } });

    const agents = opencodeConfig.agent as Record<string, unknown>;

    expect(agents).toBeDefined();
    expect(agents.editor).toBeDefined();
    expect(agents.runner).toBeDefined();
    expect(agents.reverie).toBeDefined();
    expect(agents.reviewer).toBeDefined();
    expect(agents.greper).toBeDefined();
    expect(agents.browser).toBeDefined();
    expect(agents.orchestrator).toBeDefined();
    expect((agents.editor as Record<string, unknown>).mode).toBe('subagent');
  });

  it('reapplies user entries onto built-in defaults', () => {
    const opencodeConfig: Record<string, unknown> = {
      agent: { editor: { someUserField: 'x' } },
    };
    applyAgentConfig(opencodeConfig, {});

    const agents = opencodeConfig.agent as Record<string, unknown>;
    const editor = agents.editor as Record<string, unknown>;

    expect(editor.someUserField).toBe('x');
    expect(editor.mode).toBe('subagent');
    expect(editor.prompt).toBeDefined();
  });

  it('renames basher to runner and deletes the basher key', () => {
    const opencodeConfig: Record<string, unknown> = {
      agent: { basher: { customField: 'from-basher' } },
    };
    applyAgentConfig(opencodeConfig, {});

    const agents = opencodeConfig.agent as Record<string, unknown>;

    expect(agents.basher).toBeUndefined();

    const runner = agents.runner as Record<string, unknown>;
    expect(runner.customField).toBe('from-basher');
    expect(runner.mode).toBe('subagent');
  });

  it('injects mcps when opencodeConfig.mcp is absent', () => {
    const opencodeConfig: Record<string, unknown> = {};
    const mcps = { 'test-mcp': { type: 'local' } };
    applyAgentConfig(opencodeConfig, mcps);

    expect(opencodeConfig.mcp).toEqual(mcps);
    expect((opencodeConfig.mcp as Record<string, unknown>)['test-mcp']).toEqual({ type: 'local' });
  });

  it('injects mcps into an existing opencodeConfig.mcp', () => {
    const opencodeConfig: Record<string, unknown> = {
      mcp: { existing: { command: 'x' } },
    };
    const mcps = { 'test-mcp': { type: 'local' } };
    applyAgentConfig(opencodeConfig, mcps);

    const mcp = opencodeConfig.mcp as Record<string, unknown>;

    expect(mcp.existing).toEqual({ command: 'x' });
    expect(mcp['test-mcp']).toEqual({ type: 'local' });
  });

  it('constructs orchestrator with tools, permission, and empty mcps', () => {
    const opencodeConfig: Record<string, unknown> = {};
    applyAgentConfig(opencodeConfig, {});

    const orchestrator = (opencodeConfig.agent as Record<string, unknown>).orchestrator as Record<string, unknown>;

    expect(orchestrator).toBeDefined();
    expect(typeof orchestrator.tools).toBe('object');
    expect(typeof orchestrator.permission).toBe('object');
    expect(Array.isArray(orchestrator.mcps)).toBe(true);
    expect((orchestrator.mcps as unknown[]).length).toBe(0);
  });

  it('fills missing permission keys from role defaults', () => {
    const opencodeConfig: Record<string, unknown> = {};
    applyAgentConfig(opencodeConfig, {});

    const editor = (opencodeConfig.agent as Record<string, unknown>).editor as Record<string, unknown>;
    const permission = editor.permission as Record<string, string>;

    expect(typeof permission).toBe('object');
    expect(permission.read).toBe('allow');
    expect(permission.bash).toBe('deny');
    expect(permission['stealth-browser-mcp_star']).toBe('deny');
    expect(permission.runner_wait).toBe('deny');
    expect(permission.fuzzy_find).toBe('allow');
  });

  it('migrates stealth-browser-mcp_star to stealth-browser-mcp_*', () => {
    const opencodeConfig: Record<string, unknown> = {
      agent: { custom: { permission: { 'stealth-browser-mcp_star': 'allow' } } },
    };
    applyAgentConfig(opencodeConfig, {});

    const custom = (opencodeConfig.agent as Record<string, unknown>).custom as Record<string, unknown>;
    const permission = custom.permission as Record<string, string>;

    expect(permission['stealth-browser-mcp_*']).toBe('allow');
    expect(permission['stealth-browser-mcp_star']).toBe('allow');
  });

  it('uses Runner role defaults for unknown agent names', () => {
    const opencodeConfig: Record<string, unknown> = {
      agent: { unknown: {} },
    };
    applyAgentConfig(opencodeConfig, {});

    const unknown = (opencodeConfig.agent as Record<string, unknown>).unknown as Record<string, unknown>;
    const permission = unknown.permission as Record<string, string>;

    expect(typeof permission).toBe('object');
    expect(permission.bash).toBe('deny');
    expect(permission.glob).toBe('deny');
    expect(permission.fuzzy_find).toBe('deny');
    expect(permission['stealth-browser-mcp_star']).toBe('deny');
    expect(permission['stealth-browser-mcp_*']).toBe('deny');
    expect(permission.runner_wait).toBeUndefined();
    expect(permission.runner_abort).toBeUndefined();
    expect(unknown.tools).toBeUndefined();
  });
});
