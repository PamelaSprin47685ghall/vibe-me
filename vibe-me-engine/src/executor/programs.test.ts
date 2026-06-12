import { describe, expect, it } from 'bun:test';
import { spawnExecutorProgram } from './programs.js';
import { EXECUTOR_TIMEOUT_MS } from './types.js';

describe('spawnExecutorProgram', () => {
  it('returns stdout for a fast shell command and marks not timed out', async () => {
    const result = await spawnExecutorProgram(
      'bash',
      ['-c', 'echo hello'],
      process.cwd(),
      EXECUTOR_TIMEOUT_MS.long,
    );
    expect(result.timedOut).toBe(false);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('hello');
  });

  it('returns timedOut=true and kills the process when the timeout elapses', async () => {
    const start = Date.now();
    const result = await spawnExecutorProgram(
      'bash',
      ['-c', 'sleep 5'],
      process.cwd(),
      600,
    );
    const elapsed = Date.now() - start;
    expect(result.timedOut).toBe(true);
    expect(elapsed).toBeLessThan(2_500);
  }, 5_000);
});
