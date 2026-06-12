import { describe, expect, test } from 'bun:test';
import { emptyJob, jobOutput, MAX_OUTPUT_BYTES } from './job-data.js';
import { completedState, abortedState } from '../types/runner/state.js';

describe('job-data', () => {
  test('emptyJob creates Running state with correct startTime', () => {
    const record = emptyJob('session-1', '/tmp/stdout.log', '/tmp/project', 123, 'parent-1');
    expect(record.state._tag).toBe('Running');
    if (record.state._tag === 'Running') {
      expect(record.state.startTime).toBe(123);
    }
    expect(record.sessionId).toBe('session-1');
    expect(record.parentSessionId).toBe('parent-1');
  });

  test('jobOutput returns empty for Idle', () => {
    expect(jobOutput({ _tag: 'Idle' })).toBe('');
  });

  test('jobOutput returns output for Completed', () => {
    expect(jobOutput(completedState('done'))).toBe('done');
  });

  test('jobOutput returns output for Aborted', () => {
    expect(jobOutput(abortedState('err'))).toBe('err');
  });

  test('jobOutput returns output for Running', () => {
    const record = emptyJob('s', '/tmp/o', undefined, 0);
    if (record.state._tag === 'Running') {
      expect(jobOutput(record.state)).toBe('');
    }
  });

  test('MAX_OUTPUT_BYTES is re-exported', () => {
    expect(MAX_OUTPUT_BYTES).toBe(1024 * 1024);
  });
});