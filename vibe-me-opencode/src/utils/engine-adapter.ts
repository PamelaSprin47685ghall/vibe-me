import type { PluginInput } from '@opencode-ai/plugin';
import { agentRoleToString } from 'engine/agent-policy';
import type { HostAdapter } from 'engine';
import { runSubagent } from './session';

export function createEngineAdapter(
  client: PluginInput['client'],
  context: { directory: string; sessionID?: string; abortSignal?: AbortSignal },
): HostAdapter {
  return {
    promptSubagent: ({ role, prompt, title }) =>
      runSubagent(client, {
        agent: agentRoleToString(role),
        title,
        parts: [{ type: 'text', text: prompt }],
        directory: context.directory,
        sessionID: context.sessionID,
        abortSignal: context.abortSignal,
      }),
  };
}
