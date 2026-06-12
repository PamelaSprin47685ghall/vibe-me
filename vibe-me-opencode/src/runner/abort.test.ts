import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { abort, cleanupJob, createJobRegistry, execute, getActiveJobs } from 'engine/runner';

const jobs = createJobRegistry();

describe('abort', () => {
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

  it('should abort running task', async () => {
    await execute({
      jobs,
      sessionId: 'test-abort',
      program: 'sleep 100',
      language: 'shell',
      earlyTimeoutMs: 50,
    });

    const result = abort(jobs, 'test-abort');
    expect(result).toContain('forcefully terminated');
    expect(getActiveJobs(jobs).has('test-abort')).toBe(false);
  });

  it('should handle abort of nonexistent task', () => {
    const result = abort(jobs, 'nonexistent');
    expect(result).toContain('No active task');
  });
});

describe('cleanupJob', () => {
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

  it('should clean up active job', async () => {
    await execute({
      jobs,
      sessionId: 'test-cleanup',
      program: 'sleep 100',
      language: 'shell',
      earlyTimeoutMs: 50,
    });

    expect(getActiveJobs(jobs).has('test-cleanup')).toBe(true);
    cleanupJob(jobs, 'test-cleanup');
    expect(getActiveJobs(jobs).has('test-cleanup')).toBe(false);
  });
});
