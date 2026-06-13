import type { ReviewerRoundOutcome, ReviewResult } from 'engine/review';
import {
  noResultOutcome,
  promptFailedOutcome,
  resolvedOutcome,
  terminated,
} from 'engine/review';
import { GRACE_TIMEOUT } from '../constants';
import { runGraceWindow } from './grace.js';
import type { Clock, PromptRaceResult } from './types.js';
import { ABORT_SENTINEL } from './types.js';

export function resolveRacedOutcome(
  raced: PromptRaceResult,
  deferred: import('../types').Deferred<ReviewResult>,
  clock: Clock,
  graceMs: number,
  iterAbort: AbortSignal,
): Promise<ReviewerRoundOutcome> {
  if (raced.type === 'result') {
    return Promise.resolve(resolvedOutcome(raced.result));
  }
  if (raced.type === 'error') {
    return Promise.resolve(promptFailedOutcome);
  }
  return runGraceWindow(deferred, clock, graceMs, iterAbort).then(
    (graceResult) => {
      if (graceResult === GRACE_TIMEOUT) return noResultOutcome;
      if (graceResult === ABORT_SENTINEL) return resolvedOutcome(terminated);
      return resolvedOutcome(graceResult);
    },
  );
}
