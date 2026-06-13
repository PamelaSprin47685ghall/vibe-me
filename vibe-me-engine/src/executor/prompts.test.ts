import { describe, expect, it } from 'vitest';
import { buildExecutorSummaryPrompt, EXECUTOR_SUMMARIZER_SYSTEM_PROMPT } from './prompts.js';
import type { ExecuteResult } from './types.js';

describe('EXECUTOR_SUMMARIZER_SYSTEM_PROMPT', () => {
  it('explicitly forbids further tool use', () => {
    expect(EXECUTOR_SUMMARIZER_SYSTEM_PROMPT).toContain('CANNOT');
  });
});

describe('buildExecutorSummaryPrompt', () => {
  it('labels Completed output', () => {
    const result: ExecuteResult = { _tag: 'Completed', output: 'ok' };
    const prompt = buildExecutorSummaryPrompt(
      { program: 'echo ok', language: 'shell', dependencies: undefined, timeoutType: 'short' },
      result,
    );
    expect(prompt).toContain('has been executed');
    expect(prompt).toContain('ok');
  });

  it('labels Truncated output and surfaces the timeout type', () => {
    const result: ExecuteResult = { _tag: 'Truncated', output: 'partial', timeoutType: 'long' };
    const prompt = buildExecutorSummaryPrompt(
      { program: 'sleep 30', language: 'shell', dependencies: undefined, timeoutType: 'long' },
      result,
    );
    expect(prompt).toContain('exceeded the long timeout');
    expect(prompt).toContain('partial');
  });

  it('lists dependencies when provided', () => {
    const result: ExecuteResult = { _tag: 'Completed', output: '' };
    const prompt = buildExecutorSummaryPrompt(
      { program: 'print(1)', language: 'python', dependencies: ['numpy', 'requests'], timeoutType: 'long' },
      result,
    );
    expect(prompt).toContain('Dependencies: numpy, requests');
  });
});
