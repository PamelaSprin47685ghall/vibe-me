import { describe, it, expect } from 'bun:test';
import { formatRunnerSafetyWarning, RUNNER_READ_ONLY_WARNING } from './prompts.js';

describe('formatRunnerSafetyWarning', () => {
  it('returns output unchanged for non-shell languages', () => {
    expect(formatRunnerSafetyWarning('hello', 'cat foo.txt', 'python')).toBe('hello');
    expect(formatRunnerSafetyWarning('hello', 'cat foo.txt', 'javascript')).toBe('hello');
  });

  it('prepends warning when shell program is a read-only command', () => {
    const result = formatRunnerSafetyWarning('file content', 'cat foo.txt', 'shell');
    expect(result).toBe(`${RUNNER_READ_ONLY_WARNING}\nfile content`);
    expect(result.startsWith(RUNNER_READ_ONLY_WARNING)).toBe(true);
  });

  it('extracts command from path-prefixed programs and still warns', () => {
    const result = formatRunnerSafetyWarning('match', '/usr/bin/grep -r foo', 'shell');
    expect(result).toBe(`${RUNNER_READ_ONLY_WARNING}\nmatch`);
  });

  it('returns output unchanged for shell non-read-only commands', () => {
    expect(formatRunnerSafetyWarning('hello', 'echo hello', 'shell')).toBe('hello');
  });

  it('returns output unchanged for empty program', () => {
    expect(formatRunnerSafetyWarning('some output', '', 'shell')).toBe('some output');
  });
});