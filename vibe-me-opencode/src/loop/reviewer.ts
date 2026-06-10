import type { PluginInput } from '@opencode-ai/plugin';
import {
  deactivateReview,
  REVIEWER_NUDGE_PROMPT,
  setPendingReview,
} from 'engine/review';
import { isAbortError } from 'engine/util';
import { promptWithAbort } from '../utils/abort-signal';
import { extractSessionText } from '../utils/session-messages';
import { GRACE_TIMEOUT, MAX_REVIEWER_NUDGES, REVIEWER_GRACE_MS } from './constants';
import { createDeferred, type ReviewResult } from './types';

export async function runReviewerWithNudge(
  client: PluginInput['client'],
  childID: string,
  parts: Array<{ type: 'text'; text: string }>,
  directory?: string,
  abortSignal?: AbortSignal,
): Promise<ReviewResult> {
  if (abortSignal?.aborted) {
    deactivateReview(childID);
    return { accepted: false, feedback: 'Review aborted.', terminated: true };
  }

  const deferred = createDeferred<ReviewResult>();
  setPendingReview(childID, (result: ReviewResult) => deferred.resolve(result));

  let nudgeCount = 0;

  while (true) {
    if (abortSignal?.aborted) {
      deactivateReview(childID);
      return { accepted: false, feedback: 'Review aborted.', terminated: true };
    }

    const iterAbort = new AbortController();
    const onOuterAbort = () => iterAbort.abort();
    abortSignal?.addEventListener('abort', onOuterAbort);

    const promptPromise = promptWithAbort(
      client,
      {
        path: { id: childID },
        body: {
          agent: 'reviewer',
          parts:
            nudgeCount === 0
              ? parts
              : [{ type: 'text', text: REVIEWER_NUDGE_PROMPT }],
          tools: { submit_review_result: true },
        },
      },
      iterAbort.signal,
    )
      .then(() => ({ type: 'prompt_done' as const }))
      .catch((error: unknown) => ({ type: 'error' as const, error }));

    const result = await Promise.race([
      deferred.promise.then((r) => ({ type: 'result' as const, result: r })),
      promptPromise,
    ]);

    abortSignal?.removeEventListener('abort', onOuterAbort);
    iterAbort.abort();

    if (result.type === 'result') {
      deactivateReview(childID);
      return result.result;
    }

    if (result.type === 'error') {
      deactivateReview(childID);
      if (isAbortError(result.error)) {
        return {
          accepted: false,
          feedback: 'Review aborted.',
          terminated: true,
        };
      }
      return {
        accepted: false,
        feedback:
          result.error instanceof Error
            ? result.error.message
            : String(result.error),
        terminated: true,
      };
    }

    const graceResult = await Promise.race([
      deferred.promise,
      new Promise<typeof GRACE_TIMEOUT>((resolve) =>
        setTimeout(() => resolve(GRACE_TIMEOUT), REVIEWER_GRACE_MS),
      ),
    ]);

    if (graceResult !== GRACE_TIMEOUT) {
      deactivateReview(childID);
      return graceResult;
    }

    nudgeCount++;
    if (nudgeCount >= MAX_REVIEWER_NUDGES) {
      deactivateReview(childID);
      const text = await extractSessionText(client, childID, directory);
      return {
        accepted: false,
        feedback:
          text || 'Reviewer failed to complete review after multiple attempts.',
        terminated: true,
      };
    }
  }
}
