import { acquireFinder, releaseFinder } from './finder-lifecycle.js';
import { resolveStore, defaultDeps } from './deps.js';
import type { CoordinatorDeps } from './deps.js';
import type { FuzzyFindParams, SearchOptions } from './types.js';
import { resolveFindSearchState } from './find-state.js';
import { executeFindSearch } from './find-execute.js';
import { buildFindResultOutput } from './find-output.js';

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
  const finderResult = await acquireFinder(externalBasePath, options.cwd, deps);
  if (finderResult._tag === 'Err') return { output: finderResult.error, isError: true };
  const finder = finderResult.value;
  try {
    const execResult = executeFindSearch(finder, searchState);
    if (execResult._tag === 'Err') return { output: execResult.error, isError: true };
    const output = buildFindResultOutput(execResult.value, searchState, store, options.scopeId, deps);
    return { output };
  } finally {
    releaseFinder(finder, externalBasePath);
  }
}
