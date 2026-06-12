import { afterEach, describe, expect, test } from 'bun:test';
import { createReviewStore } from 'engine/review';
import { createNudgeCoordinatorHook } from './index';
import { cleanupAfterEach, createMockContext } from './test-utils';

afterEach(cleanupAfterEach);

describe('timing / cooldown', () => {
  test('waits out session errors before nudging again', async () => {
    const ctx = createMockContext();
    const reviewStore = createReviewStore();
    const hook = createNudgeCoordinatorHook(ctx, reviewStore);

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
    const reviewStore = createReviewStore();
    const hook = createNudgeCoordinatorHook(ctx, reviewStore);

    await hook.handleEvent({
      event: {
        type: 'session.status',
        properties: {
          sessionID: 'ses-1',
          status: {
            type: 'retry',
            attempt: 1,
            message: 'quota exhausted',
            next: 1,
          },
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
    const reviewStore = createReviewStore();
    const hook = createNudgeCoordinatorHook(ctx, reviewStore);

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
    const reviewStore = createReviewStore();
    const hook = createNudgeCoordinatorHook(ctx, reviewStore);

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
});
