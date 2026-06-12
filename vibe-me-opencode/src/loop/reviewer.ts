import type { PluginInput } from '@opencode-ai/plugin';
import type {
  ReviewerRoundOutcome,
  ReviewResult,
  ReviewStore,
} from 'engine/review';
import {
  decideAfterRound,
  noResultOutcome,
  promptFailedOutcome,
  REVIEWER_NUDGE_PROMPT,
  resolvedOutcome,
  reviewerPromptParts,
  terminated,
} from 'engine/review';
import { promptWithAbort } from '../utils/abort-signal';
import {
  GRACE_TIMEOUT,
  MAX_REVIEWER_NUDGES,
  REVIEWER_GRACE_MS,
} from './constants';
import { createDeferred, type Deferred } from './types';

const ABORT_SENTINEL = Symbol('abort-sentinel');

export interface Clock {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

export const systemClock: Clock = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export interface ReviewerLoopDeps {
  promptFn?: typeof promptWithAbort;
  clock?: Clock;
  graceMs?: number;
}

type PromptRaceResult =
  | { type: 'result'; result: ReviewResult }
  | { type: 'prompt_done' }
  | { type: 'error'; error: unknown };

function checkAlreadyAborted(
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

function createPendingReview(
  reviewStore: ReviewStore,
  childID: string,
): Deferred<ReviewResult> {
  const deferred = createDeferred<ReviewResult>();
  reviewStore.setPendingReview(childID, (result: ReviewResult) =>
    deferred.resolve(result),
  );
  return deferred;
}

function prepareRoundAbortController(abortSignal: AbortSignal | undefined): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  abortSignal?.addEventListener('abort', onOuterAbort);
  return {
    controller,
    cleanup: () => abortSignal?.removeEventListener('abort', onOuterAbort),
  };
}

function cleanupRoundAbortController(
  cleanup: () => void,
  controller: AbortController,
): void {
  cleanup();
  controller.abort();
}

async function runPromptRound(
  client: PluginInput['client'],
  childID: string,
  nudgeCount: number,
  parts: Array<{ type: 'text'; text: string }>,
  iterAbort: AbortSignal,
  promptFn: typeof promptWithAbort,
  deferred: Deferred<ReviewResult>,
): Promise<PromptRaceResult> {
  const roundParts = reviewerPromptParts(
    nudgeCount,
    parts,
    REVIEWER_NUDGE_PROMPT,
  );

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
    iterAbort,
  )
    .then(() => ({ type: 'prompt_done' as const }))
    .catch((error: unknown) => ({ type: 'error' as const, error }));

  return Promise.race([
    deferred.promise.then((result) => ({ type: 'result' as const, result })),
    promptPromise,
  ]);
}

async function runGraceWindow(
  deferred: Deferred<ReviewResult>,
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

function resolveRacedOutcome(
  raced: PromptRaceResult,
  deferred: Deferred<ReviewResult>,
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
    (graceResult) =>
      graceResult === GRACE_TIMEOUT
        ? noResultOutcome
        : graceResult === ABORT_SENTINEL
          ? resolvedOutcome(terminated)
          : resolvedOutcome(graceResult),
  );
}

async function runOneRound(
  client: PluginInput['client'],
  childID: string,
  nudgeCount: number,
  parts: Array<{ type: 'text'; text: string }>,
  abortSignal: AbortSignal | undefined,
  deferred: Deferred<ReviewResult>,
  promptFn: typeof promptWithAbort,
  clock: Clock,
  graceMs: number,
): Promise<ReviewerRoundOutcome> {
  const { controller, cleanup } = prepareRoundAbortController(abortSignal);

  try {
    const raced = await runPromptRound(
      client,
      childID,
      nudgeCount,
      parts,
      controller.signal,
      promptFn,
      deferred,
    );

    return await resolveRacedOutcome(
      raced,
      deferred,
      clock,
      graceMs,
      controller.signal,
    );
  } finally {
    cleanupRoundAbortController(cleanup, controller);
  }
}

async function runReviewerLoop(
  client: PluginInput['client'],
  reviewStore: ReviewStore,
  childID: string,
  parts: Array<{ type: 'text'; text: string }>,
  abortSignal: AbortSignal | undefined,
  deferred: Deferred<ReviewResult>,
  promptFn: typeof promptWithAbort,
  clock: Clock,
  graceMs: number,
): Promise<ReviewResult> {
  let nudgeCount = 0;

  while (true) {
    const earlyResult = checkAlreadyAborted(reviewStore, childID, abortSignal);
    if (earlyResult) {
      return earlyResult;
    }

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
  if (earlyResult) {
    return earlyResult;
  }

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
