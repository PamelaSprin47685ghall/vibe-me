import type { GrepCursor } from '@ff-labs/fff-node';
import { createFinder } from './finder.js';
import { getCachedFinder } from './finder-registry.js';
import { buildQuery, resolveFuzzySearchPath } from './query.js';
import { formatFindOutput, formatGrepOutput, fileAnnotation } from './format.js';
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

type FinderLike = Awaited<ReturnType<typeof createFinder>>;

function resolveStore(opts: SearchOptions) { return opts.store ?? globalIteratorStore; }

async function acquireFinder(externalBasePath: string | null, cwd: string): Promise<FinderLike> {
  return externalBasePath ? await createFinder(externalBasePath) : await getCachedFinder(cwd);
}

function releaseFinder(finder: FinderLike, externalBasePath: string | null) {
  if (externalBasePath) { try { finder.destroy(); } catch {} }
}

export async function fuzzyFind(
  params: FuzzyFindParams, options: SearchOptions
): Promise<{ output: string; isError?: boolean }> {
  const store = resolveStore(options);
  const activeCwd = options.cwd;

  let searchState: FuzzyFindState | undefined;
  if (params.iterator) {
    searchState = consumeIterator<FuzzyFindState>(store, params.iterator);
    if (!searchState) {
      return { output: `fuzzy_find iterator error: unknown, expired, or already consumed iterator "${params.iterator}"`, isError: true };
    }
  } else {
    if (!params.pattern) return { output: 'pattern is required on the first call', isError: true };
    const searchPath = resolveFuzzySearchPath(params.path, activeCwd);
    const externalBasePath = searchPath.external ? searchPath.basePath : null;
    searchState = {
      query: buildQuery(searchPath.pathConstraint, params.pattern, undefined, searchPath.basePath, searchPath.external),
      pageSize: params.limit ?? 30, pageIndex: 0, externalBasePath,
    };
  }

  const externalBasePath = searchState.externalBasePath;
  const finder = await acquireFinder(externalBasePath, activeCwd);
  try {
    const searchResult = finder.fileSearch(searchState.query, { pageIndex: searchState.pageIndex, pageSize: searchState.pageSize });
    if (!searchResult?.ok) throw new Error((searchResult as { error?: string })?.error || 'fuzzy_find failed');
    const result = searchResult.value;
    if (!result?.items?.length) return { output: 'No matching files found\n\n[iterator=""]' };

    const lines = [formatFindOutput(result).split('\n')[0], ''];
    for (const item of result.items) lines.push(`${item.relativePath}${fileAnnotation(item)}`);
    const nextPageIndex = searchState.pageIndex + 1;
    const nextIterator = (result.totalMatched ?? 0) > nextPageIndex * searchState.pageSize
      ? storeIterator(store, options.scopeId, 'ffi_f', { ...searchState, pageIndex: nextPageIndex }) : '';
    return { output: `${lines.join('\n')}\n\n[iterator="${nextIterator}"]` };
  } finally {
    releaseFinder(finder, externalBasePath);
  }
}

export async function fuzzyGrep(
  params: FuzzyGrepParams, options: SearchOptions
): Promise<{ output: string; isError?: boolean }> {
  const store = resolveStore(options);
  const activeCwd = options.cwd;

  let searchState: FuzzyGrepState | undefined;
  if (params.iterator) {
    searchState = consumeIterator<FuzzyGrepState>(store, params.iterator);
    if (!searchState) {
      return { output: `fuzzy_grep iterator error: unknown, expired, or already consumed iterator "${params.iterator}"`, isError: true };
    }
  } else {
    if (!params.pattern) return { output: 'pattern is required on the first call', isError: true };
    const searchPath = resolveFuzzySearchPath(params.path, activeCwd);
    const externalBasePath = searchPath.external ? searchPath.basePath : null;
    const query = buildQuery(searchPath.pathConstraint, params.pattern, params.exclude, searchPath.basePath, searchPath.external);

    const hasRegexSyntax = params.pattern !== params.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let mode: 'plain' | 'regex' | 'fuzzy' = hasRegexSyntax ? 'regex' : 'plain';
    if (mode === 'regex') { try { new RegExp(params.pattern); } catch { mode = 'plain'; } }

    const trimmed = params.pattern.trim();
    const isWildcardOnly = hasRegexSyntax && /^(?:[.^$]*(?:[.][*+?]|\*|\+)[.^$]*|[.^$\s]*|\.\*\??|\.\*[+?]?|\.\+\??|\.|\*|\?)$/.test(trimmed);
    if (isWildcardOnly) {
      return { output: `Pattern '${params.pattern}' matches everything - fuzzy_grep needs a concrete substring or identifier.`, isError: true };
    }

    searchState = {
      query, mode, smartCase: params.caseSensitive !== true,
      beforeContext: params.context ?? 0, afterContext: params.context ?? 0,
      pageSize: params.limit ?? 50, externalBasePath, cursor: null,
    };
  }

  const externalBasePath = searchState.externalBasePath;
  const finder = await acquireFinder(externalBasePath, activeCwd);
  try {
    const grepResult = finder.grep(searchState.query, {
      mode: searchState.mode, smartCase: searchState.smartCase,
      maxMatchesPerFile: Math.min(searchState.pageSize, 50), pageSize: searchState.pageSize,
      cursor: searchState.cursor, beforeContext: searchState.beforeContext,
      afterContext: searchState.afterContext, classifyDefinitions: true,
    });
    if (!grepResult?.ok) throw new Error((grepResult as { error?: string })?.error || 'fuzzy_grep failed');

    let result = grepResult.value;
    let fuzzyNotice: string | null = null;
    if (!result?.items?.length && !params.iterator && searchState.mode !== 'regex') {
      const fuzzy = finder.grep(searchState.query, {
        mode: 'fuzzy', smartCase: searchState.smartCase,
        maxMatchesPerFile: Math.min(searchState.pageSize, 50), pageSize: searchState.pageSize,
        cursor: null, beforeContext: 0, afterContext: 0, classifyDefinitions: true,
      });
      if (fuzzy?.ok && fuzzy.value?.items?.length) {
        fuzzyNotice = '0 exact matches. Maybe you meant this?';
        result = fuzzy.value;
        searchState = { ...searchState, mode: 'fuzzy', beforeContext: 0, afterContext: 0, cursor: null };
      }
    }

    let output = formatGrepOutput(result);
    const notices: string[] = [];
    if (result?.regexFallbackError) notices.push(`Invalid regex: ${result.regexFallbackError}, used literal match`);
    const nextIterator = result?.nextCursor
      ? storeIterator(store, options.scopeId, 'ffi_i', { ...searchState, cursor: result.nextCursor }) : '';
    notices.push(`iterator="${nextIterator}"`);
    if (notices.length > 0) output += `\n\n[${notices.join('. ')}]`;
    if (fuzzyNotice) output = `[${fuzzyNotice}]\n${output}`;
    return { output };
  } finally {
    releaseFinder(finder, externalBasePath);
  }
}
