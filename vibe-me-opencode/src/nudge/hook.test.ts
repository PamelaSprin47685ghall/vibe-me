import { describe, expect, test } from 'bun:test';
import type { PluginInput } from '@opencode-ai/plugin';
import type { ReviewStore } from 'engine/review';
import type { EventHandler } from './event-handlers';
import { createNudgeCoordinatorHook } from './hook';

function fakeCtx(): PluginInput {
  return {} as PluginInput;
}

function fakeReviewStore(): ReviewStore {
  return {
    activateReview: () => {},
    deactivateReview: () => {},
    clearReviewSessions: () => {},
    tryLockReview: () => true,
    unlockReview: () => {},
    setPendingReview: () => {},
    resolvePendingReview: () => false,
    getReviewTask: () => undefined,
    getReviewState: () => undefined,
    isReviewActive: () => false,
    addChild: () => {},
  } as ReviewStore;
}

describe('createNudgeCoordinatorHook', () => {
  test('toolExecuteAfter appends REVERIE_NUDGE to todowrite string output', async () => {
    const hook = createNudgeCoordinatorHook(fakeCtx(), fakeReviewStore(), {
      REVERIE_NUDGE: ' // think',
    });
    const output = { output: 'todo list' };

    await hook.handleToolExecuteAfter(
      { tool: 'todowrite', callID: 'c1' },
      output,
    );

    expect(output.output).toBe('todo list // think');
  });

  test('toolExecuteAfter ignores non-todowrite tools and non-string output', async () => {
    const hook = createNudgeCoordinatorHook(fakeCtx(), fakeReviewStore(), {
      REVERIE_NUDGE: ' // think',
    });
    const stringOutput = { output: 'todo list' };
    const numericOutput = { output: 123 };

    await hook.handleToolExecuteAfter(
      { tool: 'read', callID: 'c1' },
      stringOutput,
    );
    await hook.handleToolExecuteAfter(
      { tool: 'todowrite', callID: 'c2' },
      numericOutput,
    );

    expect(stringOutput.output).toBe('todo list');
    expect(numericOutput.output).toBe(123);
  });

  test('chatMessage remembers agent and resumes session, skipping nudge prompts', () => {
    const remembered: Array<{ sessionID: string; agent: unknown }> = [];
    const resumed: string[] = [];
    const hook = createNudgeCoordinatorHook(fakeCtx(), fakeReviewStore(), {
      getPartsText: (parts) => {
        if (!Array.isArray(parts)) return undefined;
        return (
          (parts as { text: string }[]).map((part) => part.text).join('\n') ||
          undefined
        );
      },
      isNudgePrompt: (text) => text === 'nudge-prompt',
      rememberAgent: (state, sessionID, agent) => {
        remembered.push({ sessionID, agent });
        return {
          ...state,
          sessionAgents: new Map(state.sessionAgents).set(
            sessionID,
            agent as string,
          ),
        };
      },
      resumeSession: (state, sessionID) => {
        resumed.push(sessionID);
        return state;
      },
    });

    hook.handleChatMessage({
      sessionID: 's1',
      agent: 'editor',
      parts: [{ type: 'text', text: 'work on this' }],
    });

    expect(remembered).toEqual([{ sessionID: 's1', agent: 'editor' }]);
    expect(resumed).toEqual(['s1']);

    hook.handleChatMessage({
      sessionID: 's2',
      agent: 'explorer',
      parts: [{ type: 'text', text: 'nudge-prompt' }],
    });

    expect(remembered).toEqual([{ sessionID: 's1', agent: 'editor' }]);
    expect(resumed).toEqual(['s1']);
  });

  test('commandExecuteBefore resumes session', async () => {
    const resumed: string[] = [];
    const hook = createNudgeCoordinatorHook(fakeCtx(), fakeReviewStore(), {
      resumeSession: (state, sessionID) => {
        resumed.push(sessionID);
        return state;
      },
    });

    await hook.handleCommandExecuteBefore(
      { command: 'do', sessionID: 's1', arguments: '' },
      { parts: [] },
    );

    expect(resumed).toEqual(['s1']);
  });

  test('event routes to matching handler', async () => {
    const calls: Array<{
      type: string;
      sessionID: string;
      props: Record<string, unknown>;
    }> = [];
    const handlers: Record<string, EventHandler> = {
      'my.event': async (state, props, sessionID) => {
        calls.push({ type: 'my.event', sessionID, props });
        return state;
      },
    };
    const hook = createNudgeCoordinatorHook(fakeCtx(), fakeReviewStore(), {
      createEventHandlers: () => handlers,
      getSessionID: (_, props) => props.sessionID as string,
      getEventAgent: (props) => props.agent as string | undefined,
      rememberAgent: (state, sessionID, agent) => ({
        ...state,
        sessionAgents: new Map(state.sessionAgents).set(
          sessionID,
          agent as string,
        ),
      }),
    });

    await hook.handleEvent({
      event: {
        type: 'my.event',
        properties: { sessionID: 's1', agent: 'editor' },
      },
    });

    expect(calls).toEqual([
      {
        type: 'my.event',
        sessionID: 's1',
        props: { sessionID: 's1', agent: 'editor' },
      },
    ]);
  });

  test('event sequences pending calls without real timers', async () => {
    const order: string[] = [];
    const handlers: Record<string, EventHandler> = {
      a: async (state) => {
        order.push('a-start');
        await Promise.resolve();
        order.push('a-end');
        return state;
      },
      b: async (state) => {
        order.push('b-start');
        await Promise.resolve();
        order.push('b-end');
        return state;
      },
    };
    const hook = createNudgeCoordinatorHook(fakeCtx(), fakeReviewStore(), {
      createEventHandlers: () => handlers,
      getSessionID: (_, props) => props.sessionID as string,
      getEventAgent: () => undefined,
      rememberAgent: (state) => state,
    });

    const first = hook.handleEvent({
      event: { type: 'a', properties: { sessionID: 's1' } },
    });
    const second = hook.handleEvent({
      event: { type: 'b', properties: { sessionID: 's2' } },
    });
    await Promise.all([first, second]);

    expect(order).toEqual(['a-start', 'a-end', 'b-start', 'b-end']);
  });

  test('event ignores unknown session or type', async () => {
    const calls: string[] = [];
    const handlers: Record<string, EventHandler> = {
      known: async (state) => {
        calls.push('known');
        return state;
      },
    };
    const hook = createNudgeCoordinatorHook(fakeCtx(), fakeReviewStore(), {
      createEventHandlers: () => handlers,
      getSessionID: (_, props) => props.sessionID as string | undefined,
      getEventAgent: () => undefined,
      rememberAgent: (state) => state,
    });

    await hook.handleEvent({ event: { type: 'known', properties: {} } });
    await hook.handleEvent({
      event: { type: 'unknown', properties: { sessionID: 's1' } },
    });

    expect(calls).toEqual([]);
  });
});
