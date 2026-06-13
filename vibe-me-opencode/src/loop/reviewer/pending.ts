import type { ReviewResult, ReviewStore } from 'engine/review';
import { terminated } from 'engine/review';
import type { Deferred } from '../types';
import { createDeferred } from '../types';

export function checkAlreadyAborted(
  reviewStore: ReviewStore,
  childID: string,
  abortSignal: AbortSignal | undefined,
): ReviewResult | undefined {
  if (abortSignal?.aborted) {
    reviewStore.deactivateReview(childID);
    return terminated;
  }
  return undefined;
}

export function createPendingReview(
  reviewStore: ReviewStore,
  childID: string,
): Deferred<ReviewResult> {
  const deferred = createDeferred<ReviewResult>();
  reviewStore.setPendingReview(childID, (result: ReviewResult) =>
    deferred.resolve(result),
  );
  return deferred;
}
