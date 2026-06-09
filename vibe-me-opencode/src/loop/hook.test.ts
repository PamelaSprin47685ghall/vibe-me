import { afterEach, describe, expect, mock, test } from 'bun:test';
import { activateReview, clearReviewSessions } from 'engine/review';
import { createLoopNudgeHook } from './index';
import { createMockContext } from './test-utils';

afterEach(() => {
  clearReviewSessions();
});

describe('createLoopNudgeHook', () => {
  test('does not nudge when session is not in loop mode', async () => {
    const ctx = createMockContext();
    const hook = createLoopNudgeHook(ctx);

    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).not.toHaveBeenCalled();
  });

  test('nudges when session is in loop mode and no open todos', async () => {
    const ctx = createMockContext();
    ctx.client.session.todo = mock(() => ({ data: [] }));
    const hook = createLoopNudgeHook(ctx);
    activateReview('ses-1', 'task');

    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).toHaveBeenCalledTimes(1);
  });

  test('preserves the active agent when nudging', async () => {
    const ctx = createMockContext();
    ctx.client.session.todo = mock(() => ({ data: [] }));
    const hook = createLoopNudgeHook(ctx);
    activateReview('ses-1', 'task');

    await hook.handleEvent({
      event: {
        type: 'session.next.step.started',
        properties: { sessionID: 'ses-1', agent: 'editor' },
      },
    });

    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).toHaveBeenCalledTimes(1);
    expect(ctx.client.session.prompt.mock.calls[0]?.[0].body.agent).toBe(
      'editor',
    );
  });

  test('does not nudge when there are open todos (todo nudge takes priority)', async () => {
    const ctx = createMockContext();
    ctx.client.session.todo = mock(() => ({
      data: [
        {
          id: '1',
          content: 'task',
          status: 'in_progress',
          priority: 'high',
        },
      ],
    }));
    const hook = createLoopNudgeHook(ctx);
    activateReview('ses-1', 'task');

    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).not.toHaveBeenCalled();
  });

  test('suppresses nudge after abort error', async () => {
    const ctx = createMockContext();
    const hook = createLoopNudgeHook(ctx);
    activateReview('ses-1', 'task');

    await hook.handleEvent({
      event: {
        type: 'session.error',
        properties: {
          sessionID: 'ses-1',
          error: { name: 'MessageAbortedError' },
        },
      },
    });

    ctx.client.session.todo = mock(() => ({ data: [] }));
    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).not.toHaveBeenCalled();
  });

  test('ignores events without sessionID', async () => {
    const ctx = createMockContext();
    const hook = createLoopNudgeHook(ctx);

    await hook.handleEvent({
      event: { type: 'session.idle', properties: {} },
    });

    expect(ctx.client.session.prompt).not.toHaveBeenCalled();
  });
});
