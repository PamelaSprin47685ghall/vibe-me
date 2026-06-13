import type { FuzzyGrepParams, FuzzyGrepState, SearchOptions } from './types.js';
export type { FuzzyGrepState };
import { resolveStore } from './deps.js';
import type { CoordinatorDeps } from './deps.js';
import type { ResolvedFuzzySearchPath } from '../query.js';

export type GrepSearchStateResult =
  | { readonly searchState: FuzzyGrepState }
  | { readonly output: string; readonly isError: true };

export function detectGrepMode(pattern: string): 'plain' | 'regex' | 'fuzzy' {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (pattern === escaped) return 'plain';
  try {
    new RegExp(pattern);
    return 'regex';
  } catch {
    return 'plain';
  }
}

export function checkWildcardOnly(
  pattern: string,
  mode: 'plain' | 'regex' | 'fuzzy',
): boolean {
  if (mode === 'plain') return false;
  return /^(?:[.^$]*(?:[.][*+?]|\*|\+)[.^$]*|[.^$\s]*|\.\*\??|\.*[+?]?|\.+\??|\.|\*|\?)$/.test(pattern.trim());
}

function buildGrepQuery(
  params: FuzzyGrepParams,
  searchPath: ResolvedFuzzySearchPath,
  deps: CoordinatorDeps,
): string {
  return deps.buildQuery(
    searchPath.pathConstraint,
    params.pattern as string,
    params.exclude,
    searchPath.basePath,
    searchPath.external,
  );
}

export function resolveGrepSearchState(
  params: FuzzyGrepParams,
  options: SearchOptions,
  deps: CoordinatorDeps,
): GrepSearchStateResult {
  const store = resolveStore(options);
  if (params.iterator) {
    const searchState = deps.consumeIterator<FuzzyGrepState>(store, params.iterator);
    if (!searchState) {
      return {
        output: `fuzzy_grep iterator error: unknown, expired, or already consumed iterator "${params.iterator}"`,
        isError: true,
      };
    }
    return { searchState };
  }

  if (!params.pattern) {
    return { output: 'pattern is required on the first call', isError: true };
  }

  const searchPath = deps.resolveFuzzySearchPath(params.path, options.cwd);
  const externalBasePath = searchPath.external ? searchPath.basePath : null;
  const query = buildGrepQuery(params, searchPath, deps);
  const mode = detectGrepMode(params.pattern);
  if (checkWildcardOnly(params.pattern, mode)) {
    return {
      output: `Pattern '${params.pattern}' matches everything - fuzzy_grep needs a concrete substring or identifier.`,
      isError: true,
    };
  }

  return {
    searchState: {
      query,
      mode,
      smartCase: params.caseSensitive !== true,
      beforeContext: params.context ?? 0,
      afterContext: params.context ?? 0,
      pageSize: params.limit ?? 50,
      externalBasePath,
      cursor: null,
    },
  };
}
