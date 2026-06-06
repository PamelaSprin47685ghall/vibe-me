import { afterEach, describe, expect, mock, test } from 'bun:test';
import { activateReview, clearReviewSessions } from 'engine/review';
import { defaultCoordinator, LOOP_NUDGE_PROMPT } from 'engine/todo';
import { createNudgeCoordinatorHook } from './index';

function createMockContext() {
  return {
    directory: '/tmp/test-project',
    client: {
      session: {
        create: mock(() => ({ data: { id: 'reviewer-1' } })),
        prompt: mock(() => {}),
        messages: mock(() => ({
          data: [
            {
              info: { role: 'assistant' },
              parts: [{ type: 'text', text: 'working on it' }],
            },
          ],
        })),
        todo: mock(() => ({
          data: [
            {
              id: 'todo-1',
              content: 'finish task',
              status: 'in_progress',
              priority: 'high',
            },
          ],
        })),
      },
    },
  } as any;
}

afterEach(() => {
  clearReviewSessions();
  defaultCoordinator.clear();
});

describe('createNudgeCoordinatorHook', () => {
  test('waits out session errors before nudging again', async () => {
    const ctx = createMockContext();
    const hook = createNudgeCoordinatorHook(ctx);

    await hook.handleEvent({
      event: {
        type: 'session.error',
        properties: {
          sessionID: 'ses-1',
          error: { name: 'TooManyRequestsError' },
        },
      },
    });

    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).not.toHaveBeenCalled();

    await hook.handleEvent({
      event: {
        type: 'session.next.step.started',
        properties: {
          sessionID: 'ses-1',
          agent: 'orchestrator',
          model: { id: 'model', providerID: 'provider', variant: 'default' },
        },
      },
    });

    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).toHaveBeenCalledTimes(1);
  });

  test('waits out retry status before nudging again', async () => {
    const ctx = createMockContext();
    const hook = createNudgeCoordinatorHook(ctx);

    await hook.handleEvent({
      event: {
        type: 'session.status',
        properties: {
          sessionID: 'ses-1',
          status: { type: 'retry', attempt: 1, message: 'quota exhausted', next: 1 },
        },
      },
    });

    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).not.toHaveBeenCalled();

    await hook.handleEvent({
      event: {
        type: 'session.next.step.started',
        properties: {
          sessionID: 'ses-1',
          agent: 'orchestrator',
          model: { id: 'model', providerID: 'provider', variant: 'default' },
        },
      },
    });

    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).toHaveBeenCalledTimes(1);
  });

  test('does not nudge after aborting a retry until the next user prompt', async () => {
    const ctx = createMockContext();
    const hook = createNudgeCoordinatorHook(ctx);

    await hook.handleEvent({
      event: {
        type: 'session.next.retried',
        properties: {
          sessionID: 'ses-1',
          attempt: 1,
          error: { message: 'quota exhausted', isRetryable: true },
        },
      },
    });

    await hook.handleEvent({
      event: {
        type: 'session.next.step.failed',
        properties: {
          sessionID: 'ses-1',
          error: { type: 'unknown', message: 'Aborted' },
        },
      },
    });

    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).not.toHaveBeenCalled();

    await hook.handleEvent({
      event: {
        type: 'session.next.prompted',
        properties: {
          sessionID: 'ses-1',
          prompt: { text: 'continue' },
        },
      },
    });

    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).toHaveBeenCalledTimes(1);
  });

  test('handles legacy retry parts and abort messages without nudging', async () => {
    const ctx = createMockContext();
    const hook = createNudgeCoordinatorHook(ctx);

    await hook.handleEvent({
      event: {
        type: 'message.part.updated',
        properties: {
          part: {
            id: 'part-1',
            sessionID: 'ses-1',
            messageID: 'msg-1',
            type: 'retry',
            attempt: 1,
          },
        },
      },
    });

    await hook.handleEvent({
      event: {
        type: 'message.updated',
        properties: {
          info: {
            sessionID: 'ses-1',
            role: 'assistant',
            error: { name: 'MessageAbortedError' },
          },
        },
      },
    });

    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).not.toHaveBeenCalled();

    hook.handleChatMessage({
      sessionID: 'ses-1',
      parts: [{ type: 'text', text: 'continue' }],
    });

    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).toHaveBeenCalledTimes(1);
  });

  test('preserves the active agent when nudging', async () => {
    const ctx = createMockContext();
    const hook = createNudgeCoordinatorHook(ctx);

    hook.handleChatMessage({
      sessionID: 'ses-1',
      agent: 'editor',
      parts: [{ type: 'text', text: 'work on this' }],
    });

    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).toHaveBeenCalledTimes(1);
    expect(ctx.client.session.prompt.mock.calls[0]?.[0].body.agent).toBe('editor');
  });

  test('uses the last assistant agent when no live agent event was seen', async () => {
    const ctx = createMockContext();
    ctx.client.session.messages = mock(() => ({
      data: [
        {
          info: { role: 'assistant', agent: 'greper' },
          parts: [{ type: 'text', text: 'working on it' }],
        },
      ],
    }));
    const hook = createNudgeCoordinatorHook(ctx);

    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).toHaveBeenCalledTimes(1);
    expect(ctx.client.session.prompt.mock.calls[0]?.[0].body.agent).toBe('greper');
  });

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
});
