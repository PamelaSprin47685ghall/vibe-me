import { describe, expect, mock, test } from 'bun:test';
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
        type: 'session.status',
        properties: {
          sessionID: 'ses-1',
          status: { type: 'busy' },
        },
      },
    });

    await hook.handleEvent({
      event: { type: 'session.idle', properties: { sessionID: 'ses-1' } },
    });

    expect(ctx.client.session.prompt).toHaveBeenCalledTimes(1);
  });
});
