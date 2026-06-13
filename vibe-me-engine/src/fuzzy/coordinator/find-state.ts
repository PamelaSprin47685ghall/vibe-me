import type { FuzzyFindParams, FuzzyFindState, SearchOptions } from './types.js';
export type { FuzzyFindState };
import { resolveStore } from './deps.js';
import type { CoordinatorDeps } from './deps.js';

export type FindSearchStateResult =
  | { readonly searchState: FuzzyFindState }
  | { readonly output: string; readonly isError: true };

export function resolveFindSearchState(
  params: FuzzyFindParams,
  options: SearchOptions,
  deps: CoordinatorDeps,
): FindSearchStateResult {
  const store = resolveStore(options);
  if (params.iterator) {
    const searchState = deps.consumeIterator<FuzzyFindState>(store, params.iterator);
    if (!searchState) {
      return {
        output: `fuzzy_find iterator error: unknown, expired, or already consumed iterator "${params.iterator}"`,
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
  return {
    searchState: {
      query: deps.buildQuery(searchPath.pathConstraint, params.pattern, undefined, searchPath.basePath, searchPath.external),
      pageSize: params.limit ?? 30,
      pageIndex: 0,
      externalBasePath,
    },
  };
}
