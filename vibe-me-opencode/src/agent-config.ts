import {
  type AgentRole,
  agentRoleFromString,
  computeDefaultPermissions,
} from 'engine/agent-policy';
import {
  getAgentPermissionDefaults,
  getAgentToolDefaults,
  mergeTools,
} from './agent-tools.js';
import { getBrowserConfig } from './browser/index.js';
import { getEditorConfig } from './editor/index.js';
import { getExecutorSummarizerConfig } from './executor/index.js';
import { getGreperConfig } from './greper/index.js';
import { getReviewerConfig } from './loop/index.js';
import { getReverieConfig } from './reverie/index.js';

type AgentEntry = Record<string, unknown>;
type AgentMap = Record<string, AgentEntry | undefined>;

const RENAMED_AGENTS = [
  'editor',
  'greper',
  'reverie',
  'reviewer',
  'browser',
  'summarizer',
];

function migrateStealthBrowserPermission(
  permission: Record<string, string>,
): Record<string, string> {
  const star = permission['stealth-browser-mcp_star'];
  if (star === undefined) return permission;
  return { ...permission, 'stealth-browser-mcp_*': star };
}

function applyPermissionDefaults(
  permission: Record<string, string>,
  role: AgentRole,
): Record<string, string> {
  const result: Record<string, string> = { ...permission };
  for (const [key, value] of computeDefaultPermissions(role)) {
    if (result[key] === undefined)
      result[key] = value._tag === 'Allow' ? 'allow' : 'deny';
  }
  return migrateStealthBrowserPermission(result);
}

function withRoleDefaults(name: string, agent: AgentEntry): AgentEntry {
  const roleResult = agentRoleFromString(name);
  const effectiveRole: AgentRole =
    roleResult._tag === 'Ok' ? roleResult.value : { _tag: 'Reverie' };
  const basePermission =
    (agent.permission as Record<string, string> | undefined) ?? {};
  const permission = applyPermissionDefaults(basePermission, effectiveRole);

  if (roleResult._tag !== 'Ok') return { ...agent, permission };

  const toolDefaults = getAgentToolDefaults(name);
  if (toolDefaults._tag !== 'Ok') return { ...agent, permission };

  return {
    ...agent,
    permission,
    tools: mergeTools(
      agent.tools as AgentEntry | undefined,
      toolDefaults.value,
    ),
  };
}

function collectBuiltinAgents(): AgentMap {
  return {
    editor: getEditorConfig().agents.editor,
    summarizer: getExecutorSummarizerConfig().agents.summarizer,
    reverie: getReverieConfig().agents.reverie,
    reviewer: getReviewerConfig().agents.reviewer,
    greper: getGreperConfig().agents.greper,
    browser: getBrowserConfig().agents.browser,
  };
}

function buildBuiltinAgent(
  name: string,
  builtins: AgentMap,
  userAgent: AgentMap,
): AgentEntry {
  return withRoleDefaults(name, {
    ...(builtins[name] ?? {}),
    ...(userAgent[name] ?? {}),
  });
}

function buildOrchestratorAgent(userAgent: AgentMap): AgentEntry {
  const toolDefaults = getAgentToolDefaults('orchestrator');
  const permissionDefaults = getAgentPermissionDefaults('orchestrator');
  return withRoleDefaults('orchestrator', {
    ...userAgent.orchestrator,
    tools: mergeTools(
      userAgent.orchestrator?.tools as AgentEntry | undefined,
      toolDefaults._tag === 'Ok' ? toolDefaults.value : {},
    ),
    permission: {
      ...(permissionDefaults._tag === 'Ok' ? permissionDefaults.value : {}),
      ...(userAgent.orchestrator?.permission as AgentEntry | undefined),
    },
    mcps: [],
  });
}

function addMissingBuiltins(
  finalAgents: AgentMap,
  added: Set<string>,
  builtins: AgentMap,
  userAgent: AgentMap,
): AgentMap {
  const next: AgentMap = { ...finalAgents };
  for (const name of RENAMED_AGENTS) {
    if (added.has(name)) continue;
    next[name] = buildBuiltinAgent(name, builtins, userAgent);
    added.add(name);
  }
  return next;
}

function addMissingOrchestrator(
  finalAgents: AgentMap,
  added: Set<string>,
  userAgent: AgentMap,
): AgentMap {
  if (added.has('orchestrator')) return finalAgents;
  return { ...finalAgents, orchestrator: buildOrchestratorAgent(userAgent) };
}

function buildFinalAgents(userAgent: AgentMap): AgentMap {
  const builtins = collectBuiltinAgents();
  let finalAgents: AgentMap = {};
  const added = new Set<string>();

  for (const [name, entry] of Object.entries(userAgent)) {
    if (name === 'basher' || name === 'runner' || entry === undefined) continue;
    finalAgents[name] = RENAMED_AGENTS.includes(name)
      ? buildBuiltinAgent(name, builtins, userAgent)
      : name === 'orchestrator'
        ? buildOrchestratorAgent(userAgent)
        : withRoleDefaults(name, { ...entry });
    added.add(name);
  }

  finalAgents = addMissingBuiltins(finalAgents, added, builtins, userAgent);
  finalAgents = addMissingOrchestrator(finalAgents, added, userAgent);

  return finalAgents;
}

export function buildAgentConfig(
  userAgent: AgentMap,
  mcps: Record<string, unknown>,
): { agent: AgentMap; mcp: Record<string, unknown> } {
  return {
    agent: buildFinalAgents(userAgent),
    mcp: mcps,
  };
}

export function applyAgentConfig(
  opencodeConfig: Record<string, unknown>,
  mcps: Record<string, unknown>,
): Record<string, unknown> {
  const userAgent = (opencodeConfig.agent as AgentMap) ?? {};
  const configMcp = opencodeConfig.mcp as Record<string, unknown> | undefined;
  const mcp = configMcp ? { ...configMcp, ...mcps } : { ...mcps };

  return {
    ...opencodeConfig,
    ...buildAgentConfig(userAgent, mcp),
  };
}
