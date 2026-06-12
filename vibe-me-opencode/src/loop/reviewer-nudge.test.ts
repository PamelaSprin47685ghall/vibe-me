import { describe, expect, it, mock } from 'bun:test';
import {
  accepted,
  REVIEWER_NUDGE_PROMPT,
  terminated,
  type ReviewResult,
  type ReviewStore,
} from 'engine/review';
import { runReviewerWithNudge } from './reviewer';

interface PromptCall {
  args: unknown;
  signal?: AbortSignal;
}

interface PromptController {
  resolve(): void;
  reject(error: unknown): void;
}

let promptCalls: PromptCall[] = [];
let promptControllers: PromptController[] = [];
let pendingResolve: ((result: ReviewResult) => void) | undefined;

function createDeferred<T>(): { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function queuePendingPrompt(): PromptController {
  const deferred = createDeferred<void>();
  promptControllers.push(deferred);
  return deferred;
}

function queueResolvedPrompt(): PromptController {
  const deferred = createDeferred<void>();
  deferred.resolve();
  promptControllers.push(deferred);
  return deferred;
}

function queueRejectedPrompt(error: unknown): PromptController {
  const deferred = createDeferred<void>();
  deferred.reject(error);
  promptControllers.push(deferred);
  return deferred;
}

async function mockPromptWithAbort(
  _client: unknown,
  args: unknown,
  signal?: AbortSignal,
): Promise<void> {
  promptCalls.push({ args, signal });
  const controller = promptControllers.shift();
  if (!controller) {
    throw new Error('unexpected prompt');
  }
  return controller.promise;
}


function makeReviewStore() {
  const deactivateReview = mock(() => {});
  const store: ReviewStore = {
    activateReview() {},
    deactivateReview,
    clearReviewSessions() {},
    tryLockReview() {
      return false;
    },
    unlockReview() {},
    setPendingReview(_sessionID, resolve) {
      pendingResolve = resolve;
    },
    resolvePendingReview() {
      return false;
    },
    getReviewTask() {
      return undefined;
    },
    getReviewState() {
      return undefined;
    },
    isReviewActive() {
      return false;
    },
    addChild() {},
  };
  return { store, deactivateReview };
}

function resetTestState() {
  promptCalls = [];
  promptControllers = [];
  pendingResolve = undefined;
}

const client = {} as unknown;
const childID = 'child-1';
const originalParts = [{ type: 'text' as const, text: 'initial prompt' }];

describe('runReviewerWithNudge', () => {
  it('returns terminated immediately when already aborted', async () => {
    resetTestState();
    const { store, deactivateReview } = makeReviewStore();
    const abortController = new AbortController();
    abortController.abort();

    const result = await runReviewerWithNudge(
      client,
      store,
      childID,
      originalParts,
      undefined,
      abortController.signal,
      { promptFn: mockPromptWithAbort, graceMs: 1 },
    );

    expect(result).toBe(terminated);
    expect(deactivateReview).toHaveBeenCalledTimes(1);
    expect(deactivateReview.mock.calls[0]).toEqual([childID]);
    expect(promptCalls.length).toBe(0);
    expect(pendingResolve).toBeUndefined();
  });

  it('returns the deferred result when review resolves', async () => {
    resetTestState();
    const { store, deactivateReview } = makeReviewStore();
    queuePendingPrompt();

    const runPromise = runReviewerWithNudge(client, store, childID, originalParts, undefined, undefined, { promptFn: mockPromptWithAbort, graceMs: 1 });
    await Promise.resolve();
    expect(pendingResolve).toBeDefined();
    pendingResolve!(accepted);

    const result = await runPromise;

    expect(result).toBe(accepted);
    expect(deactivateReview).toHaveBeenCalledTimes(1);
    expect(deactivateReview.mock.calls[0]).toEqual([childID]);
    expect(promptCalls.length).toBe(1);
    expect(promptCalls[0].args).toMatchObject({
      path: { id: childID },
      body: { agent: 'reviewer', parts: originalParts, tools: { submit_review_result: true } },
    });
  });

  it('returns terminated when the prompt rejects with a normal error', async () => {
    resetTestState();
    const { store, deactivateReview } = makeReviewStore();
    queueRejectedPrompt(new Error('prompt failed'));

    const result = await runReviewerWithNudge(client, store, childID, originalParts, undefined, undefined, { promptFn: mockPromptWithAbort, graceMs: 1 });

    expect(result).toBe(terminated);
    expect(deactivateReview).toHaveBeenCalledTimes(1);
    expect(deactivateReview.mock.calls[0]).toEqual([childID]);
    expect(promptCalls.length).toBe(1);
  });

  it('returns terminated when the prompt rejects with an abort error', async () => {
    resetTestState();
    const { store, deactivateReview } = makeReviewStore();
    queueRejectedPrompt(new DOMException('Aborted', 'AbortError'));

    const result = await runReviewerWithNudge(client, store, childID, originalParts, undefined, undefined, { promptFn: mockPromptWithAbort, graceMs: 1 });

    expect(result).toBe(terminated);
    expect(deactivateReview).toHaveBeenCalledTimes(1);
    expect(deactivateReview.mock.calls[0]).toEqual([childID]);
    expect(promptCalls.length).toBe(1);
  });

  it('returns the deferred result inside the grace window', async () => {
    resetTestState();
    const { store, deactivateReview } = makeReviewStore();
    queueResolvedPrompt();

    const runPromise = runReviewerWithNudge(client, store, childID, originalParts, undefined, undefined, { promptFn: mockPromptWithAbort, graceMs: 1 });
    await Promise.resolve();
    expect(pendingResolve).toBeDefined();
    pendingResolve!(accepted);

    const result = await runPromise;

    expect(result).toBe(accepted);
    expect(deactivateReview).toHaveBeenCalledTimes(1);
    expect(deactivateReview.mock.calls[0]).toEqual([childID]);
    expect(promptCalls.length).toBe(1);
  });

  it('returns terminated after max reviewer nudges', async () => {
    resetTestState();
    const { store, deactivateReview } = makeReviewStore();
    queueResolvedPrompt();
    queueResolvedPrompt();
    queueResolvedPrompt();

    const result = await runReviewerWithNudge(client, store, childID, originalParts, undefined, undefined, { promptFn: mockPromptWithAbort, graceMs: 1 });

    expect(result).toBe(terminated);
    expect(deactivateReview).toHaveBeenCalledTimes(1);
    expect(deactivateReview.mock.calls[0]).toEqual([childID]);
    expect(promptCalls.length).toBe(3);
  });

  it('uses original parts on round 0 and nudge prompt on later rounds', async () => {
    resetTestState();
    const { store } = makeReviewStore();
    queueResolvedPrompt();
    queueResolvedPrompt();
    queueResolvedPrompt();

    await runReviewerWithNudge(client, store, childID, originalParts, undefined, undefined, { promptFn: mockPromptWithAbort, graceMs: 1 });

    expect(promptCalls.length).toBe(3);
    expect(promptCalls[0].args).toMatchObject({
      path: { id: childID },
      body: { parts: originalParts },
    });
    expect(promptCalls[1].args).toMatchObject({
      path: { id: childID },
      body: {
        parts: [{ type: 'text', text: REVIEWER_NUDGE_PROMPT }],
      },
    });
    expect(promptCalls[2].args).toMatchObject({
      path: { id: childID },
      body: {
        parts: [{ type: 'text', text: REVIEWER_NUDGE_PROMPT }],
      },
    });
  });
});
