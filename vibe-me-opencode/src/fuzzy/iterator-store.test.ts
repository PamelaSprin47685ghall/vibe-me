import { describe, expect, it } from 'bun:test';
import { globalIteratorStore, storeIterator, consumeIterator } from 'engine/util';

describe('iterator store', () => {
  it('stores and consumes iterator data once', () => {
    const data = {
      query: 'src/main',
      pageSize: 20,
      pageIndex: 1,
    };
    const id = storeIterator(globalIteratorStore, 'global', 'ffi_f', data);
    expect(id).toMatch(/^ffi_f\d+$/);
    const retrieved = consumeIterator<typeof data>(globalIteratorStore, id);
    expect(retrieved?.query).toBe('src/main');
    expect(retrieved?.pageIndex).toBe(1);
    expect(consumeIterator(globalIteratorStore, id)).toBeUndefined();
  });

  it('returns undefined for unknown iterator id', () => {
    expect(consumeIterator(globalIteratorStore, 'missing')).toBeUndefined();
  });
});
