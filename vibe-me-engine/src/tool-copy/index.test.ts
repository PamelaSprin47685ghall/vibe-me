import { describe, expect, it } from 'bun:test';
import { TOOL_COPY } from './index.js';

const TOOLS = [
  'editor', 'greper', 'reverie', 'browser', 'runner',
  'websearch', 'webfetch', 'fuzzy_find', 'fuzzy_grep',
] as const;

const PARAM_KEYS: Record<string, readonly string[]> = {
  editor: ['intents'],
  greper: ['intents'],
  reverie: ['intent', 'files'],
  browser: ['intent'],
  runner: ['language', 'program', 'dependencies', 'what_to_summarize'],
  websearch: ['query', 'numResults'],
  webfetch: ['url', 'extract_main', 'prefer_llms_txt', 'prompt', 'timeout'],
  fuzzy_find: ['pattern', 'path', 'limit', 'iterator'],
  fuzzy_grep: ['pattern', 'path', 'exclude', 'caseSensitive', 'context', 'limit', 'iterator'],
};

describe('TOOL_COPY catalog', () => {
  it('covers every shared tool exactly', () => {
    expect(Object.keys(TOOL_COPY).sort()).toEqual([...TOOLS].sort());
  });

  for (const tool of TOOLS) {
    it(`${tool} has non-empty description and the expected params`, () => {
      const entry = TOOL_COPY[tool];
      expect(entry.description.length).toBeGreaterThan(0);
      expect(Object.keys(entry.params).sort()).toEqual([...PARAM_KEYS[tool]!].sort());
      for (const value of Object.values(entry.params)) {
        expect(value.length).toBeGreaterThan(0);
      }
    });
  }

  it('keeps the load-bearing context warning on every delegation tool', () => {
    for (const tool of ['editor', 'greper', 'reverie', 'browser'] as const) {
      expect(TOOL_COPY[tool].description).toContain('Do NOT assume');
    }
  });
});
