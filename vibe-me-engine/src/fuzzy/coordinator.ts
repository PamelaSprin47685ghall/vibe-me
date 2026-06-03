import path from 'node:path';
import { FinderManager, createExternalFinder } from './finder.js';
import { buildQuery, resolveExternalBasePath } from './query.js';
import { formatFindOutput, formatGrepOutput, fileAnnotation } from './format.js';
import { ScopedIteratorStore } from '../util/iterator.js';

const globalIteratorStore = new ScopedIteratorStore();

export interface FuzzyFindParams {
  pattern?: string;
  path?: string;
  limit?: number;
  iterator?: string;
}

export interface FuzzyGrepParams {
  pattern?: string;
  path?: string;
  exclude?: string | string[];
  caseSensitive?: boolean;
  context?: number;
  limit?: number;
  iterator?: string;
}

export interface SearchOptions {
  cwd: string;
  scopeId: string;
  store?: ScopedIteratorStore;
}

export interface FuzzyFindState {
  query: string;
  pageSize: number;
  pageIndex: number;
  externalBasePath: string | null;
}

export interface FuzzyGrepState {
  query: string;
  mode: 'plain' | 'regex' | 'fuzzy';
  smartCase: boolean;
  beforeContext: number;
  afterContext: number;
  pageSize: number;
  externalBasePath: string | null;
  cursor: any | null;
}

export class FuzzySearchCoordinator {
  static async fuzzyFind(
    params: FuzzyFindParams,
    options: SearchOptions
  ): Promise<{ output: string; isError?: boolean }> {
    const store = options.store ?? globalIteratorStore;
    const scopeId = options.scopeId;
    const activeCwd = options.cwd;

    let searchState: FuzzyFindState | undefined;
    if (params.iterator) {
      searchState = store.consume<FuzzyFindState>(params.iterator);
      if (!searchState) {
        return {
          output: `fuzzy_find iterator error: unknown, expired, or already consumed iterator "${params.iterator}"`,
          isError: true,
        };
      }
    } else {
      if (!params.pattern) {
        return { output: 'pattern is required on the first call', isError: true };
      }

      let externalBasePath: string | null = null;
      let externalPathConstraint: string | null = null;
      if (params.path && path.isAbsolute(params.path)) {
        const info = resolveExternalBasePath(path.resolve(params.path));
        externalBasePath = info.basePath;
        externalPathConstraint = info.pathConstraint;
      }

      searchState = {
        query: buildQuery(
          externalBasePath ? externalPathConstraint : params.path,
          params.pattern,
          undefined,
          externalBasePath ?? activeCwd,
          !!externalBasePath
        ),
        pageSize: params.limit ?? 30,
        pageIndex: 0,
        externalBasePath,
      };
    }

    const externalBasePath = searchState.externalBasePath;
    const finder = externalBasePath
      ? await createExternalFinder(externalBasePath)
      : await FinderManager.get(activeCwd);

    try {
      const searchResult = finder.fileSearch(searchState.query, {
        pageIndex: searchState.pageIndex,
        pageSize: searchState.pageSize,
      });

      if (!searchResult?.ok) {
        throw new Error((searchResult as { error?: string })?.error || 'fuzzy_find failed');
      }

      const result = searchResult.value;
      if (!result?.items?.length) {
        return { output: 'No matching files found\n\n[iterator=""]' };
      }

      // Format custom OMP or Mux fileAnnotation wrapper inside format output or build manually
      // OMP formats with a blank line after matching files info, then relativePath + fileAnnotation
      const lines = [formatFindOutput(result).split('\n')[0], ''];
      for (const item of result.items) {
        lines.push(`${item.relativePath}${fileAnnotation(item)}`);
      }

      const nextPageIndex = searchState.pageIndex + 1;
      const nextIterator = (result.totalMatched ?? 0) > nextPageIndex * searchState.pageSize
        ? store.store(scopeId, 'ffi_f', { ...searchState, pageIndex: nextPageIndex })
        : '';

      return { output: `${lines.join('\n')}\n\n[iterator="${nextIterator}"]` };
    } finally {
      if (externalBasePath) {
        try {
          finder.destroy();
        } catch {}
      }
    }
  }

  static async fuzzyGrep(
    params: FuzzyGrepParams,
    options: SearchOptions
  ): Promise<{ output: string; isError?: boolean }> {
    const store = options.store ?? globalIteratorStore;
    const scopeId = options.scopeId;
    const activeCwd = options.cwd;

    let searchState: FuzzyGrepState | undefined;
    if (params.iterator) {
      searchState = store.consume<FuzzyGrepState>(params.iterator);
      if (!searchState) {
        return {
          output: `fuzzy_grep iterator error: unknown, expired, or already consumed iterator "${params.iterator}"`,
          isError: true,
        };
      }
    } else {
      if (!params.pattern) {
        return { output: 'pattern is required on the first call', isError: true };
      }

      let externalBasePath: string | null = null;
      let externalPathConstraint: string | null = null;
      if (params.path && path.isAbsolute(params.path)) {
        const info = resolveExternalBasePath(path.resolve(params.path));
        externalBasePath = info.basePath;
        externalPathConstraint = info.pathConstraint;
      }

      const query = buildQuery(
        externalBasePath ? externalPathConstraint : params.path,
        params.pattern,
        params.exclude,
        externalBasePath ?? activeCwd,
        !!externalBasePath
      );

      const hasRegexSyntax = params.pattern !== params.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let mode: 'plain' | 'regex' | 'fuzzy' = hasRegexSyntax ? 'regex' : 'plain';
      if (mode === 'regex') {
        try {
          new RegExp(params.pattern);
        } catch {
          mode = 'plain';
        }
      }

      const trimmed = params.pattern.trim();
      const isWildcardOnly = hasRegexSyntax && /^(?:[.^$]*(?:[.][*+?]|\*|\+)[.^$]*|[.^$\s]*|\.\*\??|\.\*[+?]?|\.\+\??|\.|\*|\?)$/.test(trimmed);
      if (isWildcardOnly) {
        return {
          output: `Pattern '${params.pattern}' matches everything - fuzzy_grep needs a concrete substring or identifier.`,
          isError: true,
        };
      }

      searchState = {
        query,
        mode,
        smartCase: params.caseSensitive !== true,
        beforeContext: params.context ?? 0,
        afterContext: params.context ?? 0,
        pageSize: params.limit ?? 50,
        externalBasePath,
        cursor: null,
      };
    }

    const externalBasePath = searchState.externalBasePath;
    const finder = externalBasePath
      ? await createExternalFinder(externalBasePath)
      : await FinderManager.get(activeCwd);

    try {
      const grepResult = finder.grep(searchState.query, {
        mode: searchState.mode,
        smartCase: searchState.smartCase,
        maxMatchesPerFile: Math.min(searchState.pageSize, 50),
        pageSize: searchState.pageSize,
        cursor: searchState.cursor,
        beforeContext: searchState.beforeContext,
        afterContext: searchState.afterContext,
        classifyDefinitions: true,
      });

      if (!grepResult?.ok) {
        throw new Error((grepResult as { error?: string })?.error || 'fuzzy_grep failed');
      }

      let result = grepResult.value;
      let fuzzyNotice: string | null = null;
      if (!result?.items?.length && !params.iterator && searchState.mode !== 'regex') {
        try {
          const fuzzy = finder.grep(searchState.query, {
            mode: 'fuzzy',
            smartCase: searchState.smartCase,
            maxMatchesPerFile: Math.min(searchState.pageSize, 50),
            pageSize: searchState.pageSize,
            cursor: null,
            beforeContext: 0,
            afterContext: 0,
            classifyDefinitions: true,
          });
          if (fuzzy?.ok && fuzzy.value?.items?.length) {
            fuzzyNotice = '0 exact matches. Maybe you meant this?';
            result = fuzzy.value;
            searchState = {
              ...searchState,
              mode: 'fuzzy',
              beforeContext: 0,
              afterContext: 0,
              cursor: null,
            };
          }
        } catch {
          // fallback best-effort
        }
      }

      let output = formatGrepOutput(result);
      const notices: string[] = [];
      if (result?.regexFallbackError) {
        notices.push(`Invalid regex: ${result.regexFallbackError}, used literal match`);
      }
      const nextIterator = result?.nextCursor
        ? store.store(scopeId, 'ffi_i', { ...searchState, cursor: result.nextCursor })
        : '';
      notices.push(`iterator="${nextIterator}"`);

      if (notices.length > 0) output += `\n\n[${notices.join('. ')}]`;
      if (fuzzyNotice) output = `[${fuzzyNotice}]\n${output}`;

      return { output };
    } finally {
      if (externalBasePath) {
        try {
          finder.destroy();
        } catch {}
      }
    }
  }
}
