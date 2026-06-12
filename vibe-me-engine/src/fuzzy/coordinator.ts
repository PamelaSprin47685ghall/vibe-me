import type { GrepCursor, GrepOptions } from '@ff-labs/fff-node';
import { createFinder } from './finder.js';
import { getCachedFinder } from './finder-registry.js';
import { buildQuery, resolveFuzzySearchPath } from './query.js';
import type { ResolvedFuzzySearchPath } from './query.js';
import { formatFindOutput, formatGrepOutput, fileAnnotation } from './format.js';
import type { FindResultLike, GrepResultLike } from './format.js';
import { IteratorStore, globalIteratorStore, storeIterator, consumeIterator } from '../util/iterator.js';

export interface FuzzyFindParams { pattern?: string; path?: string; limit?: number; iterator?: string }
export interface FuzzyGrepParams {
  pattern?: string; path?: string; exclude?: string | string[];
  caseSensitive?: boolean; context?: number; limit?: number; iterator?: string;
}
export interface SearchOptions { cwd: string; scopeId: string; store?: IteratorStore }
export interface FuzzyFindState { query: string; pageSize: number; pageIndex: number; externalBasePath: string | null }
export interface FuzzyGrepState {
  query: string; mode: 'plain' | 'regex' | 'fuzzy'; smartCase: boolean;
  beforeContext: number; afterContext: number; pageSize: number;
  externalBasePath: string | null; cursor: GrepCursor | null;
}

export type FinderResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface FinderLike {
  fileSearch(query: string, options: { pageIndex: number; pageSize: number }): FinderResult<FindResultLike>;
  grep(query: string, options: GrepOptions): FinderResult<GrepResultLike>;
  destroy(): void;
}

export interface CoordinatorDeps {
  createFinder: (basePath: string) => Promise<FinderLike>;
  getCachedFinder: (cwd: string) => Promise<FinderLike>;
  buildQuery: (fpath: string | undefined | null, pattern: string, exclude: string | string[] | undefined | null, cwd?: string, allowExternal?: boolean) => string;
  resolveFuzzySearchPath: (inputPath: string | undefined | null, cwd?: string) => ResolvedFuzzySearchPath;
  formatGrepOutput: (result: GrepResultLike | null | undefined) => string;
  fileAnnotation: (item: { gitStatus?: string; totalFrecencyScore?: number; accessFrecencyScore?: number } | null | undefined) => string;
  globalIteratorStore: IteratorStore;
  storeIterator: <T>(store: IteratorStore, scopeId: string, namespace: string, value: T) => string;
  consumeIterator: <T>(store: IteratorStore, id: string) => T | undefined;
}

const defaultDeps: CoordinatorDeps = {
  createFinder,
  getCachedFinder,
  buildQuery,
  resolveFuzzySearchPath,
  formatGrepOutput,
  fileAnnotation,
  globalIteratorStore,
  storeIterator,
  consumeIterator,
};

function resolveStore(opts: SearchOptions) { return opts.store ?? globalIteratorStore; }

async function acquireFinder(externalBasePath: string | null, cwd: string, deps: CoordinatorDeps): Promise<FinderLike> {
  return externalBasePath ? await deps.createFinder(externalBasePath) : await deps.getCachedFinder(cwd);
}

function releaseFinder(finder: FinderLike, externalBasePath: string | null) {
  if (externalBasePath) { try { finder.destroy(); } catch {} }
}

function detectGrepMode(pattern: string): 'plain' | 'regex' | 'fuzzy' {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (pattern === escaped) return 'plain';
  try { new RegExp(pattern); return 'regex'; } catch { return 'plain'; }
}

function checkWildcardOnly(pattern: string, mode: 'plain' | 'regex' | 'fuzzy'): boolean {
  if (mode === 'plain') return false;
  return /^(?:[.^$]*(?:[.][*+?]|\*|\+)[.^$]*|[.^$\s]*|\.\*\??|\.\*[+?]?|\.+\??|\.|\*|\?)$/.test(pattern.trim());
}

function buildGrepQuery(params: FuzzyGrepParams, searchPath: ResolvedFuzzySearchPath, deps: CoordinatorDeps): string {
  return deps.buildQuery(searchPath.pathConstraint, params.pattern as string, params.exclude, searchPath.basePath, searchPath.external);
}

type GrepSearchStateResult =
  | { searchState: FuzzyGrepState }
  | { output: string; isError: true };

function resolveGrepSearchState(params: FuzzyGrepParams, options: SearchOptions, deps: CoordinatorDeps): GrepSearchStateResult {
  const store = resolveStore(options);
  if (params.iterator) {
    const searchState = deps.consumeIterator<FuzzyGrepState>(store, params.iterator);
    if (!searchState) {
      return { output: `fuzzy_grep iterator error: unknown, expired, or already consumed iterator "${params.iterator}"`, isError: true };
    }
    return { searchState };
  }
  if (!params.pattern) return { output: 'pattern is required on the first call', isError: true };

  const searchPath = deps.resolveFuzzySearchPath(params.path, options.cwd);
  const externalBasePath = searchPath.external ? searchPath.basePath : null;
  const query = buildGrepQuery(params, searchPath, deps);
  const mode = detectGrepMode(params.pattern);
  if (checkWildcardOnly(params.pattern, mode)) {
    return { output: `Pattern '${params.pattern}' matches everything - fuzzy_grep needs a concrete substring or identifier.`, isError: true };
  }
  return {
    searchState: {
      query, mode, smartCase: params.caseSensitive !== true,
      beforeContext: params.context ?? 0, afterContext: params.context ?? 0,
      pageSize: params.limit ?? 50, externalBasePath, cursor: null,
    },
  };
}

function runGrepSearch(
  finder: FinderLike,
  searchState: FuzzyGrepState,
  modeOverride?: 'plain' | 'regex' | 'fuzzy',
): { value?: GrepResultLike; error?: string } {
  const mode = modeOverride ?? searchState.mode;
  const sameMode = mode === searchState.mode;
  const grepResult = finder.grep(searchState.query, {
    mode,
    smartCase: searchState.smartCase,
    maxMatchesPerFile: Math.min(searchState.pageSize, 50),
    pageSize: searchState.pageSize,
    cursor: sameMode ? searchState.cursor : null,
    beforeContext: sameMode ? searchState.beforeContext : 0,
    afterContext: sameMode ? searchState.afterContext : 0,
    classifyDefinitions: true,
  });
  return grepResult.ok ? { value: grepResult.value } : { error: grepResult.error };
}

function executeGrepSearch(finder: FinderLike, searchState: FuzzyGrepState, modeOverride?: 'plain' | 'regex' | 'fuzzy'): GrepResultLike {
  const { value, error } = runGrepSearch(finder, searchState, modeOverride);
  if (!value) throw new Error(error || 'fuzzy_grep failed');
  return value;
}

function tryFuzzyFallback(
  finder: FinderLike,
  searchState: FuzzyGrepState,
  params: FuzzyGrepParams,
  result: GrepResultLike | undefined,
): { result: GrepResultLike | undefined; fuzzyNotice: string | null; searchState: FuzzyGrepState } {
  if (result?.items?.length || params.iterator || searchState.mode === 'regex') {
    return { result, fuzzyNotice: null, searchState };
  }
  const { value: fuzzy } = runGrepSearch(finder, searchState, 'fuzzy');
  if (fuzzy?.items?.length) {
    return {
      result: fuzzy,
      fuzzyNotice: '0 exact matches. Maybe you meant this?',
      searchState: { ...searchState, mode: 'fuzzy', beforeContext: 0, afterContext: 0, cursor: null },
    };
  }
  return { result, fuzzyNotice: null, searchState };
}

function buildGrepResultOutput(
  result: GrepResultLike | undefined,
  searchState: FuzzyGrepState,
  fuzzyNotice: string | null,
  store: IteratorStore,
  scopeId: string,
  deps: CoordinatorDeps,
): string {
  let output = deps.formatGrepOutput(result);
  const notices: string[] = [];
  if (result?.regexFallbackError) notices.push(`Invalid regex: ${result.regexFallbackError}, used literal match`);
  const nextIterator = result?.nextCursor
    ? deps.storeIterator(store, scopeId, 'ffi_i', { ...searchState, cursor: result.nextCursor as GrepCursor })
    : '';
  notices.push(`iterator="${nextIterator}"`);
  if (notices.length > 0) output += `\n\n[${notices.join('. ')}]`;
  if (fuzzyNotice) output = `[${fuzzyNotice}]\n${output}`;
  return output;
}

export async function fuzzyGrep(
  params: FuzzyGrepParams,
  options: SearchOptions,
  deps: CoordinatorDeps = defaultDeps,
): Promise<{ output: string; isError?: boolean }> {
  const store = resolveStore(options);
  const stateResult = resolveGrepSearchState(params, options, deps);
  if ('isError' in stateResult) return stateResult;

  let { searchState } = stateResult;
  const externalBasePath = searchState.externalBasePath;
  const finder = await acquireFinder(externalBasePath, options.cwd, deps);
  try {
    const result = executeGrepSearch(finder, searchState);
    const fallback = tryFuzzyFallback(finder, searchState, params, result);
    searchState = fallback.searchState;
    const output = buildGrepResultOutput(fallback.result, searchState, fallback.fuzzyNotice, store, options.scopeId, deps);
    return { output };
  } finally {
    releaseFinder(finder, externalBasePath);
  }
}

type FindSearchStateResult =
  | { searchState: FuzzyFindState }
  | { output: string; isError: true };

function resolveFindSearchState(params: FuzzyFindParams, options: SearchOptions, deps: CoordinatorDeps): FindSearchStateResult {
  const store = resolveStore(options);
  if (params.iterator) {
    const searchState = deps.consumeIterator<FuzzyFindState>(store, params.iterator);
    if (!searchState) {
      return { output: `fuzzy_find iterator error: unknown, expired, or already consumed iterator "${params.iterator}"`, isError: true };
    }
    return { searchState };
  }
  if (!params.pattern) return { output: 'pattern is required on the first call', isError: true };

  const searchPath = deps.resolveFuzzySearchPath(params.path, options.cwd);
  const externalBasePath = searchPath.external ? searchPath.basePath : null;
  return {
    searchState: {
      query: deps.buildQuery(searchPath.pathConstraint, params.pattern, undefined, searchPath.basePath, searchPath.external),
      pageSize: params.limit ?? 30, pageIndex: 0, externalBasePath,
    },
  };
}

function executeFindSearch(finder: FinderLike, searchState: FuzzyFindState): FindResultLike {
  const searchResult = finder.fileSearch(searchState.query, { pageIndex: searchState.pageIndex, pageSize: searchState.pageSize });
  if (!searchResult.ok) throw new Error(searchResult.error || 'fuzzy_find failed');
  return searchResult.value;
}

function buildFindResultOutput(
  result: FindResultLike,
  searchState: FuzzyFindState,
  store: IteratorStore,
  scopeId: string,
  deps: CoordinatorDeps,
): string {
  if (!result.items?.length) return 'No matching files found\n\n[iterator=""]';

  const lines = [formatFindOutput(result).split('\n')[0]!, ''];
  for (const item of result.items) lines.push(`${item.relativePath}${deps.fileAnnotation(item)}`);
  const nextPageIndex = searchState.pageIndex + 1;
  const nextIterator = (result.totalMatched ?? 0) > nextPageIndex * searchState.pageSize
    ? deps.storeIterator(store, scopeId, 'ffi_f', { ...searchState, pageIndex: nextPageIndex })
    : '';
  return `${lines.join('\n')}\n\n[iterator="${nextIterator}"]`;
}

export async function fuzzyFind(
  params: FuzzyFindParams,
  options: SearchOptions,
  deps: CoordinatorDeps = defaultDeps,
): Promise<{ output: string; isError?: boolean }> {
  const store = resolveStore(options);
  const stateResult = resolveFindSearchState(params, options, deps);
  if ('isError' in stateResult) return stateResult;

  const { searchState } = stateResult;
  const externalBasePath = searchState.externalBasePath;
  const finder = await acquireFinder(externalBasePath, options.cwd, deps);
  try {
    const result = executeFindSearch(finder, searchState);
    const output = buildFindResultOutput(result, searchState, store, options.scopeId, deps);
    return { output };
  } finally {
    releaseFinder(finder, externalBasePath);
  }
}
