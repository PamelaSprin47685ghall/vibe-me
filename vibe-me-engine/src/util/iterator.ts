export interface IteratorStore {
  iterators: Map<string, unknown>;
  counter: number;
  maxIterators: number;
}

export function createIteratorStore(maxIterators = 200): IteratorStore {
  return { iterators: new Map(), counter: 0, maxIterators };
}

export function storeIterator<T>(store: IteratorStore, scopeId: string, namespace: string, value: T): string {
  const id = scopeId === 'global' ? `${namespace}${++store.counter}` : `${scopeId}:${namespace}:${++store.counter}`;
  store.iterators.set(id, value);
  if (store.iterators.size > store.maxIterators) {
    const first = store.iterators.keys().next().value;
    if (first !== undefined) store.iterators.delete(first);
  }
  return id;
}

export function consumeIterator<T>(store: IteratorStore, id: string): T | undefined {
  const value = store.iterators.get(id) as T | undefined;
  if (value !== undefined) store.iterators.delete(id);
  return value;
}

export function clearIteratorScope(store: IteratorStore, scopeId: string): void {
  const prefix = `${scopeId}:`;
  for (const key of store.iterators.keys()) {
    if (key.startsWith(prefix)) store.iterators.delete(key);
  }
}

export function clearIteratorStore(store: IteratorStore): void {
  store.iterators.clear();
  store.counter = 0;
}

export const globalIteratorStore = createIteratorStore();