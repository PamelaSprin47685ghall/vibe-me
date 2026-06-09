import { describe, expect, it } from 'bun:test';
import { globalIteratorStore } from 'engine/util';

describe('iterator store', () => {
  it('stores and consumes iterator data once', () => {
    const data = {
      query: 'src/main',
      pageSize: 20,
      pageIndex: 1,
    };
    const id = globalIteratorStore.store('global', 'ffi_f', data);
    expect(id).toMatch(/^ffi_f\d+$/);
    const retrieved = globalIteratorStore.consume<typeof data>(id);
    expect(retrieved?.query).toBe('src/main');
    expect(retrieved?.pageIndex).toBe(1);
    expect(globalIteratorStore.consume(id)).toBeUndefined();
  });

  it('returns undefined for unknown iterator id', () => {
    expect(globalIteratorStore.consume('missing')).toBeUndefined();
  });
});
