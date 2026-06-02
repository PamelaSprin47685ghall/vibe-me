import { describe, test, expect } from 'bun:test';
import { PureLRUStore, ScopedLRUStore } from './lru-pure';

describe('PureLRUStore', () => {
  test('evicts oldest when exceeding max size', () => {
    const store = new PureLRUStore<number>(3);
    store.set('a', 1);
    store.set('b', 2);
    store.set('c', 3);
    store.set('d', 4);

    expect(store.get('a')).toBeUndefined();
    expect(store.get('b')).toBe(2);
    expect(store.get('c')).toBe(3);
    expect(store.get('d')).toBe(4);
  });

  test('touch moves item to end', () => {
    const store = new PureLRUStore<number>(3);
    store.set('a', 1);
    store.set('b', 2);
    store.set('c', 3);
    
    store.get('a');
    store.set('d', 4);

    expect(store.get('a')).toBe(1);
    expect(store.get('b')).toBeUndefined();
  });

  test('consume removes item', () => {
    const store = new PureLRUStore<number>(3);
    store.set('a', 1);
    
    expect(store.consume('a')).toBe(1);
    expect(store.get('a')).toBeUndefined();
  });
});

describe('ScopedLRUStore', () => {
  test('isolates scopes', () => {
    const store = new ScopedLRUStore<number>(10, 5);
    store.store('scope1', 'token1', 100);
    store.store('scope2', 'token1', 200);

    expect(store.consume('scope1', 'token1')).toBe(100);
    expect(store.consume('scope2', 'token1')).toBe(200);
  });

  test('evicts oldest scope when exceeding global limit', () => {
    const store = new ScopedLRUStore<number>(10, 2);
    store.store('scope1', 'token', 1);
    store.store('scope2', 'token', 2);
    store.store('scope3', 'token', 3);

    expect(store.consume('scope1', 'token')).toBeUndefined();
    expect(store.consume('scope2', 'token')).toBe(2);
    expect(store.consume('scope3', 'token')).toBe(3);
  });

  test('clearScope removes entire scope', () => {
    const store = new ScopedLRUStore<number>(10, 5);
    store.store('scope1', 'a', 1);
    store.store('scope1', 'b', 2);
    
    store.clearScope('scope1');

    expect(store.consume('scope1', 'a')).toBeUndefined();
    expect(store.consume('scope1', 'b')).toBeUndefined();
  });
});
