import { agentRoleFromString } from 'engine/agent-policy';
import { getAgentToolDefaults, mergeTools } from '../../agent-tools.js';
import { lookupChildAgent } from '../../utils/child-agent.js';
import type { ChatMessageInput } from './types.js';

export function resolveAgent(input: ChatMessageInput): string {
  return input.agent ?? lookupChildAgent(input.sessionID) ?? 'orchestrator';
}

function applyStealthBrowserRestrictions(
  tools: Record<string, boolean>,
  agent: string,
  existingTools: Record<string, unknown> | undefined,
): Record<string, boolean> {
  if (agent === 'browser') return tools;

  const next = { ...tools };
  if (existingTools) {
    for (const key of Object.keys(existingTools)) {
      if (key.startsWith('stealth-browser-mcp_')) next[key] = false;
    }
  }
  next['stealth-browser-mcp_*'] = false;
  return next;
}

export function resolveChatTools(
  agent: string,
  existingTools: Record<string, unknown> | undefined,
): Record<string, boolean> | undefined {
  if (agentRoleFromString(agent)._tag !== 'Ok') return undefined;
  const defaults = getAgentToolDefaults(agent);
  if (defaults._tag !== 'Ok') return undefined;
  const merged = mergeTools(existingTools, defaults.value);
  return applyStealthBrowserRestrictions(merged, agent, existingTools);
}
