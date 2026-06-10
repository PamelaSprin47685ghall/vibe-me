import { describe, test, expect } from 'bun:test';
import {
  createLRUStore, lruSet, lruGet, lruConsume,
  createScopedLRUStore, scopedStore, scopedConsume, scopedClearScope,
} from './lru-pure.js';

describe('LRUStore', () => {
  test('evicts oldest when exceeding max size', () => {
    const s = createLRUStore<number>(3);
    lruSet(s, 'a', 1); lruSet(s, 'b', 2); lruSet(s, 'c', 3); lruSet(s, 'd', 4);
    expect(lruGet(s, 'a')).toBeUndefined();
    expect(lruGet(s, 'b')).toBe(2);
    expect(lruGet(s, 'c')).toBe(3);
    expect(lruGet(s, 'd')).toBe(4);
  });

  test('touch moves item to end', () => {
    const s = createLRUStore<number>(3);
    lruSet(s, 'a', 1); lruSet(s, 'b', 2); lruSet(s, 'c', 3);
    lruGet(s, 'a'); lruSet(s, 'd', 4);
    expect(lruGet(s, 'a')).toBe(1);
    expect(lruGet(s, 'b')).toBeUndefined();
  });

  test('consume removes item', () => {
    const s = createLRUStore<number>(3);
    lruSet(s, 'a', 1);
    expect(lruConsume(s, 'a')).toBe(1);
    expect(lruGet(s, 'a')).toBeUndefined();
  });
});

describe('ScopedLRUStore', () => {
  test('isolates scopes', () => {
    const s = createScopedLRUStore<number>(10, 5);
    scopedStore(s, 'scope1', 'token1', 100);
    scopedStore(s, 'scope2', 'token1', 200);
    expect(scopedConsume(s, 'scope1', 'token1')).toBe(100);
    expect(scopedConsume(s, 'scope2', 'token1')).toBe(200);
  });

  test('evicts oldest scope when exceeding global limit', () => {
    const s = createScopedLRUStore<number>(10, 2);
    scopedStore(s, 'scope1', 'token', 1);
    scopedStore(s, 'scope2', 'token', 2);
    scopedStore(s, 'scope3', 'token', 3);
    expect(scopedConsume(s, 'scope1', 'token')).toBeUndefined();
    expect(scopedConsume(s, 'scope2', 'token')).toBe(2);
    expect(scopedConsume(s, 'scope3', 'token')).toBe(3);
  });

  test('clearScope removes entire scope', () => {
    const s = createScopedLRUStore<number>(10, 5);
    scopedStore(s, 'scope1', 'a', 1);
    scopedStore(s, 'scope1', 'b', 2);
    scopedClearScope(s, 'scope1');
    expect(scopedConsume(s, 'scope1', 'a')).toBeUndefined();
    expect(scopedConsume(s, 'scope1', 'b')).toBeUndefined();
  });
});
