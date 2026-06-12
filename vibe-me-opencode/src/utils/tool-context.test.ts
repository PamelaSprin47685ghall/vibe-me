import { describe, expect, test } from 'bun:test';
import { extractToolContext } from './tool-context';

describe('extractToolContext', () => {
  test('returns string directory from context', () => {
    const result = extractToolContext(
      { directory: '/ctx', sessionID: 's1' },
      '/fallback',
    );
    expect(result.directory).toBe('/ctx');
    expect(result.sessionID).toBe('s1');
  });

  test('falls back when context directory is not a string', () => {
    const result = extractToolContext({ directory: 123 }, '/fallback');
    expect(result.directory).toBe('/fallback');
  });

  test('falls back when context directory is missing', () => {
    const result = extractToolContext({ sessionID: 's1' }, '/fallback');
    expect(result.directory).toBe('/fallback');
  });

  test('falls back to process.cwd when fallbackDirectory is not a string', () => {
    const result = extractToolContext({}, 123 as unknown as string);
    expect(result.directory).toBe(process.cwd());
  });

  test('ignores non-string sessionID', () => {
    const result = extractToolContext({ sessionID: 123 }, '/fallback');
    expect(result.sessionID).toBeUndefined();
  });
});
