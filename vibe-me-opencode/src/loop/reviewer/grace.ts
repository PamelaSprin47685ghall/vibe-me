import type { ReviewResult } from 'engine/review';
import { GRACE_TIMEOUT } from '../constants';
import type { Clock } from './types.js';
import { ABORT_SENTINEL } from './types.js';

export async function runGraceWindow(
  deferred: import('../types').Deferred<ReviewResult>,
  clock: Clock,
  graceMs: number,
  roundAbort: AbortSignal,
): Promise<ReviewResult | typeof GRACE_TIMEOUT | typeof ABORT_SENTINEL> {
  let timeoutId: unknown;
  const timeoutPromise = new Promise<typeof GRACE_TIMEOUT>((resolve) => {
    timeoutId = clock.setTimeout(() => resolve(GRACE_TIMEOUT), graceMs);
  });

  let onAbort: (() => void) | undefined;
  const abortPromise = new Promise<typeof ABORT_SENTINEL>((resolve) => {
    onAbort = () => resolve(ABORT_SENTINEL);
    roundAbort.addEventListener('abort', onAbort);
    if (roundAbort.aborted) {
      onAbort();
    }
  });

  try {
    return await Promise.race([deferred.promise, timeoutPromise, abortPromise]);
  } finally {
    clock.clearTimeout(timeoutId);
    if (onAbort) {
      roundAbort.removeEventListener('abort', onAbort);
    }
  }
}
