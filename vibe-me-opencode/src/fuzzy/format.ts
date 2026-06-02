export { formatGrepOutput, formatFindOutput, fileAnnotation, truncateLine } from 'engine/fuzzy';
import { globalIteratorStore } from 'engine/util';

export function storeIterator<T>(namespace: string, value: T): string {
  return globalIteratorStore.store('global', namespace, value);
}

export function consumeIterator<T>(id: string): T | undefined {
  return globalIteratorStore.consume<T>(id);
}
