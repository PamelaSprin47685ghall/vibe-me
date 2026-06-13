import { createReviewStore } from 'engine/review';
import { describe, expect, test, vi } from 'vitest';
import {
  createDeferred,
  createSubmitReviewResultTool,
  createSubmitReviewTool,
} from './index';
import { createMockContext } from './test-utils';

describe('createSubmitReviewResultTool', () => {
  test('resolves pending result with null feedback (accept)', async () => {
    const reviewStore = createReviewStore();
    reviewStore.activateReview('reviewer-1', 'task', 0);
    reviewStore.tryLockReview('reviewer-1');
    const d = createDeferred<any>();
    reviewStore.setPendingReview('reviewer-1', (result) => d.resolve(result));

    const reviewTool = createSubmitReviewResultTool(reviewStore);
    const result = await (reviewTool as any).execute(
      { feedback: null },
      { sessionID: 'reviewer-1' },
    );

    expect(result).toContain('accepted');
  });

  test('resolves pending result with feedback (reject)', async () => {
    const reviewStore = createReviewStore();
    reviewStore.activateReview('reviewer-1', 'task', 0);
    reviewStore.tryLockReview('reviewer-1');
    const d = createDeferred<any>();
    reviewStore.setPendingReview('reviewer-1', (result) => d.resolve(result));

    const reviewTool = createSubmitReviewResultTool(reviewStore);
    const result = await (reviewTool as any).execute(
      { feedback: 'Fix the error handling' },
      { sessionID: 'reviewer-1' },
    );

    expect(result).toContain('rejected');
  });

  test('returns error when no pending review', async () => {
    const reviewStore = createReviewStore();
    const reviewTool = createSubmitReviewResultTool(reviewStore);
    const result = await (reviewTool as any).execute(
      { feedback: null },
      { sessionID: 'unknown-session' },
    );

    expect(result).toContain('No pending review');
  });

  test('treats empty string as null (accept)', async () => {
    const reviewStore = createReviewStore();
    reviewStore.activateReview('reviewer-1', 'task', 0);
    reviewStore.tryLockReview('reviewer-1');
    const d = createDeferred<any>();
    reviewStore.setPendingReview('reviewer-1', (result) => d.resolve(result));

    const reviewTool = createSubmitReviewResultTool(reviewStore);
    const result = await (reviewTool as any).execute(
      { feedback: '   ' },
      { sessionID: 'reviewer-1' },
    );

    expect(result).toContain('accepted');
  });
});

describe('createSubmitReviewTool', () => {
  test('rejects when session is not in loop mode', async () => {
    const reviewStore = createReviewStore();
    const ctx = createMockContext();
    const tool = createSubmitReviewTool(ctx, reviewStore);
    const result = await (tool as any).execute(
      { report: 'did stuff', affectedFiles: ['a.ts'] },
      { sessionID: 'ses-1', directory: '/tmp' },
    );
    expect(result).toContain('do not need review');
  });

  test('rejects concurrent review attempts', async () => {
    const reviewStore = createReviewStore();
    reviewStore.activateReview('ses-1', 'task', 0);
    reviewStore.tryLockReview('ses-1');

    const ctx = createMockContext();
    const tool = createSubmitReviewTool(ctx, reviewStore);
    const result = await (tool as any).execute(
      { report: 'did stuff', affectedFiles: ['a.ts'] },
      { sessionID: 'ses-1', directory: '/tmp' },
    );
    expect(result).toContain('already in progress');
  });

  test('releases lock when reviewer session creation fails', async () => {
    const reviewStore = createReviewStore();
    reviewStore.activateReview('ses-1', 'task', 0);

    const ctx = createMockContext();
    ctx.client.session.create = vi.fn(async () => ({
      data: { id: undefined },
    }));

    const tool = createSubmitReviewTool(ctx, reviewStore);
    const result = await (tool as any).execute(
      { report: 'did stuff', affectedFiles: ['a.ts'] },
      { sessionID: 'ses-1', directory: '/tmp' },
    );

    expect(result).toContain('Failed to create reviewer session');
    expect(reviewStore.isReviewActive('ses-1')).toBe(true);
    expect(reviewStore.tryLockReview('ses-1')).toBe(true);
  });

  test('releases lock when client.session.create throws', async () => {
    const reviewStore = createReviewStore();
    reviewStore.activateReview('ses-1', 'task', 0);

    const ctx = createMockContext();
    ctx.client.session.create = vi.fn(async () => {
      throw new Error('Session creation network error');
    });

    const tool = createSubmitReviewTool(ctx, reviewStore);
    await expect(
      (tool as any).execute(
        { report: 'did stuff', affectedFiles: ['a.ts'] },
        { sessionID: 'ses-1', directory: '/tmp' },
      ),
    ).rejects.toThrow('Session creation network error');

    expect(reviewStore.isReviewActive('ses-1')).toBe(true);
    expect(reviewStore.tryLockReview('ses-1')).toBe(true);
  });
});
