import { isAbortError } from '../util/abort.js';

export interface SubagentHostAdapter {
  createSession(title: string, parentId?: string): Promise<{ id: string }>;
  promptSession(id: string, agent: string, textOrParts: string | Array<{ type: string; text: string }>, signal?: AbortSignal): Promise<void>;
  getSessionText(id: string): Promise<string>;
  abortSession(id: string): Promise<void>;
}

export async function runSubagentWorkflow(
  adapter: SubagentHostAdapter,
  options: {
    agent: string;
    title: string;
    textOrParts: string | Array<{ type: string; text: string }>;
    parentId?: string;
    signal?: AbortSignal;
  }
): Promise<string> {
  const { id: childID } = await adapter.createSession(options.title, options.parentId);
  if (!childID) {
    throw new Error('Failed to create child session');
  }

  try {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    // Handle prompt session with abort race
    let onAbort: (() => void) | undefined;
    const promptPromise = adapter.promptSession(childID, options.agent, options.textOrParts, options.signal);
    
    if (options.signal) {
      const abortPromise = new Promise<void>((_, reject) => {
        onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
        options.signal!.addEventListener('abort', onAbort);
      });

      await Promise.race([promptPromise, abortPromise]);
    } else {
      await promptPromise;
    }

    if (onAbort && options.signal) {
      options.signal.removeEventListener('abort', onAbort);
    }
  } catch (err) {
    if (isAbortError(err)) {
      try {
        await adapter.abortSession(childID);
      } catch (_) {}
      const text = await adapter.getSessionText(childID);
      return text ? `(aborted) ${text}` : '(aborted)';
    }
    throw err;
  }

  return (await adapter.getSessionText(childID)) || '(no output)';
}
