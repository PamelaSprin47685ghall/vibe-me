import { describe, expect, it } from 'vitest';
import { formatExecutorSafetyWarning } from './execute.js';

describe('formatExecutorSafetyWarning', () => {
  it('returns output unchanged for non-shell languages', () => {
    expect(formatExecutorSafetyWarning('hello', 'cat foo.txt', 'python')).toBe('hello');
    expect(formatExecutorSafetyWarning('hello', 'cat foo.txt', 'javascript')).toBe('hello');
  });

  it('prepends warning when shell program is a read-only command', () => {
    const result = formatExecutorSafetyWarning('file content', 'cat foo.txt', 'shell');
    expect(result).toMatch(/绝对禁止.*executor.*查找或者读写文件/);
    expect(result.endsWith('file content')).toBe(true);
  });

  it('returns output unchanged for shell non-read-only commands', () => {
    expect(formatExecutorSafetyWarning('hello', 'echo hello', 'shell')).toBe('hello');
  });
});
