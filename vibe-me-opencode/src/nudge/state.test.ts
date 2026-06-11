import { afterEach, describe, expect, mock, test } from 'bun:test';
import { LOOP_NUDGE_PROMPT } from 'engine/todo';
import { activateReview } from 'engine/review';
import { createNudgeCoordinatorHook } from './index';
import { createMockContext, cleanupAfterEach } from './test-utils';

afterEach(cleanupAfterEach);

describe('loop nudge state machine', () => {
  test('nudges loop when assistant completes without idle event', async () => {
    const ctx = createMockContext();
    ctx.client.session.todo = mock(() => ({ data: [] }));
    const hook = createNudgeCoordinatorHook(ctx);
    activateReview('ses-1', 'task');

    await hook.handleEvent({
      event: {
        type: 'message.updated',
        properties: {
          sessionID: 'ses-1',
          info: {
            role: 'assistant',
            agent: 'orchestrator',
            finish: 'stop',
            time: { completed: 1 },
          },
        },
      },
    });

    expect(ctx.client.session.prompt).toHaveBeenCalledTimes(1);
    expect(ctx.client.session.prompt.mock.calls[0]?.[0].body.parts[0].text).toBe(LOOP_NUDGE_PROMPT);
  });

  test('does not duplicate silent-finish loop nudge on later idle', async () => {
    const ctx = createMockContext();
    ctx.client.session.todo = mock(() => ({ data: [] }));
    const hook = createNudgeCoordinatorHook(ctx);
    activateReview('ses-1', 'task');

    await hook.handleEvent({
      event: {
        type: 'session.next.step.ended',
        properties: { sessionID: 'ses-1', finish: 'stop' },
      },
    });
    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).toHaveBeenCalledTimes(1);
    expect(ctx.client.session.prompt.mock.calls[0]?.[0].body.parts[0].text).toBe(LOOP_NUDGE_PROMPT);
  });

  test('retries silent-finish loop nudge on idle when session is still busy', async () => {
    const ctx = createMockContext();
    ctx.client.session.todo = mock(() => ({ data: [] }));
    ctx.client.session.prompt = mock(() => {
      if (ctx.client.session.prompt.mock.calls.length === 1) {
        throw { _tag: 'SessionBusyError' };
      }
    });
    const hook = createNudgeCoordinatorHook(ctx);
    activateReview('ses-1', 'task');

    await hook.handleEvent({
      event: {
        type: 'session.next.step.ended',
        properties: { sessionID: 'ses-1', finish: 'stop' },
      },
    });
    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).toHaveBeenCalledTimes(2);
    expect(ctx.client.session.prompt.mock.calls[1]?.[0].body.parts[0].text).toBe(LOOP_NUDGE_PROMPT);
  });

  test('does not duplicate nudge when multiple events arrive concurrently', async () => {
    const ctx = createMockContext();
    ctx.client.session.todo = mock(() => ({ data: [] }));
    const hook = createNudgeCoordinatorHook(ctx);
    activateReview('ses-1', 'task');

    await Promise.all([
      hook.handleEvent({
        event: {
          type: 'message.updated',
          properties: {
            sessionID: 'ses-1',
            info: {
              role: 'assistant',
              agent: 'orchestrator',
              finish: 'stop',
              time: { completed: 1 },
            },
          },
        },
      }),
      hook.handleEvent({
        event: {
          type: 'session.next.step.ended',
          properties: { sessionID: 'ses-1', finish: 'stop' },
        },
      }),
      hook.handleEvent({
        event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
      }),
    ]);

    expect(ctx.client.session.prompt).toHaveBeenCalledTimes(1);
    expect(ctx.client.session.prompt.mock.calls[0]?.[0].body.parts[0].text).toBe(LOOP_NUDGE_PROMPT);
  });
});
