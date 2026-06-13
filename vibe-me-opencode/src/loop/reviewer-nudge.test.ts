import { accepted, REVIEWER_NUDGE_PROMPT, terminated } from 'engine/review';
import { describe, expect, it } from 'vitest';
import { runReviewerWithNudge } from './reviewer';
import {
  childID,
  client,
  createFakeClock,
  makeReviewStore,
  mockPromptWithAbort,
  originalParts,
  pendingResolve,
  promptCalls,
  queuePendingPrompt,
  queueRejectedPrompt,
  queueResolvedPrompt,
  resetTestState,
  tick,
} from './reviewer-nudge.test-helpers';

describe('runReviewerWithNudge', () => {
  it('returns terminated immediately when already aborted', async () => {
    resetTestState();
    const fakeClock = createFakeClock();
    const { store, deactivateReview } = makeReviewStore();
    const abortController = new AbortController();
    abortController.abort();

    const result = await runReviewerWithNudge(
      client,
      store,
      childID,
      originalParts,
      abortController.signal,
      { promptFn: mockPromptWithAbort, clock: fakeClock, graceMs: 100 },
    );

    expect(result).toBe(terminated);
    expect(deactivateReview).toHaveBeenCalledTimes(1);
    expect(deactivateReview.mock.calls[0]).toEqual([childID]);
    expect(promptCalls.length).toBe(0);
    expect(pendingResolve).toBeUndefined();
  });

  it('returns the deferred result when review resolves', async () => {
    resetTestState();
    const fakeClock = createFakeClock();
    const { store, deactivateReview } = makeReviewStore();
    queuePendingPrompt();

    const runPromise = runReviewerWithNudge(
      client,
      store,
      childID,
      originalParts,
      undefined,
      { promptFn: mockPromptWithAbort, clock: fakeClock, graceMs: 100 },
    );
    await Promise.resolve();
    expect(pendingResolve).toBeDefined();
    pendingResolve?.(accepted);

    const result = await runPromise;

    expect(result).toBe(accepted);
    expect(deactivateReview).toHaveBeenCalledTimes(1);
    expect(deactivateReview.mock.calls[0]).toEqual([childID]);
    expect(promptCalls.length).toBe(1);
    expect(promptCalls[0].args).toMatchObject({
      path: { id: childID },
      body: {
        agent: 'reviewer',
        parts: originalParts,
        tools: { submit_review_result: true },
      },
    });
  });

  it('returns terminated when the prompt rejects with a normal error', async () => {
    resetTestState();
    const fakeClock = createFakeClock();
    const { store, deactivateReview } = makeReviewStore();
    queueRejectedPrompt(new Error('prompt failed'));

    const result = await runReviewerWithNudge(
      client,
      store,
      childID,
      originalParts,
      undefined,
      { promptFn: mockPromptWithAbort, clock: fakeClock, graceMs: 100 },
    );

    expect(result).toBe(terminated);
    expect(deactivateReview).toHaveBeenCalledTimes(1);
    expect(deactivateReview.mock.calls[0]).toEqual([childID]);
    expect(promptCalls.length).toBe(1);
  });

  it('returns terminated when the prompt rejects with an abort error', async () => {
    resetTestState();
    const fakeClock = createFakeClock();
    const { store, deactivateReview } = makeReviewStore();
    queueRejectedPrompt(new DOMException('Aborted', 'AbortError'));

    const result = await runReviewerWithNudge(
      client,
      store,
      childID,
      originalParts,
      undefined,
      { promptFn: mockPromptWithAbort, clock: fakeClock, graceMs: 100 },
    );

    expect(result).toBe(terminated);
    expect(deactivateReview).toHaveBeenCalledTimes(1);
    expect(deactivateReview.mock.calls[0]).toEqual([childID]);
    expect(promptCalls.length).toBe(1);
  });

  it('returns the deferred result inside the grace window', async () => {
    resetTestState();
    const fakeClock = createFakeClock();
    const { store, deactivateReview } = makeReviewStore();
    queueResolvedPrompt();

    const runPromise = runReviewerWithNudge(
      client,
      store,
      childID,
      originalParts,
      undefined,
      { promptFn: mockPromptWithAbort, clock: fakeClock, graceMs: 100 },
    );
    await Promise.resolve();
    expect(pendingResolve).toBeDefined();
    pendingResolve?.(accepted);

    const result = await runPromise;

    expect(result).toBe(accepted);
    expect(deactivateReview).toHaveBeenCalledTimes(1);
    expect(deactivateReview.mock.calls[0]).toEqual([childID]);
    expect(promptCalls.length).toBe(1);
  });

  it('returns terminated when aborted during the grace window', async () => {
    resetTestState();
    const fakeClock = createFakeClock();
    const { store, deactivateReview } = makeReviewStore();
    queueResolvedPrompt();

    const abortController = new AbortController();
    const runPromise = runReviewerWithNudge(
      client,
      store,
      childID,
      originalParts,
      abortController.signal,
      { promptFn: mockPromptWithAbort, clock: fakeClock, graceMs: 100 },
    );

    await Promise.resolve();
    await Promise.resolve();
    abortController.abort();

    const result = await runPromise;

    expect(result).toBe(terminated);
    expect(deactivateReview).toHaveBeenCalledTimes(1);
    expect(deactivateReview.mock.calls[0]).toEqual([childID]);
    expect(promptCalls.length).toBe(1);
  });

  it('returns terminated after max reviewer nudges', async () => {
    resetTestState();
    const fakeClock = createFakeClock();
    const { store, deactivateReview } = makeReviewStore();
    queueResolvedPrompt();
    queueResolvedPrompt();
    queueResolvedPrompt();

    const runPromise = runReviewerWithNudge(
      client,
      store,
      childID,
      originalParts,
      undefined,
      { promptFn: mockPromptWithAbort, clock: fakeClock, graceMs: 100 },
    );

    await tick(fakeClock);
    await tick(fakeClock);
    await tick(fakeClock);

    const result = await runPromise;

    expect(result).toBe(terminated);
    expect(deactivateReview).toHaveBeenCalledTimes(1);
    expect(deactivateReview.mock.calls[0]).toEqual([childID]);
    expect(promptCalls.length).toBe(3);
  });

  it('uses original parts on round 0 and nudge prompt on later rounds', async () => {
    resetTestState();
    const fakeClock = createFakeClock();
    const { store } = makeReviewStore();
    queueResolvedPrompt();
    queueResolvedPrompt();
    queueResolvedPrompt();

    const runPromise = runReviewerWithNudge(
      client,
      store,
      childID,
      originalParts,
      undefined,
      { promptFn: mockPromptWithAbort, clock: fakeClock, graceMs: 100 },
    );

    await tick(fakeClock);
    await tick(fakeClock);
    await tick(fakeClock);

    await runPromise;

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
