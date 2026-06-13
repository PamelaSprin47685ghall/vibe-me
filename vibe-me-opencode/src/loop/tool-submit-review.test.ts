import type { PluginInput } from '@opencode-ai/plugin';
import {
  accepted,
  createReviewStore,
  rejected,
  terminated,
} from 'engine/review';
import { describe, expect, test, vi } from 'vitest';
import {
  createSubmitReviewTool,
  type SubmitReviewDeps,
} from './tool-submit-review';

function createFakeClient(
  childID: string | undefined = 'child-1',
): PluginInput['client'] {
  return {
    session: {
      create: vi.fn(() => Promise.resolve({ data: { id: childID } })),
    },
  } as unknown as PluginInput['client'];
}

function createMockPluginInput(): PluginInput {
  return {
    directory: '/tmp/test',
    client: createFakeClient(),
  } as unknown as PluginInput;
}

function createFakeDeps(
  overrides: Partial<SubmitReviewDeps> = {},
): SubmitReviewDeps {
  return {
    createSession: vi.fn(() => Promise.resolve({ data: { id: 'child-1' } })),
    runReviewerWithNudge: vi.fn(() => Promise.resolve(accepted)),
    registerChildAgent: vi.fn(() => {}),
    resolveSubsessionParentID: vi.fn((id?: string) => id),
    extractToolContext: vi.fn((_context, fallbackDirectory) => ({
      directory: fallbackDirectory,
      sessionID: 'ses-1',
      abortSignal: undefined,
    })),
    ...overrides,
  };
}

async function executeTool(
  tool: ReturnType<typeof createSubmitReviewTool>,
  args: { report: string; affectedFiles: string[] },
) {
  return (tool as any).execute(args, {
    sessionID: 'ses-1',
    directory: '/tmp/test',
  });
}

describe('createSubmitReviewTool', () => {
  test('returns early when review is not active', async () => {
    const reviewStore = createReviewStore();
    const ctx = createMockPluginInput();
    const deps = createFakeDeps();
    const tool = createSubmitReviewTool(ctx, reviewStore, deps);

    const result = await executeTool(tool, {
      report: 'did stuff',
      affectedFiles: ['a.ts'],
    });

    expect(result).toContain('do not need review');
    expect(deps.createSession).not.toHaveBeenCalled();
  });

  test('returns early when review is already locked', async () => {
    const reviewStore = createReviewStore();
    reviewStore.activateReview('ses-1', 'task', 0);
    reviewStore.tryLockReview('ses-1');

    const ctx = createMockPluginInput();
    const deps = createFakeDeps();
    const tool = createSubmitReviewTool(ctx, reviewStore, deps);

    const result = await executeTool(tool, {
      report: 'did stuff',
      affectedFiles: ['a.ts'],
    });

    expect(result).toContain('already in progress');
    expect(deps.createSession).not.toHaveBeenCalled();
  });

  test('accepted outcome deactivates review and returns pass message', async () => {
    const reviewStore = createReviewStore();
    reviewStore.activateReview('ses-1', 'task', 0);

    const ctx = createMockPluginInput();
    const deps = createFakeDeps({
      runReviewerWithNudge: vi.fn(() => Promise.resolve(accepted)),
    });
    const tool = createSubmitReviewTool(ctx, reviewStore, deps);

    const result = await executeTool(tool, {
      report: 'did stuff',
      affectedFiles: ['a.ts'],
    });

    expect(result).toContain('Review passed');
    expect(reviewStore.isReviewActive('ses-1')).toBe(false);
  });

  test('terminated outcome deactivates review and returns terminated message', async () => {
    const reviewStore = createReviewStore();
    reviewStore.activateReview('ses-1', 'task', 0);

    const ctx = createMockPluginInput();
    const deps = createFakeDeps({
      runReviewerWithNudge: vi.fn(() => Promise.resolve(terminated)),
    });
    const tool = createSubmitReviewTool(ctx, reviewStore, deps);

    const result = await executeTool(tool, {
      report: 'did stuff',
      affectedFiles: ['a.ts'],
    });

    expect(result).toContain('Review terminated');
    expect(reviewStore.isReviewActive('ses-1')).toBe(false);
  });

  test('feedback outcome keeps review active and returns feedback', async () => {
    const reviewStore = createReviewStore();
    reviewStore.activateReview('ses-1', 'task', 0);

    const ctx = createMockPluginInput();
    const deps = createFakeDeps({
      runReviewerWithNudge: vi.fn(() =>
        Promise.resolve(rejected('fix the bug')),
      ),
    });
    const tool = createSubmitReviewTool(ctx, reviewStore, deps);

    const result = await executeTool(tool, {
      report: 'did stuff',
      affectedFiles: ['a.ts'],
    });

    expect(result).toContain('Review feedback');
    expect(result).toContain('fix the bug');
    expect(reviewStore.isReviewActive('ses-1')).toBe(true);
  });

  test('failed session creation returns error and releases lock', async () => {
    const reviewStore = createReviewStore();
    reviewStore.activateReview('ses-1', 'task', 0);

    const ctx = createMockPluginInput();
    const deps = createFakeDeps({
      createSession: vi.fn(() => Promise.resolve({ data: { id: undefined } })),
    });
    const tool = createSubmitReviewTool(ctx, reviewStore, deps);

    const result = await executeTool(tool, {
      report: 'did stuff',
      affectedFiles: ['a.ts'],
    });

    expect(result).toContain('Failed to create reviewer session');
    expect(reviewStore.isReviewActive('ses-1')).toBe(true);
    expect(reviewStore.tryLockReview('ses-1')).toBe(true);
  });
});
