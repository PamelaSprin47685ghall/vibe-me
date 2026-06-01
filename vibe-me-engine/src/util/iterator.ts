const iteratorStore = new Map<string, unknown>();
let iteratorCounter = 0;
const MAX_ITERATORS = 200;

export function storeIterator<T>(prefix: string, value: T): string {
  const id = `${prefix}${++iteratorCounter}`;
  iteratorStore.set(id, value);
  if (iteratorStore.size > MAX_ITERATORS) {
    const first = iteratorStore.keys().next().value;
    if (first !== undefined) iteratorStore.delete(first);
  }
  return id;
}

export function consumeIterator<T>(id: string): T | undefined {
  const value = iteratorStore.get(id) as T | undefined;
  if (value !== undefined) iteratorStore.delete(id);
  return value;
}

export function clearIterators(): void {
  iteratorStore.clear();
  iteratorCounter = 0;
}
