import type { PluginInput } from '@opencode-ai/plugin';
import { registerChildAgent, resolveSubsessionParentID } from './child-agent';
import { isAbortError, promptWithAbort } from './abort-signal';
import { extractSessionText } from './session-messages';

export interface SubagentParams {
  agent: string;
  title: string;
  parts: Array<{ type: 'text'; text: string }>;
  directory: string;
  sessionID?: string;
  abortSignal?: AbortSignal;
}

export async function runSubagent(
  client: PluginInput['client'],
  params: SubagentParams,
): Promise<string> {
  const parentID = resolveSubsessionParentID(params.sessionID);
  const createResult = await client.session.create({
    query: { directory: params.directory },
    body: {
      parentID,
      title: params.title,
    },
  });
  const childID = createResult.data?.id;
  if (!childID) return 'Failed to create child session';
  registerChildAgent(childID, params.agent, parentID);

  try {
    await promptWithAbort(
      client,
      {
        path: { id: childID },
        body: {
          agent: params.agent,
          parts: params.parts,
        },
      },
      params.abortSignal,
    );
  } catch (err) {
    if (isAbortError(err)) {
      try {
        client.session.abort({ path: { id: childID } });
      } catch (_) {}
      const text = await extractSessionText(client, childID, params.directory);
      return text ? `(aborted) ${text}` : '(aborted)';
    }
    throw err;
  }

  return (
    (await extractSessionText(client, childID, params.directory)) ||
    '(no output)'
  );
}
