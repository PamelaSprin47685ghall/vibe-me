import { getAbortSignal } from './abort-signal';

export function extractToolContext(
  context: unknown,
  fallbackDirectory: string,
): {
  directory: string;
  sessionID: string | undefined;
  abortSignal: AbortSignal | undefined;
} {
  const safeFallback =
    typeof fallbackDirectory === 'string' ? fallbackDirectory : process.cwd();
  const directory =
    context &&
    typeof context === 'object' &&
    'directory' in context &&
    typeof (context as { directory: unknown }).directory === 'string'
      ? (context as { directory: string }).directory
      : safeFallback;
  const sessionID =
    context &&
    typeof context === 'object' &&
    'sessionID' in context &&
    typeof (context as { sessionID: unknown }).sessionID === 'string'
      ? (context as { sessionID: string }).sessionID
      : undefined;
  const abortSignal = getAbortSignal(context);
  return { directory, sessionID, abortSignal };
}
