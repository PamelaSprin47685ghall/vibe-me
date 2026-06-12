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
}

export const SUBAGENT_REPORT_SEPARATOR = '\n---\n';

export async function delegateIntents(
  adapter: HostAdapter,
  role: AgentRole,
  title: string,
  intents: readonly string[],
): Promise<string> {
  const reports = await Promise.all(
    intents.map((prompt) => adapter.promptSubagent({ role, prompt, title })),
  );
  return reports.join(SUBAGENT_REPORT_SEPARATOR);
}

export function formatEditorIntent(intent: string, affectedFiles: readonly string[]): string {
  const fileList = affectedFiles.map((file) => `- ${file}`).join('\n');
  return `Intent: ${intent}\n\nAffected files:\n${fileList}`;
}

export interface ReverieFileSection {
  readonly file: string;
  readonly content: string | undefined;
}

export function buildReveriePrompt(
  sections: readonly ReverieFileSection[],
  intent: string,
): string {
  const rendered = sections.map(
    ({ file, content }) => `=== ${file} ===\n\n${content ?? '(skipped)'}`,
  );
  return `${rendered.join('\n')}\nQuestion:\n${intent}`;
}
