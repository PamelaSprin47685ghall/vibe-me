import type { PluginInput } from '@opencode-ai/plugin';
import {
  EXECUTOR_SUMMARIZER_SYSTEM_PROMPT,
  type ExecuteOptions,
  type ExecuteResult,
} from 'engine/executor';
import { describe, expect, test, vi } from 'vitest';
import { isAbortError } from '../utils/abort-signal';
import { extractToolContext } from '../utils/tool-context';
import { type CreateExecutorToolDeps, createExecutorTool } from './tool';

function createFakeClient() {
  const abortMock = vi.fn(async () => undefined);
  return {
    abortMock,
    client: {
      session: {
        abort: abortMock,
      },
    } as unknown as PluginInput['client'],
  };
}

function createPluginInput(client: PluginInput['client']): PluginInput {
  return { directory: '/tmp/project', client } as unknown as PluginInput;
}

function createFakeDeps(overrides?: Partial<CreateExecutorToolDeps>) {
  const executeMock = vi.fn(
    async (): Promise<ExecuteResult> => ({
      _tag: 'Completed',
      output: 'small output',
    }),
  );
  const createSummarizerSessionMock = vi.fn(
    async (
      _client: unknown,
      sessionID: string | undefined,
    ): Promise<{ childID: string; parentID: string | undefined }> => ({
      childID: 'child-1',
      parentID: sessionID,
    }),
  );
  const awaitSummarizerReportMock = vi.fn(
    async (): Promise<string> => 'summary report',
  );
  const resolveSubsessionParentIDMock = vi.fn(
    (sessionID?: string): string | undefined => sessionID,
  );

  const deps: CreateExecutorToolDeps = {
    execute: executeMock,
    createSummarizerSession: createSummarizerSessionMock,
    awaitSummarizerReport: awaitSummarizerReportMock,
    extractToolContext,
    resolveSubsessionParentID: resolveSubsessionParentIDMock,
    isAbortError,
    ...overrides,
  };

  return {
    deps,
    executeMock,
    createSummarizerSessionMock,
    awaitSummarizerReportMock,
    resolveSubsessionParentIDMock,
  };
}

describe('createExecutorTool', () => {
  test('returns output directly when under summarize threshold', async () => {
    const { client } = createFakeClient();
    const ctx = createPluginInput(client);
    const { deps, executeMock } = createFakeDeps();
    const executorTool = createExecutorTool(ctx, deps);

    const result = await (executorTool as any).execute(
      { program: 'echo hello', language: 'shell', timeout_type: 'short' },
      { directory: '/tmp', sessionID: 'session-1' },
    );

    expect(result).toBe('small output');
    expect(executeMock).toHaveBeenCalledTimes(1);
    const [options, sessionId] = executeMock.mock.calls[0] as [
      ExecuteOptions,
      string,
    ];
    expect(options).toMatchObject({
      program: 'echo hello',
      language: 'shell',
      timeoutType: 'short',
      cwd: '/tmp',
    });
    expect(sessionId).toMatch(/^session-1\//);
    expect(deps.createSummarizerSession).not.toHaveBeenCalled();
  });

  test('defaults invalid or missing language to shell before calling execute', async () => {
    for (const badLanguage of [undefined, 'bogus' as any]) {
      const { client } = createFakeClient();
      const ctx = createPluginInput(client);
      const { deps, executeMock } = createFakeDeps();
      const executorTool = createExecutorTool(ctx, deps);

      const result = await (executorTool as any).execute(
        { program: 'echo hello', language: badLanguage, timeout_type: 'short' },
        { directory: '/tmp', sessionID: 'session-1' },
      );

      expect(result).toBe('small output');
      expect(executeMock).toHaveBeenCalledTimes(1);
      const [options] = executeMock.mock.calls[0] as [ExecuteOptions, string];
      expect(options.language).toBe('shell');
    }
  });

  test('creates summarizer session and returns report for large output', async () => {
    const { client, abortMock } = createFakeClient();
    const ctx = createPluginInput(client);
    const largeOutput = 'x'.repeat(9000);
    const executeMock = vi.fn(
      async (): Promise<ExecuteResult> => ({
        _tag: 'Completed',
        output: largeOutput,
      }),
    );
    const { deps, createSummarizerSessionMock, awaitSummarizerReportMock } =
      createFakeDeps({
        execute: executeMock,
      });
    const executorTool = createExecutorTool(ctx, deps);

    const result = await (executorTool as any).execute(
      { program: 'cat big.log', language: 'shell', timeout_type: 'long' },
      { directory: '/tmp', sessionID: 'session-1' },
    );

    expect(result).toBe('summary report');
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(createSummarizerSessionMock).toHaveBeenCalledTimes(1);
    expect(createSummarizerSessionMock).toHaveBeenCalledWith(
      client,
      'session-1',
      '/tmp',
    );
    expect(awaitSummarizerReportMock).toHaveBeenCalledTimes(1);

    const [, childID, prompt, directory, abortSignal] =
      awaitSummarizerReportMock.mock.calls[0] as [
        unknown,
        string,
        string,
        string,
        AbortSignal | undefined,
      ];
    expect(childID).toBe('child-1');
    expect(directory).toBe('/tmp');
    expect(abortSignal).toBeUndefined();
    expect(prompt).toContain(EXECUTOR_SUMMARIZER_SYSTEM_PROMPT);
    expect(prompt).toContain('cat big.log');
    expect(prompt).toContain(largeOutput);
    expect(abortMock).toHaveBeenCalledTimes(1);
    expect(abortMock).toHaveBeenCalledWith({ path: { id: 'child-1' } });
  });

  test('aborts summarizer session after report', async () => {
    const { client, abortMock } = createFakeClient();
    const ctx = createPluginInput(client);
    const executeMock = vi.fn(
      async (): Promise<ExecuteResult> => ({
        _tag: 'Completed',
        output: 'x'.repeat(9000),
      }),
    );
    const { deps } = createFakeDeps({ execute: executeMock });
    const executorTool = createExecutorTool(ctx, deps);

    await (executorTool as any).execute(
      { program: 'cat big.log', language: 'shell', timeout_type: 'long' },
      { directory: '/tmp', sessionID: 'session-1' },
    );

    expect(abortMock).toHaveBeenCalledTimes(1);
    expect(abortMock).toHaveBeenCalledWith({ path: { id: 'child-1' } });
  });

  test('returns "(aborted)" on abort error', async () => {
    const { client, abortMock } = createFakeClient();
    const ctx = createPluginInput(client);
    const executeMock = vi.fn(
      async (): Promise<ExecuteResult> => ({
        _tag: 'Completed',
        output: 'x'.repeat(9000),
      }),
    );
    const awaitSummarizerReportMock = vi.fn(async () => {
      throw new DOMException('Aborted', 'AbortError');
    });
    const { deps } = createFakeDeps({
      execute: executeMock,
      awaitSummarizerReport: awaitSummarizerReportMock,
    });
    const executorTool = createExecutorTool(ctx, deps);

    const result = await (executorTool as any).execute(
      { program: 'cat big.log', language: 'shell', timeout_type: 'long' },
      { directory: '/tmp', sessionID: 'session-1' },
    );

    expect(result).toBe('(aborted)');
    expect(abortMock).toHaveBeenCalledTimes(1);
  });

  test('rethrows non-abort errors', async () => {
    const { client } = createFakeClient();
    const ctx = createPluginInput(client);
    const executeMock = vi.fn(async () => {
      throw new Error('execution failed');
    });
    const { deps } = createFakeDeps({ execute: executeMock });
    const executorTool = createExecutorTool(ctx, deps);

    await expect(
      (executorTool as any).execute(
        { program: 'false', language: 'shell', timeout_type: 'short' },
        { directory: '/tmp', sessionID: 'session-1' },
      ),
    ).rejects.toThrow('execution failed');
  });
});
