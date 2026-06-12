import { describe, expect, mock, test } from 'bun:test';
import {
  accepted,
  createReviewStore,
  rejected,
  terminated,
} from 'engine/review';
import { handleLoopReview, type LoopReviewDeps } from './command-loop-review';
import { createMockContext, createOutput } from './test-utils';

function createFakeDeps(
  overrides: Partial<LoopReviewDeps> = {},
): LoopReviewDeps {
  return {
    createSession: mock(() => Promise.resolve({ data: { id: 'child-1' } })),
    runReviewerWithNudge: mock(() => Promise.resolve(accepted)),
    registerChildAgent: mock(() => {}),
    resolveSubsessionParentID: mock((id?: string) => id),
    loopReviewCommandName: 'loop-review',
    reviewInstructions: 'review instructions',
    now: mock(() => 42),
    ...overrides,
  };
}

async function execute(
  reviewStore: ReturnType<typeof createReviewStore>,
  input: { command: string; sessionID: string; arguments: string },
  deps: LoopReviewDeps,
) {
  const ctx = createMockContext();
  const output = createOutput();
  await handleLoopReview(ctx, reviewStore, input, output, deps);
  return { ctx, output };
}

describe('handleLoopReview', () => {
  test('ignores non-loop-review commands', async () => {
    const reviewStore = createReviewStore();
    const deps = createFakeDeps();
    const { output } = await execute(
      reviewStore,
      { command: 'other', sessionID: 'ses-1', arguments: 'do stuff' },
      deps,
    );

    expect(output.parts).toHaveLength(1);
    expect(output.parts[0].text).toBe('template content');
    expect(deps.createSession).not.toHaveBeenCalled();
  });

  test('empty task cancels and clears output', async () => {
    const reviewStore = createReviewStore();
    const deps = createFakeDeps();
    const { output } = await execute(
      reviewStore,
      { command: 'loop-review', sessionID: 'ses-1', arguments: '   ' },
      deps,
    );

    expect(reviewStore.isReviewActive('ses-1')).toBe(false);
    expect(output.parts).toHaveLength(1);
    expect(output.parts[0].text).toContain('cancelled');
    expect(deps.createSession).not.toHaveBeenCalled();
  });

  test('already active returns message', async () => {
    const reviewStore = createReviewStore();
    reviewStore.activateReview('ses-1', 'existing task', 0);
    const deps = createFakeDeps();
    const { output } = await execute(
      reviewStore,
      { command: 'loop-review', sessionID: 'ses-1', arguments: 'new task' },
      deps,
    );

    expect(output.parts[0].text).toContain('already active');
    expect(deps.createSession).not.toHaveBeenCalled();
  });

  test('session creation failure returns error', async () => {
    const reviewStore = createReviewStore();
    const deps = createFakeDeps({
      createSession: mock(() => Promise.resolve({ data: { id: undefined } })),
    });
    const { output } = await execute(
      reviewStore,
      { command: 'loop-review', sessionID: 'ses-1', arguments: 'do stuff' },
      deps,
    );

    expect(output.parts[0].text).toContain(
      'Failed to create pre-reviewer session',
    );
    expect(reviewStore.isReviewActive('ses-1')).toBe(false);
    expect(deps.registerChildAgent).not.toHaveBeenCalled();
  });

  test('accepted result returns pass message', async () => {
    const reviewStore = createReviewStore();
    const deps = createFakeDeps({
      runReviewerWithNudge: mock(() => Promise.resolve(accepted)),
    });
    const { output } = await execute(
      reviewStore,
      {
        command: 'loop-review',
        sessionID: 'ses-1',
        arguments: 'refactor auth',
      },
      deps,
    );

    expect(output.parts[0].text).toContain('Pre-review passed');
    expect(output.parts[0].text).toContain('refactor auth');
    expect(reviewStore.isReviewActive('ses-1')).toBe(false);
    expect(deps.createSession).toHaveBeenCalled();
    expect(deps.registerChildAgent).toHaveBeenCalled();
  });

  test('terminated result returns terminated message', async () => {
    const reviewStore = createReviewStore();
    const deps = createFakeDeps({
      runReviewerWithNudge: mock(() => Promise.resolve(terminated)),
    });
    const { output } = await execute(
      reviewStore,
      { command: 'loop-review', sessionID: 'ses-1', arguments: 'do stuff' },
      deps,
    );

    expect(output.parts[0].text).toContain('Pre-review could not complete');
    expect(reviewStore.isReviewActive('ses-1')).toBe(false);
  });

  test('feedback result activates review and returns formatted feedback', async () => {
    const reviewStore = createReviewStore();
    const deps = createFakeDeps({
      runReviewerWithNudge: mock(() =>
        Promise.resolve(rejected('fix the bug')),
      ),
    });
    const { output } = await execute(
      reviewStore,
      {
        command: 'loop-review',
        sessionID: 'ses-1',
        arguments: 'refactor auth',
      },
      deps,
    );

    expect(output.parts[0].text).toContain('Pre-review Feedback');
    expect(output.parts[0].text).toContain('fix the bug');
    expect(output.parts[0].text).toContain('Address the feedback above');
    expect(reviewStore.isReviewActive('ses-1')).toBe(true);
    expect(reviewStore.getReviewTask('ses-1')).toBe('refactor auth');
    expect(deps.now).toHaveBeenCalled();
  });
});
