import { describe, expect, it } from 'vitest';
import { execute, shouldSummarize } from './execute.js';
import {
  EXECUTOR_SUMMARY_THRESHOLD_BYTES,
  EXECUTOR_TIMEOUT_MS,
  type ExecutorTimeoutType,
} from './types.js';
import type { RunProgram } from './execute.js';

function fakeRunProgram(result: {
  stdout?: string;
  stderr?: string;
  code: number | null;
  timedOut?: boolean;
}): RunProgram {
  return async () => ({
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    code: result.code,
    timedOut: result.timedOut ?? false,
  });
}

describe('execute', () => {
  it('returns Completed with output', async () => {
    const result = await execute(
      { program: 'echo hi', language: 'shell', timeoutType: 'short' },
      'session-completed',
      { runProgram: fakeRunProgram({ stdout: 'hi\n', code: 0 }) },
    );
    expect(result._tag).toBe('Completed');
    expect(result.output).toBe('hi');
  });

  it('returns Truncated with timeout suffix', async () => {
    const result = await execute(
      { program: 'slow', language: 'shell', timeoutType: 'short' },
      'session-truncated',
      { runProgram: fakeRunProgram({ stdout: 'partial', code: null, timedOut: true }) },
    );
    expect(result._tag).toBe('Truncated');
    if (result._tag === 'Truncated') {
      const expectedType: ExecutorTimeoutType = 'short';
      expect(result.timeoutType).toBe(expectedType);
      expect(result.output).toContain('partial');
      expect(result.output).toContain(
        `[executor] Timed out after ${EXECUTOR_TIMEOUT_MS.short}ms (short). Partial output returned.`,
      );
    }
  });

  it('returns Failed for non-zero exit code', async () => {
    const result = await execute(
      { program: 'exit 7', language: 'shell', timeoutType: 'short' },
      'session-fail-nonzero',
      { runProgram: fakeRunProgram({ stderr: 'error message', code: 7 }) },
    );
    expect(result._tag).toBe('Failed');
    expect(result.output).toContain('error message');
  });

  it('returns Completed fallback for zero exit code with no output', async () => {
    const result = await execute(
      { program: 'empty', language: 'shell', timeoutType: 'short' },
      'session-completed-fallback',
      { runProgram: fakeRunProgram({ code: 0 }) },
    );
    expect(result._tag).toBe('Completed');
    expect(result.output).toBe('(no output)');
  });

  it('strips head/tail pipes from shell program before running', async () => {
    let receivedProgram: string | undefined;
    const runProgram: RunProgram = async (options) => {
      receivedProgram = options.program;
      return { stdout: '', stderr: '', code: 0, timedOut: false };
    };
    const result = await execute(
      { program: 'echo a; echo b; echo c | head -n 1', language: 'shell', timeoutType: 'short' },
      'session-pipe',
      { runProgram },
    );
    expect(receivedProgram).toBe('echo a; echo b; echo c');
    expect(result._tag).toBe('Completed');
    expect(result.output).toBe('(no output)');
  });

  it('prepends safety warning for shell read commands', async () => {
    const result = await execute(
      { program: 'cat file.txt', language: 'shell', timeoutType: 'short' },
      'session-read-warning',
      { runProgram: fakeRunProgram({ stdout: 'file content', code: 0 }) },
    );
    expect(result._tag).toBe('Completed');
    expect(result.output).toMatch(/^\/\/ 绝对禁止使用 executor 工具仅仅用于查找或者读写文件，请使用专门工具例如 read\/greper\/editor 代替！/);
    expect(result.output).toContain('file content');
  });

  it('returns MissingExecutable for shell ENOENT', async () => {
    const runProgram: RunProgram = async () => {
      const error = new Error('spawn bash ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    };
    const result = await execute(
      { program: 'echo hi', language: 'shell', timeoutType: 'short' },
      'session-enoent-shell',
      { runProgram },
    );
    expect(result._tag).toBe('MissingExecutable');
    if (result._tag === 'MissingExecutable') {
      expect(result.executable).toBe('bash');
    }
  });

  it('returns MissingExecutable for python ENOENT', async () => {
    const runProgram: RunProgram = async () => {
      const error = new Error('spawn uvx ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    };
    const result = await execute(
      { program: 'print(1)', language: 'python', timeoutType: 'short' },
      'session-enoent-python',
      { runProgram },
    );
    expect(result._tag).toBe('MissingExecutable');
    if (result._tag === 'MissingExecutable') {
      expect(result.executable).toBe('uvx');
    }
  });

  it('returns MissingExecutable for javascript ENOENT', async () => {
    const runProgram: RunProgram = async () => {
      const error = new Error('spawn npx ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    };
    const result = await execute(
      { program: 'console.log(1)', language: 'javascript', timeoutType: 'short' },
      'session-enoent-javascript',
      { runProgram },
    );
    expect(result._tag).toBe('MissingExecutable');
    if (result._tag === 'MissingExecutable') {
      expect(result.executable).toBe('npx');
    }
  });

  it('rejects non-string sessionId', async () => {
    await expect(
      execute(
        { program: 'echo hi', language: 'shell', timeoutType: 'short' },
        123 as unknown as string,
      ),
    ).rejects.toThrow("executor: sessionId must be a string");
  });

  it('falls back to process.cwd when cwd is not a string', async () => {
    const runProgram: RunProgram = async (options) => {
      expect(options.cwd).toBe(process.cwd());
      return { stdout: '', stderr: '', code: 0, timedOut: false };
    };
    await execute(
      { program: 'echo hi', language: 'shell', timeoutType: 'short', cwd: 123 as unknown as string },
      'session-invalid-cwd',
      { runProgram },
    );
  });

  it('passes sessionId for temp script path', async () => {
    let receivedOptions: Parameters<RunProgram>[0] | undefined;
    const runProgram: RunProgram = async (options) => {
      receivedOptions = options;
      return { stdout: '', stderr: '', code: 0, timedOut: false };
    };
    await execute(
      { program: 'echo hi', language: 'shell', timeoutType: 'short' },
      'session-script-path',
      { runProgram },
    );
    expect(receivedOptions?.sessionId).toBe('session-script-path');
  });

  it('passes python dependencies to runProgram', async () => {
    let receivedOptions: Parameters<RunProgram>[0] | undefined;
    const runProgram: RunProgram = async (options) => {
      receivedOptions = options;
      return { stdout: '', stderr: '', code: 0, timedOut: false };
    };
    const result = await execute(
      { program: 'import six', language: 'python', timeoutType: 'short', dependencies: ['six'] },
      'session-python-deps',
      { runProgram },
    );
    expect(receivedOptions?.dependencies).toEqual(['six']);
    expect(result._tag).toBe('Completed');
  });
});

describe('shouldSummarize', () => {
  it('returns false at or below threshold', () => {
    const output = 'x'.repeat(EXECUTOR_SUMMARY_THRESHOLD_BYTES);
    expect(shouldSummarize(output)).toBe(false);
  });

  it('returns true above threshold', () => {
    const output = 'x'.repeat(EXECUTOR_SUMMARY_THRESHOLD_BYTES + 1);
    expect(shouldSummarize(output)).toBe(true);
  });
});
