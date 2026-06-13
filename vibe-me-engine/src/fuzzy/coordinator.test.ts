import { describe, expect, it } from 'vitest';
import type { GrepCursor } from '@ff-labs/fff-node';
import { ok } from '../types/general.js';
import { fuzzyGrep, type CoordinatorDeps, type FinderLike } from './coordinator.js';
import type { FindResultLike, GrepResultLike } from './format.js';
import { createIteratorStore, storeIterator, consumeIterator } from '../util/iterator.js';

function makeFakeStore() {
  return createIteratorStore();
}

function makeFakeFinder(
  grepResults: Partial<Record<'plain' | 'regex' | 'fuzzy', GrepResultLike>>,
  findResult?: FindResultLike,
): FinderLike {
  return {
    fileSearch(_query, _options) {
      return { ok: true, value: findResult ?? { items: [] } };
    },
    grep(_query, options) {
      const value = grepResults[options.mode as 'plain' | 'regex' | 'fuzzy'];
      if (value === undefined) return { ok: false, error: `unexpected grep mode ${options.mode}` };
      return { ok: true, value };
    },
    destroy() {},
  };
}

function baseDeps(overrides: Partial<CoordinatorDeps> = {}): CoordinatorDeps {
  return {
    createFinder: async () => ok(makeFakeFinder({})),
    getCachedFinder: async () => ok(makeFakeFinder({})),
    buildQuery: (_fpath, pattern) => `query:${String(pattern)}`,
    resolveFuzzySearchPath: (_path, cwd) => ({ basePath: cwd ?? '/cwd', pathConstraint: null, external: false }),
    formatGrepOutput: (result) => `formatted:${result?.items?.length ?? 0}`,
    fileAnnotation: () => '',
    globalIteratorStore: makeFakeStore(),
    storeIterator,
    consumeIterator,
    ...overrides,
  };
}

describe('fuzzyGrep', () => {
  it('requires pattern on the first call', async () => {
    const res = await fuzzyGrep({}, { cwd: '/cwd', scopeId: 'scope' }, baseDeps());

    expect(res.isError).toBe(true);
    expect(res.output).toContain('pattern is required');
  });

  it('returns error when iterator has already been consumed', async () => {
    const store = makeFakeStore();
    const state = {
      query: 'q',
      mode: 'plain' as const,
      smartCase: true,
      beforeContext: 0,
      afterContext: 0,
      pageSize: 50,
      externalBasePath: null as string | null,
      cursor: null as GrepCursor | null,
    };
    const id = storeIterator(store, 'scope', 'ffi_i', state);
    const finder = makeFakeFinder({
      plain: { items: [{ relativePath: 'a.ts', lineNumber: 1, lineContent: 'x' }] },
    });
    const deps = baseDeps({ getCachedFinder: async () => ok(finder) });

    await fuzzyGrep({ iterator: id }, { cwd: '/cwd', scopeId: 'scope', store }, deps);
    const second = await fuzzyGrep({ iterator: id }, { cwd: '/cwd', scopeId: 'scope', store }, deps);

    expect(second.isError).toBe(true);
    expect(second.output).toContain('iterator error');
  });

  it('returns formatted output for a plain search', async () => {
    const store = makeFakeStore();
    const finder = makeFakeFinder({
      plain: { items: [{ relativePath: 'a.ts', lineNumber: 1, lineContent: 'foo' }], totalMatched: 1 },
    });
    const deps = baseDeps({ getCachedFinder: async () => ok(finder) });

    const res = await fuzzyGrep({ pattern: 'foo' }, { cwd: '/cwd', scopeId: 'scope', store }, deps);

    expect(res.isError).toBeUndefined();
    expect(res.output).toContain('formatted:1');
    expect(res.output).toContain('iterator=""');
  });

  it('includes regex fallback notice', async () => {
    const store = makeFakeStore();
    const finder = makeFakeFinder({
      regex: {
        items: [{ relativePath: 'b.ts', lineNumber: 2, lineContent: 'abc' }],
        regexFallbackError: 'bad regex',
      },
    });
    const deps = baseDeps({ getCachedFinder: async () => ok(finder) });

    const res = await fuzzyGrep({ pattern: 'a.*b' }, { cwd: '/cwd', scopeId: 'scope', store }, deps);

    expect(res.output).toContain('Invalid regex: bad regex');
    expect(res.output).toContain('formatted:1');
  });

  it('rejects wildcard-only pattern', async () => {
    const res = await fuzzyGrep(
      { pattern: '.*' },
      { cwd: '/cwd', scopeId: 'scope', store: makeFakeStore() },
      baseDeps(),
    );

    expect(res.isError).toBe(true);
    expect(res.output).toContain('matches everything');
  });

  it('falls back to fuzzy search when exact search is empty', async () => {
    const store = makeFakeStore();
    const finder = makeFakeFinder({
      plain: { items: [] },
      fuzzy: { items: [{ relativePath: 'c.ts', lineNumber: 3, lineContent: 'bar' }], totalMatched: 1 },
    });
    const deps = baseDeps({ getCachedFinder: async () => ok(finder) });

    const res = await fuzzyGrep({ pattern: 'bar' }, { cwd: '/cwd', scopeId: 'scope', store }, deps);

    expect(res.output).toContain('0 exact matches. Maybe you meant this?');
    expect(res.output).toContain('formatted:1');
  });

  it('stores an iterator when a nextCursor is returned', async () => {
    const store = makeFakeStore();
    const finder = makeFakeFinder({
      plain: { items: [{ relativePath: 'd.ts', lineNumber: 1, lineContent: 'x' }], nextCursor: 'cursor-1' },
    });
    const deps = baseDeps({ getCachedFinder: async () => ok(finder) });

    const res = await fuzzyGrep({ pattern: 'x' }, { cwd: '/cwd', scopeId: 'scope', store }, deps);

    expect(res.output).toContain('iterator="scope:ffi_i:1"');
    expect(store.iterators.has('scope:ffi_i:1')).toBe(true);
  });
});
