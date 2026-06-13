import { acquireFinder, releaseFinder } from './finder-lifecycle.js';
import { resolveStore, defaultDeps } from './deps.js';
import type { CoordinatorDeps } from './deps.js';
import type { FuzzyGrepParams, SearchOptions } from './types.js';
import { resolveGrepSearchState } from './grep-state.js';
import { executeGrepSearch, tryFuzzyFallback } from './grep-execute.js';
import { buildGrepResultOutput } from './grep-output.js';

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
    const execResult = executeGrepSearch(finder, searchState);
    if (execResult._tag === 'Err') return { output: execResult.error, isError: true };

    const fallback = tryFuzzyFallback(finder, searchState, params, execResult.value);
    searchState = fallback.searchState;
    const output = buildGrepResultOutput(
      fallback.result,
      searchState,
      fallback.fuzzyNotice,
      store,
      options.scopeId,
      deps,
    );
    return { output };
  } finally {
    releaseFinder(finder, externalBasePath);
  }
}
