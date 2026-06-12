import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  cleanupJob,
  createJobRegistry,
  execute,
  getActiveJobs,
  type WaitResult,
  wait,
} from 'engine/runner';

const jobs = createJobRegistry();

describe('wait', () => {
  beforeEach(() => {
    for (const [sessionId] of getActiveJobs(jobs)) {
      cleanupJob(jobs, sessionId);
    }
  });

  afterEach(() => {
    for (const [sessionId] of getActiveJobs(jobs)) {
      cleanupJob(jobs, sessionId);
    }
  });

  it('returns completed result with empty output if no active job', async () => {
    const result = await wait({ jobs, sessionId: 'nonexistent', ms: 1000 });
    expect(result.completed).toBe(true);
    expect(result.output).toBe('');
    expect(result.message).toContain('No active job');
  });

  it('should wait and return output for background task', async () => {
    const execResult = await execute({
      jobs,
      sessionId: 'test-wait',
      program: 'sleep 10',
      language: 'shell',
      earlyTimeoutMs: 50,
    });

    if (execResult.background) {
      const waitResult: WaitResult = await wait({
        jobs,
        sessionId: 'test-wait',
        ms: 1000,
      });

      expect(waitResult.completed).toBe(false);
    }
  });

  it('should detect completed task', async () => {
    const execResult = await execute({
      jobs,
      sessionId: 'test-complete',
      program: 'echo "finished"',
      language: 'shell',
      earlyTimeoutMs: 50,
    });

    if (execResult.background) {
      const waitResult: WaitResult = await wait({
        jobs,
        sessionId: 'test-complete',
        ms: 1000,
      });

      expect(waitResult.completed).toBe(true);
      expect(waitResult.output).toContain('finished');
    }
  });
});
