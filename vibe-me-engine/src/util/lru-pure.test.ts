import { describe, test, expect } from 'vitest';
import {
  createLRUStore, lruSet, lruGet, lruConsume, lruPeek, lruDelete, lruClear,
  createScopedLRUStore, scopedStore, scopedConsume, scopedPeek, scopedClearScope, scopedClear,
} from './lru-pure.js';

describe('LRUStore', () => {
  test('evicts oldest when exceeding max size', () => {
    let s = createLRUStore<number>(3);
    s = lruSet(s, 'a', 1);
    s = lruSet(s, 'b', 2);
    s = lruSet(s, 'c', 3);
    s = lruSet(s, 'd', 4);
    let r: [typeof s, number | undefined];
    r = lruGet(s, 'a'); expect(r[1]).toBeUndefined();
    r = lruGet(r[0], 'b'); expect(r[1]).toBe(2);
    r = lruGet(r[0], 'c'); expect(r[1]).toBe(3);
    r = lruGet(r[0], 'd'); expect(r[1]).toBe(4);
  });

  test('touch moves item to end', () => {
    let s = createLRUStore<number>(3);
    s = lruSet(s, 'a', 1);
    s = lruSet(s, 'b', 2);
    s = lruSet(s, 'c', 3);
    const [s2, val] = lruGet(s, 'a');
    expect(val).toBe(1);
    s = lruSet(s2, 'd', 4);
    const r1 = lruGet(s, 'a'); expect(r1[1]).toBe(1);
    const r2 = lruGet(r1[0], 'b'); expect(r2[1]).toBeUndefined();
  });

  test('consume removes item and returns new store', () => {
    let s = createLRUStore<number>(3);
    s = lruSet(s, 'a', 1);
    const [s2, consumed] = lruConsume(s, 'a');
    expect(consumed).toBe(1);
    const [_, after] = lruGet(s2, 'a');
    expect(after).toBeUndefined();
  });

  test('peek reads without moving', () => {
    let s = createLRUStore<number>(3);
    s = lruSet(s, 'a', 1);
    s = lruSet(s, 'b', 2);
    expect(lruPeek(s, 'a')).toBe(1);
    expect(lruPeek(s, 'c')).toBeUndefined();
    s = lruSet(s, 'c', 3);
    const r = lruGet(s, 'a'); expect(r[1]).toBe(1);
  });

  test('delete returns new store', () => {
    let s = createLRUStore<number>(3);
    s = lruSet(s, 'a', 1);
    const s2 = lruDelete(s, 'a');
    expect(lruPeek(s2, 'a')).toBeUndefined();
    expect(lruPeek(s, 'a')).toBe(1);
  });

  test('clear returns empty store', () => {
    let s = createLRUStore<number>(3);
    s = lruSet(s, 'a', 1);
    const s2 = lruClear(s);
    expect(lruPeek(s2, 'a')).toBeUndefined();
    expect(lruPeek(s, 'a')).toBe(1);
  });

  test('original store not mutated after set', () => {
    const s = lruSet(createLRUStore<number>(3), 'a', 1);
    const s2 = lruSet(s, 'b', 2);
    expect(lruPeek(s, 'b')).toBeUndefined();
    expect(lruPeek(s2, 'b')).toBe(2);
  });
});

describe('ScopedLRUStore', () => {
  test('isolates scopes', () => {
    let s = createScopedLRUStore<number>(10, 5);
    s = scopedStore(s, 'scope1', 'token1', 100);
    s = scopedStore(s, 'scope2', 'token1', 200);
    const r1 = scopedConsume(s, 'scope1', 'token1'); expect(r1[1]).toBe(100);
    const r2 = scopedConsume(r1[0], 'scope2', 'token1'); expect(r2[1]).toBe(200);
  });

  test('evicts oldest scope when exceeding global limit', () => {
    let s = createScopedLRUStore<number>(10, 2);
    s = scopedStore(s, 'scope1', 'token', 1);
    s = scopedStore(s, 'scope2', 'token', 2);
    s = scopedStore(s, 'scope3', 'token', 3);
    const r1 = scopedConsume(s, 'scope1', 'token'); expect(r1[1]).toBeUndefined();
    const r2 = scopedConsume(r1[0], 'scope2', 'token'); expect(r2[1]).toBe(2);
    const r3 = scopedConsume(r2[0], 'scope3', 'token'); expect(r3[1]).toBe(3);
  });

  test('clearScope removes entire scope', () => {
    let s = createScopedLRUStore<number>(10, 5);
    s = scopedStore(s, 'scope1', 'a', 1);
    s = scopedStore(s, 'scope1', 'b', 2);
    s = scopedClearScope(s, 'scope1');
    const r1 = scopedConsume(s, 'scope1', 'a'); expect(r1[1]).toBeUndefined();
    const r2 = scopedConsume(r1[0], 'scope1', 'b'); expect(r2[1]).toBeUndefined();
  });

  test('peek reads without touching', () => {
    let s = createScopedLRUStore<number>(10, 5);
    s = scopedStore(s, 'scope1', 'token1', 42);
    expect(scopedPeek(s, 'scope1', 'token1')).toBe(42);
    expect(scopedPeek(s, 'scope1', 'missing')).toBeUndefined();
    expect(scopedPeek(s, 'missing', 'token1')).toBeUndefined();
  });

  test('clear returns empty store', () => {
    let s = createScopedLRUStore<number>(10, 5);
    s = scopedStore(s, 'scope1', 'a', 1);
    const s2 = scopedClear(s);
    expect(scopedPeek(s2, 'scope1', 'a')).toBeUndefined();
    expect(scopedPeek(s, 'scope1', 'a')).toBe(1);
  });

  test('original store not mutated after scopedStore', () => {
    let s = createScopedLRUStore<number>(10, 5);
    s = scopedStore(s, 'scope1', 'token1', 100);
    const s2 = scopedStore(s, 'scope1', 'token2', 200);
    expect(scopedPeek(s, 'scope1', 'token2')).toBeUndefined();
    expect(scopedPeek(s2, 'scope1', 'token2')).toBe(200);
  });
});