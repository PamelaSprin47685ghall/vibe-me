import { getAbortSignal } from './abort-signal';

export function extractToolContext(
  context: unknown,
  fallbackDirectory: string,
): {
  directory: string;
  sessionID: string | undefined;
  abortSignal: AbortSignal | undefined;
} {
  const directory =
    context && typeof context === 'object' && 'directory' in context
      ? (context as { directory: string }).directory
      : fallbackDirectory;
  const sessionID =
    context && typeof context === 'object' && 'sessionID' in context
      ? (context as { sessionID: string }).sessionID
      : undefined;
  const abortSignal = getAbortSignal(context);
  return { directory, sessionID, abortSignal };
}
