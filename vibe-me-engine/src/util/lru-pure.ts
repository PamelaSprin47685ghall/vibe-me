export interface LRUStore<T> { data: ReadonlyMap<string, T>; maxSize: number }

export const createLRUStore = <T>(maxSize: number): LRUStore<T> => ({ data: new Map(), maxSize });

export const lruSet = <T>(store: LRUStore<T>, key: string, value: T): LRUStore<T> => {
  const next = new Map(store.data);
  if (next.has(key)) next.delete(key);
  next.set(key, value);
  if (next.size > store.maxSize) {
    const first = next.keys().next().value;
    if (first !== undefined) next.delete(first);
  }
  return { ...store, data: next };
};

export const lruGet = <T>(store: LRUStore<T>, key: string): [LRUStore<T>, T | undefined] => {
  const value = store.data.get(key);
  if (value === undefined) return [store, undefined];
  const next = new Map(store.data);
  next.delete(key);
  next.set(key, value);
  return [{ ...store, data: next }, value];
};

export const lruPeek = <T>(store: LRUStore<T>, key: string): T | undefined => store.data.get(key);

export const lruConsume = <T>(store: LRUStore<T>, key: string): [LRUStore<T>, T | undefined] => {
  const value = store.data.get(key);
  if (value === undefined) return [store, undefined];
  const next = new Map(store.data);
  next.delete(key);
  return [{ ...store, data: next }, value];
};

export const lruDelete = <T>(store: LRUStore<T>, key: string): LRUStore<T> => {
  if (!store.data.has(key)) return store;
  const next = new Map(store.data);
  next.delete(key);
  return { ...store, data: next };
};

export const lruClear = <T>(store: LRUStore<T>): LRUStore<T> => ({ ...store, data: new Map() });

export const lruSize = (store: LRUStore<unknown>): number => store.data.size;

export interface ScopedLRUStore<T> {
  scopes: ReadonlyMap<string, LRUStore<T>>;
  perScopeLimit: number;
  globalScopeLimit: number;
}

export const createScopedLRUStore = <T>(perScopeLimit: number, globalScopeLimit: number): ScopedLRUStore<T> =>
  ({ scopes: new Map(), perScopeLimit, globalScopeLimit });

const ensureScope = <T>(store: ScopedLRUStore<T>, scopeId: string): [ScopedLRUStore<T>, LRUStore<T>] => {
  const existing = store.scopes.get(scopeId);
  if (existing) {
    const reordered = new Map(store.scopes);
    reordered.delete(scopeId);
    reordered.set(scopeId, existing);
    if (reordered.size > store.globalScopeLimit) {
      const first = reordered.keys().next().value;
      if (first !== undefined) reordered.delete(first);
    }
    return [{ ...store, scopes: reordered }, existing];
  }
  const fresh = createLRUStore<T>(store.perScopeLimit);
  const next = new Map(store.scopes);
  next.set(scopeId, fresh);
  if (next.size > store.globalScopeLimit) {
    const first = next.keys().next().value;
    if (first !== undefined) next.delete(first);
  }
  return [{ ...store, scopes: next }, fresh];
};

export const scopedStore = <T>(store: ScopedLRUStore<T>, scopeId: string, token: string, value: T): ScopedLRUStore<T> => {
  const [storeAfterEnsure, scope] = ensureScope(store, scopeId);
  const updatedScope = lruSet(scope, token, value);
  const next = new Map(storeAfterEnsure.scopes);
  next.set(scopeId, updatedScope);
  return { ...storeAfterEnsure, scopes: next };
};

export const scopedPeek = <T>(store: ScopedLRUStore<T>, scopeId: string, token: string): T | undefined =>
  store.scopes.get(scopeId)?.data.get(token);

export const scopedConsume = <T>(store: ScopedLRUStore<T>, scopeId: string, token: string): [ScopedLRUStore<T>, T | undefined] => {
  const scope = store.scopes.get(scopeId);
  if (!scope) return [store, undefined];
  const [updatedScope, value] = lruConsume(scope, token);
  const next = new Map(store.scopes);
  next.set(scopeId, updatedScope);
  return [{ ...store, scopes: next }, value];
};

export const scopedClearScope = <T>(store: ScopedLRUStore<T>, scopeId: string): ScopedLRUStore<T> => {
  if (!store.scopes.has(scopeId)) return store;
  const next = new Map(store.scopes);
  next.delete(scopeId);
  return { ...store, scopes: next };
};

export const scopedClear = <T>(store: ScopedLRUStore<T>): ScopedLRUStore<T> => ({ ...store, scopes: new Map() });