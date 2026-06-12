// HostAdapter contract: single source of truth for subagent tool policy
import { type AgentRole } from '../types/agent-policy.js';
import { getEffectivePolicy } from '../agent-policy/index.js';

export interface SubagentToolPolicy {
  readonly disabledTools: readonly string[];
}

export function subagentToolPolicy(role: AgentRole): SubagentToolPolicy {
  return { disabledTools: getEffectivePolicy(role).deniedTools };
}

export interface SubagentRequest {
  readonly role: AgentRole;
  readonly prompt: string;
  readonly title: string;
}

export interface HostAdapter {
  readonly promptSubagent: (request: SubagentRequest) => Promise<string>;
  readonly readLocalFile: (path: string) => Promise<string>;
  readonly abortTask: (taskId: string) => void;
}
