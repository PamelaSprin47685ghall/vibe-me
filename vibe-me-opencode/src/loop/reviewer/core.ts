import type { PluginInput } from '@opencode-ai/plugin';
import type { ReviewResult, ReviewStore } from 'engine/review';
import { decideAfterRound } from 'engine/review';
import { promptWithAbort } from '../../utils/abort-signal';
import { MAX_REVIEWER_NUDGES, REVIEWER_GRACE_MS } from '../constants';
import { checkAlreadyAborted, createPendingReview } from './pending.js';
import { runOneRound } from './round.js';
import type { Clock, ReviewerLoopDeps } from './types.js';
import { systemClock } from './types.js';

async function runReviewerLoop(
  client: PluginInput['client'],
  reviewStore: ReviewStore,
  childID: string,
  parts: Array<{ type: 'text'; text: string }>,
  abortSignal: AbortSignal | undefined,
  deferred: import('../types').Deferred<ReviewResult>,
  promptFn: typeof promptWithAbort,
  clock: Clock,
  graceMs: number,
): Promise<ReviewResult> {
  let nudgeCount = 0;

  while (true) {
    const earlyResult = checkAlreadyAborted(reviewStore, childID, abortSignal);
    if (earlyResult) return earlyResult;

    const outcome = await runOneRound(
      client,
      childID,
      nudgeCount,
      parts,
      abortSignal,
      deferred,
      promptFn,
      clock,
      graceMs,
    );
    const decision = decideAfterRound(nudgeCount, outcome, MAX_REVIEWER_NUDGES);

    if (decision._tag === 'Finish') {
      reviewStore.deactivateReview(childID);
      return decision.result;
    }

    nudgeCount = decision.nudgeCount;
  }
}

export async function runReviewerWithNudge(
  client: PluginInput['client'],
  reviewStore: ReviewStore,
  childID: string,
  parts: Array<{ type: 'text'; text: string }>,
  abortSignal?: AbortSignal,
  deps?: ReviewerLoopDeps,
): Promise<ReviewResult> {
  const promptFn = deps?.promptFn ?? promptWithAbort;
  const clock = deps?.clock ?? systemClock;
  const graceMs = deps?.graceMs ?? REVIEWER_GRACE_MS;

  const earlyResult = checkAlreadyAborted(reviewStore, childID, abortSignal);
  if (earlyResult) return earlyResult;

  const deferred = createPendingReview(reviewStore, childID);

  return runReviewerLoop(
    client,
    reviewStore,
    childID,
    parts,
    abortSignal,
    deferred,
    promptFn,
    clock,
    graceMs,
  );
}
