import type { Result } from 'engine';
import type { GrepOptions } from '@ff-labs/fff-node';
import type { GrepResultLike } from '../format.js';
import type { FinderLike, FinderResult, FuzzyGrepParams } from './types.js';
import type { FuzzyGrepState } from './grep-state.js';

export function runGrepSearch(
  finder: FinderLike,
  searchState: FuzzyGrepState,
  modeOverride?: 'plain' | 'regex' | 'fuzzy',
): FinderResult<GrepResultLike> {
  const mode = modeOverride ?? searchState.mode;
  const sameMode = mode === searchState.mode;
  return finder.grep(searchState.query, {
    mode,
    smartCase: searchState.smartCase,
    maxMatchesPerFile: Math.min(searchState.pageSize, 50),
    pageSize: searchState.pageSize,
    cursor: sameMode ? searchState.cursor : null,
    beforeContext: sameMode ? searchState.beforeContext : 0,
    afterContext: sameMode ? searchState.afterContext : 0,
    classifyDefinitions: true,
  } as GrepOptions);
}

export function executeGrepSearch(
  finder: FinderLike,
  searchState: FuzzyGrepState,
  modeOverride?: 'plain' | 'regex' | 'fuzzy',
): Result<GrepResultLike, string> {
  const result = runGrepSearch(finder, searchState, modeOverride);
  return result.ok ? { _tag: 'Ok', value: result.value } : { _tag: 'Err', error: result.error || 'fuzzy_grep failed' };
}

export function tryFuzzyFallback(
  finder: FinderLike,
  searchState: FuzzyGrepState,
  params: FuzzyGrepParams,
  result: GrepResultLike | undefined,
): { result: GrepResultLike | undefined; fuzzyNotice: string | null; searchState: FuzzyGrepState } {
  if (result?.items?.length || params.iterator || searchState.mode === 'regex') {
    return { result, fuzzyNotice: null, searchState };
  }
  const fuzzy = runGrepSearch(finder, searchState, 'fuzzy');
  if (fuzzy.ok && fuzzy.value.items?.length) {
    return {
      result: fuzzy.value,
      fuzzyNotice: '0 exact matches. Maybe you meant this?',
      searchState: { ...searchState, mode: 'fuzzy', beforeContext: 0, afterContext: 0, cursor: null },
    };
  }
  return { result, fuzzyNotice: null, searchState };
}
