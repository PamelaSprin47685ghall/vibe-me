import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createNudgeCoordinatorHook } from './index';
import { createMockContext, cleanupAfterEach } from './test-utils';

afterEach(cleanupAfterEach);

describe('agent preservation', () => {
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
});
