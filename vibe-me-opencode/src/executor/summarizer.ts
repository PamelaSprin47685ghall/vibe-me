import type { PluginInput } from '@opencode-ai/plugin';
import { extractSessionText } from '../utils/session-messages';

export async function createSummarizerSession(
  client: PluginInput['client'],
  sessionID: string | undefined,
  directory: string,
): Promise<{ childID: string; parentID: string | undefined }> {
  const result = await client.session.create({
    query: { directory },
    body: { parentID: sessionID, title: 'Executor summary' },
  });
  const childID = result.data?.id;
  if (!childID) throw new Error('Failed to create summarizer session');
  return { childID, parentID: sessionID };
}

export async function awaitSummarizerReport(
  client: PluginInput['client'],
  childID: string,
  prompt: string,
  directory: string,
  abortSignal: AbortSignal | undefined,
): Promise<string> {
  const promptPromise = client.session.prompt({
    path: { id: childID },
    body: { agent: 'summarizer', parts: [{ type: 'text', text: prompt }] },
  });

  if (abortSignal) {
    await Promise.race([
      promptPromise,
      new Promise<never>((_, reject) => {
        if (abortSignal.aborted)
          reject(new DOMException('Aborted', 'AbortError'));
        else
          abortSignal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
      }),
    ]);
  } else {
    await promptPromise;
  }

  const text = await extractSessionText(client, childID, directory);
  return text || '(no summary returned)';
}
