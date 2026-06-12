import {
  type AgentRole,
  agentRoleFromString,
  computeDefaultPermissions,
} from 'engine/agent-policy';
import { getBrowserConfig } from './browser/index.js';
import { getEditorConfig } from './editor/index.js';
import { getGreperConfig } from './greper/index.js';
import { getReviewerConfig } from './loop/index.js';
import { getReverieConfig } from './reverie/index.js';
import { getRunnerConfig } from './runner/index.js';
import { getAgentPermissionDefaults, getAgentToolDefaults, mergeTools } from './agent-tools.js';

type AgentEntry = Record<string, unknown>;
type AgentMap = Record<string, AgentEntry | undefined>;

function withRoleDefaults(name: string, agent: AgentEntry): AgentEntry {
  const roleResult = agentRoleFromString(name);
  const effectiveRole: AgentRole = roleResult._tag === 'Ok' ? roleResult.value : { _tag: 'Runner' };
  const permission: Record<string, string> = { ...(agent.permission as Record<string, string> | undefined) };
  for (const [key, value] of computeDefaultPermissions(effectiveRole)) {
    if (permission[key] === undefined) permission[key] = value._tag === 'Allow' ? 'allow' : 'deny';
  }
  if (permission['stealth-browser-mcp_star'] !== undefined) {
    permission['stealth-browser-mcp_*'] = permission['stealth-browser-mcp_star'];
  }
  if (roleResult._tag === 'Ok') {
    return { ...agent, permission, tools: mergeTools(agent.tools as AgentEntry | undefined, getAgentToolDefaults(name)) };
  }
  return { ...agent, permission };
}

function buildFinalAgents(userAgent: AgentMap): AgentMap {
  const renamedAgents = ['editor', 'greper', 'runner', 'reverie', 'reviewer', 'browser'];
  const builtins: Record<string, AgentEntry | undefined> = {
    editor: getEditorConfig().agents.editor,
    runner: getRunnerConfig().agents.runner,
    reverie: getReverieConfig().agents.reverie,
    reviewer: getReviewerConfig().agents.reviewer,
    greper: getGreperConfig().agents.greper,
    browser: getBrowserConfig().agents.browser,
  };

  const makeBuiltin = (name: string): AgentEntry =>
    withRoleDefaults(name, {
      ...(builtins[name] ?? {}),
      ...(userAgent[name] ?? {}),
      ...(name === 'runner' ? (userAgent.basher ?? {}) : {}),
    });

  const makeOrchestrator = (): AgentEntry =>
    withRoleDefaults('orchestrator', {
      ...userAgent.orchestrator,
      tools: mergeTools(userAgent.orchestrator?.tools as AgentEntry | undefined, getAgentToolDefaults('orchestrator')),
      permission: {
        ...getAgentPermissionDefaults('orchestrator'),
        ...(userAgent.orchestrator?.permission as AgentEntry | undefined),
      },
      mcps: [],
    });

  const finalAgents: AgentMap = {};
  const added = new Set<string>();

  for (const [name, entry] of Object.entries(userAgent)) {
    if (name === 'basher' || entry === undefined) continue;
    finalAgents[name] = renamedAgents.includes(name)
      ? makeBuiltin(name)
      : name === 'orchestrator'
        ? makeOrchestrator()
        : withRoleDefaults(name, { ...entry });
    added.add(name);
  }

  for (const name of renamedAgents) {
    if (!added.has(name)) {
      finalAgents[name] = makeBuiltin(name);
      added.add(name);
    }
  }

  if (!added.has('orchestrator')) {
    finalAgents.orchestrator = makeOrchestrator();
  }

  return finalAgents;
}

export function applyAgentConfig(opencodeConfig: Record<string, unknown>, mcps: Record<string, unknown>): void {
  const userAgent = (opencodeConfig.agent as AgentMap) ?? {};
  const finalAgents = buildFinalAgents(userAgent);

  const configMcp = opencodeConfig.mcp as Record<string, unknown> | undefined;
  if (configMcp) Object.assign(configMcp, mcps);
  else opencodeConfig.mcp = { ...mcps };

  opencodeConfig.agent = finalAgents;
}
