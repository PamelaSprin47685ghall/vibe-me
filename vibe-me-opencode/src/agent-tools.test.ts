import { describe, expect, test } from 'bun:test';
import {
  getAgentPermissionDefaults,
  getAgentToolDefaults,
  mergeTools,
} from './agent-tools.js';

const allToolKeys = [
  'read', 'write', 'edit', 'executor', 'glob', 'fuzzy_find', 'fuzzy_grep',
  'grep', 'editor', 'greper', 'reverie', 'submit_review',
  'submit_review_result', 'todowrite', 'webfetch', 'websearch', 'browser', 'task',
  'stealth_browser_mcp_star',
] as const;

function makeToolDefaults(
  trueKeys: readonly string[],
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const key of allToolKeys) result[key] = trueKeys.includes(key);
  return result;
}

describe('getAgentPermissionDefaults', () => {
  test('orchestrator', () => {
    expect(getAgentPermissionDefaults('orchestrator')).toEqual({
      bash: 'deny',
      'stealth-browser-mcp_star': 'deny',
      submit_review_result: 'deny',
      glob: 'deny',
      fuzzy_find: 'deny',
      fuzzy_grep: 'deny',
      grep: 'deny',
    });
  });

  test('editor', () => {
    expect(getAgentPermissionDefaults('editor')).toEqual({
      bash: 'deny',
      'stealth-browser-mcp_star': 'deny',
      submit_review_result: 'deny',
      fuzzy_find: 'allow',
      fuzzy_grep: 'allow',
      grep: 'deny',
      question: 'deny',
      todowrite: 'deny',
    });
  });

  test('greper', () => {
    expect(getAgentPermissionDefaults('greper')).toEqual({
      bash: 'deny',
      'stealth-browser-mcp_star': 'deny',
      submit_review_result: 'deny',
      fuzzy_find: 'allow',
      fuzzy_grep: 'allow',
      grep: 'deny',
      question: 'deny',
      todowrite: 'deny',
    });
  });

  test('browser', () => {
    expect(getAgentPermissionDefaults('browser')).toEqual({
      bash: 'deny',
      submit_review_result: 'deny',
      glob: 'deny',
      fuzzy_find: 'deny',
      fuzzy_grep: 'deny',
      grep: 'deny',
      question: 'deny',
      todowrite: 'deny',
    });
  });

  test('reverie', () => {
    expect(getAgentPermissionDefaults('reverie')).toEqual({
      bash: 'deny',
      'stealth-browser-mcp_star': 'deny',
      submit_review_result: 'deny',
      glob: 'deny',
      fuzzy_find: 'deny',
      fuzzy_grep: 'deny',
      grep: 'deny',
      question: 'deny',
      todowrite: 'deny',
    });
  });

  test('reviewer', () => {
    expect(getAgentPermissionDefaults('reviewer')).toEqual({
      bash: 'deny',
      'stealth-browser-mcp_star': 'deny',
      glob: 'deny',
      fuzzy_find: 'deny',
      fuzzy_grep: 'deny',
      grep: 'deny',
      question: 'deny',
      todowrite: 'deny',
    });
  });

  test('throws on bogus role', () => {
    expect(() => getAgentPermissionDefaults('bogus')).toThrow();
  });
});

describe('getAgentToolDefaults', () => {
  test('orchestrator', () => {
    expect(getAgentToolDefaults('orchestrator')).toEqual(
      makeToolDefaults([
        'read', 'executor', 'glob', 'editor', 'greper', 'reverie',
        'submit_review', 'todowrite', 'webfetch', 'websearch', 'browser',
      ]),
    );
  });

  test('editor', () => {
    expect(getAgentToolDefaults('editor')).toEqual(
      makeToolDefaults(['read', 'write', 'edit', 'glob', 'fuzzy_find', 'fuzzy_grep']),
    );
  });

  test('greper', () => {
    expect(getAgentToolDefaults('greper')).toEqual(
      makeToolDefaults(['read', 'executor', 'glob', 'fuzzy_find', 'fuzzy_grep']),
    );
  });

  test('browser', () => {
    expect(getAgentToolDefaults('browser')).toEqual(
      makeToolDefaults(['read', 'stealth_browser_mcp_star']),
    );
  });

  test('reverie', () => {
    expect(getAgentToolDefaults('reverie')).toEqual(
      makeToolDefaults([]),
    );
  });

  test('reviewer', () => {
    expect(getAgentToolDefaults('reviewer')).toEqual(
      makeToolDefaults(['read', 'submit_review_result']),
    );
  });

  test('throws on bogus role', () => {
    expect(() => getAgentToolDefaults('bogus')).toThrow();
  });
});

describe('mergeTools', () => {
  test('merges overrides onto defaults', () => {
    expect(mergeTools({ read: false, custom: true }, { read: true, write: false })).toEqual({
      read: false,
      write: false,
      custom: true,
    });
  });

  test('returns defaults when current is undefined', () => {
    expect(mergeTools(undefined, { read: true })).toEqual({ read: true });
  });

  test('skips non-boolean values in current', () => {
    expect(mergeTools({ x: 'notbool', y: true }, { read: true })).toEqual({
      read: true,
      y: true,
    });
  });
});
