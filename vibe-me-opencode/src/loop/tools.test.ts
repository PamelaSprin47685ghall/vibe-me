import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  activateReview,
  clearReviewSessions,
  isReviewActive,
  setPendingReview,
  tryLockReview,
} from 'engine/review';
import {
  createSubmitReviewResultTool,
  createSubmitReviewTool,
  createDeferred,
} from './index';
import { createMockContext } from './test-utils';

afterEach(() => {
  clearReviewSessions();
});

describe('createSubmitReviewResultTool', () => {
  test('resolves pending result with null feedback (accept)', async () => {
    const d = createDeferred<any>();
    setPendingReview('reviewer-1', (result) => d.resolve(result));

    const reviewTool = createSubmitReviewResultTool();
    const result = await (reviewTool as any).execute(
      { feedback: null },
      { sessionID: 'reviewer-1' },
    );

    expect(result).toContain('accepted');
  });

  test('resolves pending result with feedback (reject)', async () => {
    const d = createDeferred<any>();
    setPendingReview('reviewer-1', (result) => d.resolve(result));

    const reviewTool = createSubmitReviewResultTool();
    const result = await (reviewTool as any).execute(
      { feedback: 'Fix the error handling' },
      { sessionID: 'reviewer-1' },
    );

    expect(result).toContain('rejected');
  });

  test('returns error when no pending review', async () => {
    const reviewTool = createSubmitReviewResultTool();
    const result = await (reviewTool as any).execute(
      { feedback: null },
      { sessionID: 'unknown-session' },
    );

    expect(result).toContain('No pending review');
  });

  test('treats empty string as null (accept)', async () => {
    const d = createDeferred<any>();
    setPendingReview('reviewer-1', (result) => d.resolve(result));

    const reviewTool = createSubmitReviewResultTool();
    const result = await (reviewTool as any).execute(
      { feedback: '   ' },
      { sessionID: 'reviewer-1' },
    );

    expect(result).toContain('accepted');
  });
});

describe('createSubmitReviewTool', () => {
  test('rejects when session is not in loop mode', async () => {
    const ctx = createMockContext();
    const tool = createSubmitReviewTool(ctx);
    const result = await (tool as any).execute(
      { report: 'did stuff', affectedFiles: ['a.ts'] },
      { sessionID: 'ses-1', directory: '/tmp' },
    );
    expect(result).toContain('do not need review');
  });

  test('rejects concurrent review attempts', async () => {
    activateReview('ses-1', 'task');
    tryLockReview('ses-1');

    const ctx = createMockContext();
    const tool = createSubmitReviewTool(ctx);
    const result = await (tool as any).execute(
      { report: 'did stuff', affectedFiles: ['a.ts'] },
      { sessionID: 'ses-1', directory: '/tmp' },
    );
    expect(result).toContain('already in progress');
  });

  test('releases lock when reviewer session creation fails', async () => {
    activateReview('ses-1', 'task');

    const ctx = createMockContext();
    ctx.client.session.create = mock(async () => ({ data: { id: undefined } }));

    const tool = createSubmitReviewTool(ctx);
    const result = await (tool as any).execute(
      { report: 'did stuff', affectedFiles: ['a.ts'] },
      { sessionID: 'ses-1', directory: '/tmp' },
    );

    expect(result).toContain('Failed to create reviewer session');
    expect(isReviewActive('ses-1')).toBe(true);
    expect(tryLockReview('ses-1')).toBe(true);
  });

  test('releases lock when client.session.create throws', async () => {
    activateReview('ses-1', 'task');

    const ctx = createMockContext();
    ctx.client.session.create = mock(async () => {
      throw new Error('Session creation network error');
    });

    const tool = createSubmitReviewTool(ctx);
    await expect(
      (tool as any).execute(
        { report: 'did stuff', affectedFiles: ['a.ts'] },
        { sessionID: 'ses-1', directory: '/tmp' },
      ),
    ).rejects.toThrow('Session creation network error');

    expect(isReviewActive('ses-1')).toBe(true);
    expect(tryLockReview('ses-1')).toBe(true);
  });
});
