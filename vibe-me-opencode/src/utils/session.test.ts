import { afterEach, describe, expect, test, vi } from 'vitest';
import { promptWithAbort } from './abort-signal';
import {
  registerChildAgent,
  resolveSubsessionParentID,
  unregisterChildAgent,
} from './child-agent';
import { runSubagent } from './subagent';

function createMockClient() {
  return {
    session: {
      create: vi.fn(() => Promise.resolve({ data: { id: 'child-session' } })),
      messages: vi.fn(() => Promise.resolve({ data: [] })),
      abort: vi.fn(() => Promise.resolve()),
      prompt: vi.fn(() => Promise.resolve()),
    },
  } as any;
}

afterEach(() => {
  vi.restoreAllMocks();
  unregisterChildAgent('root-session');
  unregisterChildAgent('child-session');
  unregisterChildAgent('grandchild-session');
  unregisterChildAgent('nested-session');
});

describe('promptWithAbort', () => {
  test('calls prompt directly when no signal provided', async () => {
    const client = createMockClient();
    await promptWithAbort(client, { parts: [] });
    expect(client.session.prompt).toHaveBeenCalledTimes(1);
  });

  test('throws immediately if signal already aborted', async () => {
    const client = createMockClient();
    const controller = new AbortController();
    controller.abort();
    await expect(
      promptWithAbort(client, { parts: [] }, controller.signal),
    ).rejects.toThrow(DOMException);
    expect(client.session.prompt).not.toHaveBeenCalled();
  });

  test('propagates abort error through Promise.race', async () => {
    const client = createMockClient();
    client.session.prompt = vi.fn(
      () =>
        new Promise(() => {
          // Never resolves so abort signal wins the race
        }),
    );

    const controller = new AbortController();
    const promptPromise = promptWithAbort(
      client,
      { parts: [] },
      controller.signal,
    );

    controller.abort();

    await expect(promptPromise).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('handles late prompt rejection after abort to avoid unhandled rejection', async () => {
    const client = createMockClient();
    let rejectPromptRef: ((reason?: unknown) => void) | undefined;
    client.session.prompt = vi.fn(
      () =>
        new Promise((_, reject) => {
          rejectPromptRef = reject;
        }),
    );

    const controller = new AbortController();
    const promptPromise = promptWithAbort(
      client,
      { parts: [] },
      controller.signal,
    );

    controller.abort();

    await expect(promptPromise).rejects.toThrow(DOMException);

    rejectPromptRef?.(new Error('Late error'));
    await Promise.resolve();
  });

  test('propagates non-abort errors through Promise.race', async () => {
    const client = createMockClient();
    client.session.prompt = vi.fn(() =>
      Promise.reject(new Error('Prompt failed')),
    );

    const controller = new AbortController();
    await expect(
      promptWithAbort(client, { parts: [] }, controller.signal),
    ).rejects.toThrow('Prompt failed');
  });
});

describe('resolveSubsessionParentID', () => {
  test('returns the original session ID for unknown sessions', () => {
    expect(resolveSubsessionParentID('root-session')).toBe('root-session');
  });

  test('returns the root parent for a registered child session', () => {
    registerChildAgent('child-session', 'editor', 'root-session');

    expect(resolveSubsessionParentID('child-session')).toBe('root-session');
  });

  test('flattens nested child sessions to the root parent', () => {
    registerChildAgent('nested-session', 'editor', 'root-session');
    registerChildAgent('child-session', 'editor', 'nested-session');

    expect(resolveSubsessionParentID('child-session')).toBe('root-session');
  });
});

describe('runSubagent', () => {
  test('creates child sessions under the flattened root parent', async () => {
    const client = createMockClient();
    registerChildAgent('child-session', 'editor', 'root-session');
    client.session.create = vi.fn(() =>
      Promise.resolve({ data: { id: 'grandchild-session' } }),
    );
    client.session.prompt = vi.fn(() => Promise.resolve());
    client.session.messages = vi.fn(() =>
      Promise.resolve({
        data: [
          {
            info: { role: 'assistant' },
            parts: [{ type: 'text', text: 'done' }],
          },
        ],
      }),
    );

    const result = await runSubagent(client, {
      agent: 'editor',
      title: 'Editor',
      parts: [{ type: 'text', text: 'test' }],
      directory: '/tmp',
      sessionID: 'child-session',
    });

    expect(client.session.create).toHaveBeenCalledWith({
      query: { directory: '/tmp' },
      body: {
        parentID: 'root-session',
        title: 'Editor',
      },
    });
    expect(resolveSubsessionParentID('grandchild-session')).toBe(
      'root-session',
    );
    expect(result).toBe('done');
  });
});
