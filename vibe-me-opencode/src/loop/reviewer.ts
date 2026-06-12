import type { PluginInput } from '@opencode-ai/plugin';
import {
  REVIEWER_NUDGE_PROMPT,
  terminated,
  decideAfterRound,
  reviewerPromptParts,
  resolvedOutcome,
  promptFailedOutcome,
  noResultOutcome,
} from 'engine/review';
import type { ReviewResult, ReviewStore, ReviewerRoundOutcome } from 'engine/review';
import { promptWithAbort } from '../utils/abort-signal';
import { GRACE_TIMEOUT, MAX_REVIEWER_NUDGES, REVIEWER_GRACE_MS } from './constants';
import { createDeferred } from './types';

export interface ReviewerLoopDeps {
  promptFn?: typeof promptWithAbort;
  graceMs?: number;
}

export async function runReviewerWithNudge(
  client: PluginInput['client'],
  reviewStore: ReviewStore,
  childID: string,
  parts: Array<{ type: 'text'; text: string }>,
  _directory?: string,
  abortSignal?: AbortSignal,
  deps?: ReviewerLoopDeps,
): Promise<ReviewResult> {
  const promptFn = deps?.promptFn ?? promptWithAbort;
  const graceMs = deps?.graceMs ?? REVIEWER_GRACE_MS;

  if (abortSignal?.aborted) {
    reviewStore.deactivateReview(childID);
    return terminated;
  }

  const deferred = createDeferred<ReviewResult>();
  reviewStore.setPendingReview(childID, (result: ReviewResult) => deferred.resolve(result));

  async function runOneRound(nudgeCount: number): Promise<ReviewerRoundOutcome> {
    const iterAbort = new AbortController();
    const onOuterAbort = () => iterAbort.abort();
    abortSignal?.addEventListener('abort', onOuterAbort);

    const roundParts = reviewerPromptParts(nudgeCount, parts, REVIEWER_NUDGE_PROMPT);

    const promptPromise = promptFn(
      client,
      {
        path: { id: childID },
        body: {
          agent: 'reviewer',
          parts: roundParts,
          tools: { submit_review_result: true },
        },
      },
      iterAbort.signal,
    )
      .then(() => ({ type: 'prompt_done' as const }))
      .catch((error: unknown) => ({ type: 'error' as const, error }));

    const raced = await Promise.race([
      deferred.promise.then((result) => ({ type: 'result' as const, result })),
      promptPromise,
    ]);

    abortSignal?.removeEventListener('abort', onOuterAbort);
    iterAbort.abort();

    if (raced.type === 'result') {
      return resolvedOutcome(raced.result);
    }

    if (raced.type === 'error') {
      return promptFailedOutcome;
    }

    const graceResult = await Promise.race([
      deferred.promise,
      new Promise<typeof GRACE_TIMEOUT>((resolve) =>
        setTimeout(() => resolve(GRACE_TIMEOUT), graceMs),
      ),
    ]);

    return graceResult !== GRACE_TIMEOUT
      ? resolvedOutcome(graceResult)
      : noResultOutcome;
  }

  let nudgeCount = 0;

  while (true) {
    if (abortSignal?.aborted) {
      reviewStore.deactivateReview(childID);
      return terminated;
    }

    const outcome = await runOneRound(nudgeCount);
    const decision = decideAfterRound(nudgeCount, outcome, MAX_REVIEWER_NUDGES);

    if (decision._tag === 'Finish') {
      reviewStore.deactivateReview(childID);
      return decision.result;
    }

    nudgeCount = decision.nudgeCount;
  }
}
