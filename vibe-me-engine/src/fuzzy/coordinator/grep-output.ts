import type { GrepCursor } from '@ff-labs/fff-node';
import type { GrepResultLike } from '../format.js';
import type { IteratorStore } from '../../util/iterator.js';
import type { CoordinatorDeps } from './deps.js';
import type { FuzzyGrepState } from './grep-state.js';

export function buildGrepResultOutput(
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
