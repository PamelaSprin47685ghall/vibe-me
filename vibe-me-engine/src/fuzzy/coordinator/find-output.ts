import type { FindResultLike } from '../format.js';
import { formatFindOutput } from '../format.js';
import type { IteratorStore } from '../../util/iterator.js';
import type { CoordinatorDeps } from './deps.js';
import type { FuzzyFindState } from './find-state.js';

export function buildFindResultOutput(
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
