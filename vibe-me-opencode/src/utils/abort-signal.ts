import type { PluginInput } from '@opencode-ai/plugin';
import { isAbortError } from 'engine/util';

export { isAbortError };

export class AbortError extends DOMException {
  constructor() {
    super('Aborted', 'AbortError');
  }
}

export function getAbortSignal(context: unknown): AbortSignal | undefined {
  if (typeof context !== 'object' || context === null) return undefined;
  const maybeSignal = (context as Record<string, unknown>).abort;
  if (
    typeof maybeSignal === 'object' &&
    maybeSignal !== null &&
    'addEventListener' in maybeSignal &&
    'removeEventListener' in maybeSignal &&
    'aborted' in maybeSignal
  ) {
    return maybeSignal as AbortSignal;
  }
  return undefined;
}

export async function promptWithAbort(
  client: PluginInput['client'],
  args: Parameters<PluginInput['client']['session']['prompt']>[0],
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) {
    throw new AbortError();
  }
  if (!signal) {
    await client.session.prompt(args);
    return;
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const onAbort = () => {
      if (settled) return;
      settled = true;
      reject(new AbortError());
    };

    signal.addEventListener('abort', onAbort);

    client.session
      .prompt(args)
      .then(() => {
        if (!settled) {
          settled = true;
          resolve();
        }
      })
      .catch((err: unknown) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
      })
      .finally(() => {
        signal.removeEventListener('abort', onAbort);
      });
  });
}
