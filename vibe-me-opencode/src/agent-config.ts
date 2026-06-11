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

function applyRoleDefaults(name: string, agent: AgentEntry): void {
  const perm = (agent.permission as Record<string, string> | undefined) ?? {};
  const roleResult = agentRoleFromString(name);
  const effectiveRole: AgentRole = roleResult._tag === 'Ok' ? roleResult.value : { _tag: 'Runner' };
  for (const [key, value] of computeDefaultPermissions(effectiveRole)) {
    if (perm[key] === undefined) perm[key] = value._tag === 'Allow' ? 'allow' : 'deny';
  }
  if (perm['stealth-browser-mcp_star'] !== undefined) {
    perm['stealth-browser-mcp_*'] = perm['stealth-browser-mcp_star'];
  }
  agent.permission = perm;
  if (roleResult._tag === 'Ok') {
    agent.tools = mergeTools(agent.tools as AgentEntry | undefined, getAgentToolDefaults(name));
  }
}

export function applyAgentConfig(opencodeConfig: Record<string, unknown>, mcps: Record<string, unknown>): void {
  const userAgent = (opencodeConfig.agent as AgentMap) ?? {};
  const userOrchestrator = userAgent.orchestrator;

  const agents: AgentMap = {
    ...userAgent,
    ...getEditorConfig().agents,
    ...getRunnerConfig().agents,
    ...getReverieConfig().agents,
    ...getReviewerConfig().agents,
    ...getGreperConfig().agents,
    ...getBrowserConfig().agents,
    orchestrator: {
      ...userOrchestrator,
      tools: mergeTools(userOrchestrator?.tools as AgentEntry | undefined, getAgentToolDefaults('orchestrator')),
      permission: {
        ...getAgentPermissionDefaults('orchestrator'),
        ...(userOrchestrator?.permission as AgentEntry | undefined),
      },
      mcps: [],
    },
  };
  opencodeConfig.agent = agents;

  const renamedAgents = ['editor', 'greper', 'runner', 'reverie', 'reviewer', 'browser'];
  for (const name of renamedAgents) {
    const userEntry = userAgent[name];
    if (userEntry && agents[name]) Object.assign(agents[name], userEntry);
  }

  if (userAgent.basher) {
    if (agents.runner) Object.assign(agents.runner, userAgent.basher);
    delete agents.basher;
  }

  const configMcp = opencodeConfig.mcp as Record<string, unknown> | undefined;
  if (configMcp) Object.assign(configMcp, mcps);
  else opencodeConfig.mcp = { ...mcps };

  for (const [name, agent] of Object.entries(agents)) {
    if (typeof agent === 'object' && agent) applyRoleDefaults(name, agent);
  }
}
