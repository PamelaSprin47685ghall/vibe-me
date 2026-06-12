import { describe, expect, it } from 'bun:test';
import { buildRunnerPrompt } from './prompts.js';

describe('buildRunnerPrompt', () => {
  it('foreground without dependencies', () => {
    const result = buildRunnerPrompt('shell', 'echo hi', undefined, 'the output', 'hello', 'Completed');
    expect(result).toContain('The following shell program has been executed.');
    expect(result).toContain('Task completed.');
    expect(result).toContain('Execution output:');
    expect(result).not.toContain('running in background');
    expect(result).not.toContain('Dependencies:');
  });

  it('background with jobId', () => {
    const result = buildRunnerPrompt('shell', 'sleep 10', undefined, 'the output', 'starting', 'Backgrounded', 'x');
    expect(result).toContain('The following shell program is running in background.');
    expect(result).toContain('Use runner_wait to poll for more output or runner_abort to stop the task.');
    expect(result).toContain('Initial output:');
    expect(result).toContain('Job ID: x');
  });

  it('with dependencies array', () => {
    const result = buildRunnerPrompt('python', 'import numpy', ['numpy', 'requests'], 'output', 'ok', 'Completed');
    expect(result).toContain('Dependencies: numpy, requests');
  });

  it('undefined dependencies skips Dependencies line', () => {
    const result = buildRunnerPrompt('shell', 'ls', undefined, 'files', 'output', 'Completed');
    expect(result).not.toContain('Dependencies:');
  });
});