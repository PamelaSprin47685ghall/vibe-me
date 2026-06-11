import {
  type AgentRole,
  applyUniversalPermissionDeny,
  isAgentRole,
} from 'engine/agent-policy';
import { getBrowserConfig } from './browser/index.js';
import { getEditorConfig } from './editor/index.js';
import { getGreperConfig } from './greper/index.js';
import { getReviewerConfig } from './loop/index.js';
import { getReverieConfig } from './reverie/index.js';
import { getRunnerConfig } from './runner/index.js';
import { getAgentPermissionDefaults, getAgentToolDefaults, mergeTools } from './agent-tools.js';

export function applyAgentConfig(opencodeConfig: Record<string, unknown>, mcps: Record<string, unknown>): void {
  const userAgent = (opencodeConfig.agent as Record<string, unknown>) ?? {};

  opencodeConfig.agent = {
    ...userAgent,
    ...getEditorConfig().agents,
    ...getRunnerConfig().agents,
    ...getReverieConfig().agents,
    ...getReviewerConfig().agents,
    ...getGreperConfig().agents,
    ...getBrowserConfig().agents,
    orchestrator: {
      ...((opencodeConfig.agent as Record<string, unknown>)?.orchestrator as
        | Record<string, unknown>
        | undefined),
      tools: mergeTools(
        ((opencodeConfig.agent as Record<string, unknown>)?.orchestrator as
          | Record<string, unknown>
          | undefined)?.tools as Record<string, unknown> | undefined,
        getAgentToolDefaults('orchestrator'),
      ),
      permission: {
        ...getAgentPermissionDefaults('orchestrator'),
        ...(((opencodeConfig.agent as Record<string, unknown>)?.orchestrator as
          | Record<string, unknown>
          | undefined)?.permission as Record<string, unknown> | undefined),
      },
      mcps: [],
    },
  };

  const renameMap: Record<string, string> = {
    editor: 'editor',
    greper: 'greper',
    runner: 'runner',
    reverie: 'reverie',
    reviewer: 'reviewer',
    browser: 'browser',
  };
  for (const [oldName, newName] of Object.entries(renameMap)) {
    const userEntry = userAgent[oldName] as
      | Record<string, unknown>
      | undefined;
    if (!userEntry) continue;
    const agentEntry = (opencodeConfig.agent as Record<string, unknown>)[
      newName
    ] as Record<string, unknown> | undefined;
    if (agentEntry) Object.assign(agentEntry, userEntry);
  }

  if (userAgent.basher) {
    const runnerEntry = (opencodeConfig.agent as Record<string, unknown>)
      .runner as Record<string, unknown> | undefined;
    if (runnerEntry) Object.assign(runnerEntry, userAgent.basher);
    delete (opencodeConfig.agent as Record<string, unknown>).basher;
  }

  const configMcp = opencodeConfig.mcp as Record<string, unknown> | undefined;
  if (!configMcp) {
    opencodeConfig.mcp = { ...mcps };
  } else {
    Object.assign(configMcp, mcps);
  }

  const agentConfig = opencodeConfig.agent as Record<string, unknown>;
  for (const [name, entry] of Object.entries(agentConfig)) {
    if (typeof entry !== 'object' || !entry) continue;
    const agent = entry as Record<string, unknown>;
    const perm =
      (agent.permission as Record<string, string> | undefined) ?? {};
    if (isAgentRole(name)) {
      const defaults = getAgentPermissionDefaults(name);
      for (const [key, value] of Object.entries(defaults)) {
        if (perm[key] === undefined) perm[key] = value;
      }
      applyUniversalPermissionDeny(name, perm);
    } else {
      applyUniversalPermissionDeny('runner', perm);
    }
    if (perm['stealth-browser-mcp_star'] !== undefined) {
      perm['stealth-browser-mcp_*'] = perm['stealth-browser-mcp_star'];
    }
    agent.permission = perm;

    if (isAgentRole(name)) {
      agent.tools = mergeTools(
        agent.tools as Record<string, unknown> | undefined,
        getAgentToolDefaults(name),
      );
    }
  }
}
