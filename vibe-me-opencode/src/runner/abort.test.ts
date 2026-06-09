import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { abort, cleanupJob, execute, getActiveJobs } from 'engine/runner';

describe('abort', () => {
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

  it('should abort running task', async () => {
    await execute({
      sessionId: 'test-abort',
      program: 'sleep 100',
      language: 'shell',
      earlyTimeoutMs: 50,
    });

    const result = abort('test-abort');
    expect(result).toContain('forcefully terminated');
    expect(getActiveJobs().has('test-abort')).toBe(false);
  });

  it('should handle abort of nonexistent task', () => {
    const result = abort('nonexistent');
    expect(result).toContain('No active task');
  });
});

describe('cleanupJob', () => {
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

  it('should clean up active job', async () => {
    await execute({
      sessionId: 'test-cleanup',
      program: 'sleep 100',
      language: 'shell',
      earlyTimeoutMs: 50,
    });

    expect(getActiveJobs().has('test-cleanup')).toBe(true);
    cleanupJob('test-cleanup');
    expect(getActiveJobs().has('test-cleanup')).toBe(false);
  });
});
