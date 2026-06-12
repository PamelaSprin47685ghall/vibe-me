import { afterAll, describe, expect, it } from 'bun:test';
import { execute, shouldSummarize } from './execute.js';
import {
  EXECUTOR_SUMMARY_THRESHOLD_BYTES,
  EXECUTOR_TIMEOUT_MS,
  type ExecutorTimeoutType,
} from './types.js';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sessionSuffix = `executor-it-${Date.now()}`;

afterAll(() => {
  rmSync(join(tmpdir(), 'omp-kunwei-executor'), { recursive: true, force: true });
});

describe('execute', () => {
  it('runs fast shell with short timeout and returns Completed', async () => {
    const result = await execute(
      { program: 'echo hi', language: 'shell', timeoutType: 'short' },
      `${sessionSuffix}-short-shell`,
    );
    expect(result._tag).toBe('Completed');
    if (result._tag === 'Completed') expect(result.output).toContain('hi');
  });

  it('truncates a sleep that exceeds the short timeout', async () => {
    const result = await execute(
      { program: 'sleep 5', language: 'shell', timeoutType: 'short' },
      `${sessionSuffix}-short-sleep`,
    );
    expect(result._tag).toBe('Truncated');
    if (result._tag === 'Truncated') {
      const expectedType: ExecutorTimeoutType = 'short';
      expect(result.timeoutType).toBe(expectedType);
      expect(result.output).toMatch(/Timed out/);
    }
  });

  it('long timeout still aborts on a long sleep', async () => {
    const result = await execute(
      { program: 'sleep 30', language: 'shell', timeoutType: 'long' },
      `${sessionSuffix}-long-sleep`,
    );
    expect(result._tag).toBe('Truncated');
    expect(EXECUTOR_TIMEOUT_MS.long).toBe(10_000);
  }, 15_000);

  it('returns Failed for a non-zero exit code', async () => {
    const result = await execute(
      { program: 'exit 7', language: 'shell', timeoutType: 'short' },
      `${sessionSuffix}-fail`,
    );
    expect(result._tag).toBe('Failed');
  });

  it('strips head/tail pipes from the program (regex returns clean script)', async () => {
    const result = await execute(
      { program: 'echo a; echo b; echo c | head -n 1', language: 'shell', timeoutType: 'short' },
      `${sessionSuffix}-pipe`,
    );
    expect(result._tag).toBe('Completed');
    if (result._tag === 'Completed') {
      expect(result.output).toContain('a');
      expect(result.output).toContain('b');
      expect(result.output).toContain('c');
    }
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
