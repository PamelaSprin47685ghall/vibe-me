import { describe, expect, test } from 'bun:test';
import { appendOutput, emptyJob, markAborted, markCompleted, MAX_OUTPUT_BYTES } from './job-data.js';

describe('job-data', () => {
  test('emptyJob uses explicit start time', () => {
    const job = emptyJob('session-1', '/tmp/stdout.log', '/tmp/project', 123, 'parent-1');

    expect(job.startTime).toBe(123);
    expect(job.sessionId).toBe('session-1');
    expect(job.parentSessionId).toBe('parent-1');
  });

  test('appendOutput stops at the output limit', () => {
    const job = emptyJob('session-1', '/tmp/stdout.log', '/tmp/project', 123);
    const nearLimit = appendOutput(job, 'x'.repeat(MAX_OUTPUT_BYTES - 1));
    const capped = appendOutput(nearLimit, 'y');

    expect(nearLimit.finalOutput.length).toBe(MAX_OUTPUT_BYTES - 1);
    expect(capped.finalOutput.length).toBe(MAX_OUTPUT_BYTES);
  });

  test('markCompleted and markAborted only update status', () => {
    const job = emptyJob('session-1', '/tmp/stdout.log', '/tmp/project', 123);

    expect(markCompleted(job).status._tag).toBe('Completed');
    expect(markAborted(job).status._tag).toBe('Aborted');
    expect(job.status._tag).toBe('Running');
  });
});
