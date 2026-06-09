import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  cleanupJob,
  type ExecuteResult,
  execute,
  getActiveJobs,
} from 'engine/runner';
import { stripHeadTailPipes } from './no-head-tail.js';

describe('head/tail pipe stripping', () => {
  beforeEach(() => {
    const jobs = getActiveJobs();
    for (const [sessionId] of jobs) {
      cleanupJob(sessionId);
    }
  });

  afterEach(() => {
    const jobs = getActiveJobs();
    for (const [sessionId] of jobs) {
      cleanupJob(sessionId);
    }
  });

  it('strips head -n from shell pipe', async () => {
    const result: ExecuteResult = await execute({
      sessionId: 'test-head-pipe',
      program: 'echo hello | head -n 1',
      language: 'shell',
    });

    expect(result.output).toBe('hello');
  });

  it('strips tail -n from shell pipe', async () => {
    const result: ExecuteResult = await execute({
      sessionId: 'test-tail-pipe',
      program: 'echo "line1\nline2\nline3" | tail -n 1',
      language: 'shell',
    });

    expect(result.output).toContain('line1');
    expect(result.output).toContain('line2');
    expect(result.output).toContain('line3');
  });

  it('strips both head and tail from multi-pipe', async () => {
    const result: ExecuteResult = await execute({
      sessionId: 'test-multi-pipe',
      program: 'echo hello | head -n 10 | tail -n 5',
      language: 'shell',
    });

    expect(result.output).toBe('hello');
  });

  it('does not strip head/tail from python program', async () => {
    const result: ExecuteResult = await execute({
      sessionId: 'test-python-no-strip',
      program: 'print("hello | head -n 1")',
      language: 'python',
    });

    expect(result.output).toContain('hello | head -n 1');
  });

  it('stripHeadTailPipes unit test', () => {
    const result = stripHeadTailPipes('cat file | head -n 50');
    expect(result.script).toBe('cat file');
  });
});
