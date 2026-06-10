export interface LRUStore<T> { data: Map<string, T>; maxSize: number }

export const createLRUStore = <T>(maxSize: number): LRUStore<T> => ({ data: new Map(), maxSize });

export const lruSet = <T>(store: LRUStore<T>, key: string, value: T): LRUStore<T> => {
  if (store.data.has(key)) store.data.delete(key);
  store.data.set(key, value);
  if (store.data.size > store.maxSize) {
    const first = store.data.keys().next().value;
    if (first !== undefined) store.data.delete(first);
  }
  return store;
};

export const lruGet = <T>(store: LRUStore<T>, key: string): T | undefined => {
  const value = store.data.get(key);
  if (value === undefined) return undefined;
  store.data.delete(key);
  store.data.set(key, value);
  return value;
};

export const lruConsume = <T>(store: LRUStore<T>, key: string): T | undefined => {
  const value = store.data.get(key);
  if (value !== undefined) store.data.delete(key);
  return value;
};

export const lruDelete = <T>(store: LRUStore<T>, key: string): boolean => store.data.delete(key);

export const lruClear = <T>(store: LRUStore<T>): LRUStore<T> => { store.data.clear(); return store; };

export const lruSize = (store: LRUStore<unknown>): number => store.data.size;

export interface ScopedLRUStore<T> {
  scopes: Map<string, LRUStore<T>>;
  perScopeLimit: number;
  globalScopeLimit: number;
}

export const createScopedLRUStore = <T>(perScopeLimit: number, globalScopeLimit: number): ScopedLRUStore<T> =>
  ({ scopes: new Map(), perScopeLimit, globalScopeLimit });

const ensureScope = <T>(store: ScopedLRUStore<T>, scopeId: string): LRUStore<T> => {
  let scope = store.scopes.get(scopeId);
  if (!scope) {
    scope = createLRUStore<T>(store.perScopeLimit);
    store.scopes.set(scopeId, scope);
    if (store.scopes.size > store.globalScopeLimit) {
      const first = store.scopes.keys().next().value;
      if (first !== undefined) store.scopes.delete(first);
    }
  } else {
    store.scopes.delete(scopeId);
    store.scopes.set(scopeId, scope);
  }
  return scope;
};

export const scopedStore = <T>(store: ScopedLRUStore<T>, scopeId: string, token: string, value: T): ScopedLRUStore<T> => {
  lruSet(ensureScope(store, scopeId), token, value);
  return store;
};

export const scopedConsume = <T>(store: ScopedLRUStore<T>, scopeId: string, token: string): T | undefined =>
  store.scopes.get(scopeId) ? lruConsume(store.scopes.get(scopeId)!, token) : undefined;

export const scopedClearScope = <T>(store: ScopedLRUStore<T>, scopeId: string): ScopedLRUStore<T> => {
  store.scopes.delete(scopeId);
  return store;
};

export const scopedClear = <T>(store: ScopedLRUStore<T>): ScopedLRUStore<T> => {
  store.scopes.clear();
  return store;
};