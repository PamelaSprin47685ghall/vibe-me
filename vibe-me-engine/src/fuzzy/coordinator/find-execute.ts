import type { Result } from '../../types/general.js';
import type { FindResultLike } from '../format.js';
import type { FinderLike } from './types.js';
import type { FuzzyFindState } from './find-state.js';

export function executeFindSearch(
  finder: FinderLike,
  searchState: FuzzyFindState,
): Result<FindResultLike, string> {
  const result = finder.fileSearch(searchState.query, { pageIndex: searchState.pageIndex, pageSize: searchState.pageSize });
  return result.ok ? { _tag: 'Ok', value: result.value } : { _tag: 'Err', error: result.error || 'fuzzy_find failed' };
}
