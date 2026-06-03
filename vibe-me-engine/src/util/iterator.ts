export class ScopedIteratorStore {
  private iterators = new Map<string, unknown>();
  private counter = 0;
  private maxIterators: number;

  constructor(maxIterators = 200) {
    this.maxIterators = maxIterators;
  }

  public store<T>(scopeId: string, namespace: string, value: T): string {
    const id = scopeId === 'global' ? `${namespace}${++this.counter}` : `${scopeId}:${namespace}:${++this.counter}`;
    this.iterators.set(id, value);
    if (this.iterators.size > this.maxIterators) {
      const first = this.iterators.keys().next().value;
      if (first !== undefined) this.iterators.delete(first);
    }
    return id;
  }

  public consume<T>(id: string): T | undefined {
    const value = this.iterators.get(id) as T | undefined;
    if (value !== undefined) {
      this.iterators.delete(id);
    }
    return value;
  }

  public clearScope(scopeId: string): void {
    const prefix = `${scopeId}:`;
    for (const key of this.iterators.keys()) {
      if (key.startsWith(prefix)) {
        this.iterators.delete(key);
      }
    }
  }

  public clear(): void {
    this.iterators.clear();
    this.counter = 0;
  }
}

export const globalIteratorStore = new ScopedIteratorStore();
